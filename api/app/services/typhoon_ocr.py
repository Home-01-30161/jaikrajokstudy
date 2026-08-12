"""Typhoon OCR client (SCB 10X) — /v1/ocr multipart (primary) + /v1/chat/completions (fallback).

Primary: /v1/ocr multipart endpoint — produces far better OCR with diagram descriptions
         via <figure> blocks.  Tested: correctly reads 'u', '45°', '60°', full question.
Fallback: /v1/chat/completions with base64 image — faster (1-5s) but often misses
          diagram details, angles, and variable names.

Model: typhoon-ocr (v1.5, recommended) with typhoon-ocr-preview (v1, legacy) fallback.
Rate limit: 2 req/s, 20 req/min.
"""

from __future__ import annotations

import base64
import json as _json
import re

import httpx

from app.config import get_settings
from app.services.base import ServiceResult
from app.utils.logging import get_logger

logger = get_logger(__name__)

_OCR_URL = "https://api.opentyphoon.ai/v1/ocr"
_CHAT_URL = "https://api.opentyphoon.ai/v1/chat/completions"

# Supported OCR models — try v1.5 first, fall back to v1 preview if quota exceeded.
_OCR_MODELS = ["typhoon-ocr", "typhoon-ocr-preview"]

# Chinese/Japanese character range — must not appear in OCR output for Thai homework
_CJK_RE = re.compile(r"[一-鿿㐀-䶿぀-ヿ]")


def _strip_cjk_lines(text: str) -> str:
    """Remove lines that are entirely CJK characters (leaked model scratchpad)."""
    lines = text.split("\n")
    clean = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            clean.append(line)
            continue
        # If the line is >50% CJK and has no Thai, drop it
        cjk_count = len(_CJK_RE.findall(stripped))
        thai_count = len(re.findall(r"[฀-๿]", stripped))
        if cjk_count > 0 and thai_count == 0 and cjk_count / max(len(stripped), 1) > 0.4:
            continue
        clean.append(line)
    return "\n".join(clean).strip()


# Default OCR system prompt — instructs the model to extract text only.
# CRITICAL: forbid Chinese/Japanese output — typhoon-ocr-preview sometimes
# emits Chinese characters when the image contains diagrams or equations.
_SYSTEM_PROMPT = (
    "You are an expert OCR engine specialised in Thai physics and mathematics homework. "
    "Extract ALL text and diagram information visible in this image exactly as it appears. "
    "Output language: Thai and English only. NEVER output Chinese, Japanese, or any other language. "
    "For diagrams, figures, graphs, or free-body diagrams: "
    "1. List EVERY label, angle measurement, variable name, arrow, and number you see. "
    "2. Describe the diagram structure briefly (e.g. 'จุด O อยู่ที่จุดกำเนิด, จุด A อยู่บนเส้นทางโพรเจกไทล์'). "
    "3. State the angle each arrow or vector makes (e.g. 'ความเร็ว u ทำมุม 45° กับแนวดิ่ง, มุมที่จุด A = 60°'). "
    "4. NEVER confuse the letter g (gravity symbol) with the digit 8. g = ความเร่งโน้มถ่วง. "
    "5. NEVER output placeholder image tags like ![...] or markdown image syntax. "
    "6. Do NOT add free-text summaries or commentary — only transcribe what you see. "
    "Format rules: "
    "- Mathematical equations: use $...$ for inline and $$...$$ for block LaTeX. "
    "- Include ALL text: problem statement, sub-questions, diagram labels, choices (ก. ข. ค. ง.), numbers, units. "
    "- Do NOT skip, summarize, or add commentary beyond diagram description. Transcribe verbatim. "
    "- Do NOT output Chinese or Japanese characters under any circumstances."
)

_DEFAULT_USER_PROMPT = (
    "Extract all text and diagram information from this image. "
    "Include: full problem statement, every question asked, every diagram label, "
    "every angle (e.g. 45°, 60°), every variable (e.g. u, g, v, A, O), and every measurement. "
    "Do NOT add image placeholders or free-text summaries. "
    "Return clean Markdown only."
)


def _detect_mime(filename: str, image_bytes: bytes) -> str:
    """Detect MIME type from filename extension, then from magic bytes."""
    fname_lower = (filename or "").lower()
    if fname_lower.endswith(".png"):
        return "image/png"
    if fname_lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if fname_lower.endswith(".webp"):
        return "image/webp"
    # Magic-byte fallback
    if image_bytes[:4] == b"\x89PNG":
        return "image/png"
    if image_bytes[:3] in (b"\xff\xd8\xff",):
        return "image/jpeg"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    # Default to JPEG — Typhoon OCR accepts it for most photos
    return "image/jpeg"


async def extract_text_typhoon(
    image_bytes: bytes,
    filename: str = "image.jpg",
    user_prompt: str | None = None,
) -> ServiceResult:
    """Extract text from image using Typhoon OCR.

    Strategy:
      1. Try /v1/ocr multipart endpoint (best quality, includes <figure> diagram descriptions)
      2. Fall back to /v1/chat/completions with base64 (faster but lower diagram quality)

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, or WebP).
        filename: Original filename (used for MIME type detection).
        user_prompt: Optional custom question about the image. If None, the
                     default OCR extraction prompt is used.
    """
    settings = get_settings()

    if not settings.typhoon_api_key:
        return ServiceResult(
            service="typhoon-ocr",
            ok=False,
            error="Missing TYPHOON_API_KEY",
        )

    if not image_bytes:
        return ServiceResult(
            service="typhoon-ocr",
            ok=False,
            error="Empty image bytes",
        )

    # Try /v1/ocr multipart first (much better quality for diagrams)
    ocr_result = await _extract_via_ocr_endpoint(image_bytes, filename, settings)
    if ocr_result.ok and (ocr_result.text or "").strip():
        return ocr_result

    logger.warning(
        "Typhoon /v1/ocr failed (%s); falling back to /v1/chat/completions",
        ocr_result.error,
    )

    # Fallback to /v1/chat/completions with base64
    return await _extract_via_chat_endpoint(image_bytes, filename, user_prompt, settings)


async def _extract_via_ocr_endpoint(
    image_bytes: bytes,
    filename: str,
    settings,
) -> ServiceResult:
    """Extract text using /v1/ocr multipart endpoint (primary, best quality).

    Response format:
    {
      "results": [
        {
          "success": true,
          "filename": "image.jpg",
          "message": {
            "choices": [{"message": {"content": "..."}}]
          }
        }
      ]
    }
    """
    mime = _detect_mime(filename, image_bytes)
    ext_map = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
    ext = ext_map.get(mime, ".jpg")

    headers = {
        "Authorization": f"Bearer {settings.typhoon_api_key}",
    }

    last_error = "unknown"

    for model in _OCR_MODELS:
        data = {
            "model": model,
            "task_type": "default",
            "max_tokens": "8192",
            "temperature": "0.1",
            "top_p": "0.6",
            "repetition_penalty": "1.2",
        }

        try:
            async with httpx.AsyncClient(
                timeout=60.0, verify=not settings.insecure_tls
            ) as client:
                resp = await client.post(
                    _OCR_URL,
                    headers=headers,
                    data=data,
                    files={"file": (f"image{ext}", image_bytes, mime)},
                )

                try:
                    raw = resp.json()
                except Exception:
                    raw = {"text": resp.text}

                if resp.status_code >= 400:
                    err_msg = ""
                    if isinstance(raw, dict):
                        err_obj = raw.get("error") or {}
                        if isinstance(err_obj, dict):
                            err_msg = err_obj.get("message", "")
                        elif isinstance(err_obj, str):
                            err_msg = err_obj
                    if not err_msg:
                        err_msg = f"HTTP {resp.status_code}"
                    logger.warning(
                        "Typhoon /v1/ocr [%s] HTTP %s: %s",
                        model, resp.status_code, str(raw)[:300],
                    )
                    last_error = err_msg
                    if resp.status_code in (404, 422, 429):
                        continue
                    return ServiceResult(
                        service="typhoon-ocr",
                        ok=False,
                        error=err_msg,
                        raw=raw if isinstance(raw, dict) else {},
                    )

                raw_dict = raw if isinstance(raw, dict) else {}
                extracted_text = _parse_ocr_response(raw_dict)

                if not extracted_text:
                    logger.warning("Typhoon /v1/ocr [%s] returned empty text", model)
                    last_error = "empty response"
                    continue

                # Clean up: convert <figure> to [คำอธิบายแผนภาพ], strip CJK, etc.
                extracted_text = _clean_ocr_text(extracted_text)
                if not extracted_text:
                    last_error = "empty after cleaning"
                    continue

                logger.info(
                    "Typhoon /v1/ocr succeeded with model=%s (%d chars)",
                    model, len(extracted_text),
                )
                return ServiceResult(
                    service="typhoon-ocr",
                    ok=True,
                    text=extracted_text,
                    raw=raw_dict,
                )

        except httpx.TimeoutException:
            logger.warning("Typhoon /v1/ocr [%s] timed out", model)
            last_error = "timeout"
            continue
        except Exception as exc:
            logger.exception("Typhoon /v1/ocr [%s] call failed", model)
            last_error = str(exc)
            continue

    return ServiceResult(service="typhoon-ocr", ok=False, error=last_error)


async def _extract_via_chat_endpoint(
    image_bytes: bytes,
    filename: str,
    user_prompt: str | None,
    settings,
) -> ServiceResult:
    """Extract text using /v1/chat/completions with base64 image (fallback)."""
    mime = _detect_mime(filename, image_bytes)
    b64_image = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{b64_image}"

    user_text = (user_prompt.strip() if user_prompt and user_prompt.strip()
                 else _DEFAULT_USER_PROMPT)

    headers = {
        "Authorization": f"Bearer {settings.typhoon_api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": _OCR_MODELS[0],
        "messages": [
            {
                "role": "system",
                "content": _SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url},
                    },
                    {
                        "type": "text",
                        "text": user_text,
                    },
                ],
            },
        ],
        "max_tokens": 4096,
        "temperature": 0.1,
        "top_p": 0.6,
        "repetition_penalty": 1.2,
    }

    last_error = "unknown"

    for model in _OCR_MODELS:
        payload["model"] = model
        try:
            async with httpx.AsyncClient(
                timeout=35.0, verify=not settings.insecure_tls
            ) as client:
                resp = await client.post(_CHAT_URL, headers=headers, json=payload)

                try:
                    raw = resp.json()
                except Exception:
                    raw = {"text": resp.text}

                if resp.status_code >= 400:
                    err_msg = ""
                    if isinstance(raw, dict):
                        err_obj = raw.get("error") or {}
                        if isinstance(err_obj, dict):
                            err_msg = err_obj.get("message", "")
                        elif isinstance(err_obj, str):
                            err_msg = err_obj
                    if not err_msg:
                        err_msg = f"HTTP {resp.status_code}"
                    logger.warning(
                        "Typhoon chat [%s] HTTP %s: %s",
                        model, resp.status_code, str(raw)[:300],
                    )
                    last_error = err_msg
                    if resp.status_code in (404, 422, 429):
                        continue
                    return ServiceResult(
                        service="typhoon-ocr",
                        ok=False,
                        error=err_msg,
                        raw=raw if isinstance(raw, dict) else {},
                    )

                raw_dict = raw if isinstance(raw, dict) else {}
                extracted_text = _strip_cjk_lines(
                    _parse_chat_response(raw_dict)
                )

                if not extracted_text:
                    logger.warning("Typhoon chat [%s] returned empty text", model)
                    last_error = "empty response"
                    continue

                logger.info("Typhoon chat succeeded with model=%s", model)
                return ServiceResult(
                    service="typhoon-ocr",
                    ok=True,
                    text=extracted_text,
                    raw=raw_dict,
                )

        except httpx.TimeoutException:
            logger.warning("Typhoon chat [%s] timed out", model)
            last_error = "timeout"
            continue
        except Exception as exc:
            logger.exception("Typhoon chat [%s] call failed", model)
            last_error = str(exc)
            continue

    return ServiceResult(service="typhoon-ocr", ok=False, error=last_error)


# ---------------------------------------------------------------------------
# Diagram description (second vision call in dual-call homework pattern)
# ---------------------------------------------------------------------------

_DIAGRAM_SYSTEM_PROMPT = (
    "You are a diagram analysis engine specialised in Thai physics and mathematics homework. "
    "Describe the diagram in this image using complete sentences. "
    "Output language: Thai and English only. NEVER output Chinese or Japanese. "
    "For EVERY angle arc shown, state exactly which two lines it is between and its numerical value. "
    "For EVERY labeled point (O, A, B, etc.), state what angle the velocity vector makes at that "
    "point and with respect to which axis or line. "
    "Example format: 'At point O, the projectile is launched at 45 degrees from the vertical axis.' "
    "'At point A, the velocity vector makes an angle of 60 degrees from the vertical axis.' "
    "Be precise and exhaustive about every angle, vector, label, and measurement in the diagram. "
    "Do NOT output Chinese or Japanese characters under any circumstances."
)

_DIAGRAM_USER_PROMPT = (
    "Describe the diagram in this image using complete sentences. "
    "For EVERY angle arc shown, state exactly which two lines it is between and its numerical value. "
    "For EVERY labeled point (O, A, B, etc.), state what angle the velocity vector makes at that "
    "point and with respect to which axis or line. "
    "Be precise and exhaustive about every angle in the diagram."
)


async def describe_diagram_typhoon(
    image_bytes: bytes,
    filename: str = "image.jpg",
) -> ServiceResult:
    """Describe diagrams/figures in an image using Typhoon OCR vision model.

    This is the second vision call in the dual-call pattern from the reference repo's
    analyzeHomework() — one call for text OCR, one call for diagram description.
    """
    settings = get_settings()

    if not settings.typhoon_api_key:
        return ServiceResult(
            service="typhoon-ocr-diagram",
            ok=False,
            error="Missing TYPHOON_API_KEY",
        )

    if not image_bytes:
        return ServiceResult(
            service="typhoon-ocr-diagram",
            ok=False,
            error="Empty image bytes",
        )

    mime = _detect_mime(filename, image_bytes)
    b64_image = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{b64_image}"

    headers = {
        "Authorization": f"Bearer {settings.typhoon_api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": _OCR_MODELS[0],
        "messages": [
            {
                "role": "system",
                "content": _DIAGRAM_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url},
                    },
                    {
                        "type": "text",
                        "text": _DIAGRAM_USER_PROMPT,
                    },
                ],
            },
        ],
        "max_tokens": 4096,
        "temperature": 0.1,
        "top_p": 0.6,
        "repetition_penalty": 1.2,
    }

    last_error = "unknown"

    for model in _OCR_MODELS:
        payload["model"] = model
        try:
            async with httpx.AsyncClient(
                timeout=35.0, verify=not settings.insecure_tls
            ) as client:
                resp = await client.post(_CHAT_URL, headers=headers, json=payload)

                try:
                    raw = resp.json()
                except Exception:
                    raw = {"text": resp.text}

                if resp.status_code >= 400:
                    err_msg = ""
                    if isinstance(raw, dict):
                        err_obj = raw.get("error") or {}
                        if isinstance(err_obj, dict):
                            err_msg = err_obj.get("message", "")
                        elif isinstance(err_obj, str):
                            err_msg = err_obj
                    if not err_msg:
                        err_msg = f"HTTP {resp.status_code}"
                    logger.warning(
                        "Typhoon diagram [%s] HTTP %s: %s",
                        model, resp.status_code, str(raw)[:300],
                    )
                    last_error = err_msg
                    if resp.status_code in (404, 422, 429):
                        continue
                    return ServiceResult(
                        service="typhoon-ocr-diagram",
                        ok=False,
                        error=err_msg,
                        raw=raw if isinstance(raw, dict) else {},
                    )

                raw_dict = raw if isinstance(raw, dict) else {}
                extracted_text = _strip_cjk_lines(
                    _parse_chat_response(raw_dict)
                )

                if not extracted_text:
                    logger.warning("Typhoon diagram [%s] returned empty text", model)
                    last_error = "empty response"
                    continue

                logger.info("Typhoon diagram succeeded with model=%s", model)
                return ServiceResult(
                    service="typhoon-ocr-diagram",
                    ok=True,
                    text=extracted_text,
                    raw=raw_dict,
                )

        except httpx.TimeoutException:
            logger.warning("Typhoon diagram [%s] timed out", model)
            last_error = "timeout"
            continue
        except Exception as exc:
            logger.exception("Typhoon diagram [%s] call failed", model)
            last_error = str(exc)
            continue

    return ServiceResult(service="typhoon-ocr-diagram", ok=False, error=last_error)


def _clean_ocr_text(text: str) -> str:
    """Clean up OCR output: convert <figure> blocks, strip CJK junk."""
    # Strip markdown image placeholders
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)

    # Convert <figure>...</figure> blocks to [คำอธิบายแผนภาพ] sections
    def _figure_to_section(m: re.Match) -> str:
        inner = m.group(1).strip()
        if inner:
            return f"\n[คำอธิบายแผนภาพ]\n{inner}\n"
        return ""

    text = re.sub(r"<figure>(.*?)</figure>", _figure_to_section, text, flags=re.DOTALL)

    return _strip_cjk_lines(text.strip())


def _parse_ocr_response(raw: dict) -> str:
    """Parse the /v1/ocr multipart endpoint response.

    Response format:
    {
      "results": [
        {
          "success": true,
          "filename": "image.jpg",
          "message": {
            "choices": [{"message": {"content": "extracted text or JSON"}}]
          }
        }
      ]
    }
    """
    results = raw.get("results")
    if not isinstance(results, list) or not results:
        return ""

    extracted_parts = []
    for page_result in results:
        if not isinstance(page_result, dict):
            continue
        if not page_result.get("success"):
            err = page_result.get("error", "unknown")
            logger.warning("OCR page failed: %s", err)
            continue

        message = page_result.get("message")
        if not isinstance(message, dict):
            continue

        choices = message.get("choices")
        if not isinstance(choices, list) or not choices:
            continue

        content = ""
        first_choice = choices[0]
        if isinstance(first_choice, dict):
            msg = first_choice.get("message") or {}
            if isinstance(msg, dict):
                content = msg.get("content") or ""

        if not content:
            continue

        content = content.strip()

        # Try to parse JSON response {"natural_text": "..."}
        if content.startswith("{"):
            try:
                parsed = _json.loads(content)
                if isinstance(parsed, dict):
                    for key in ("natural_text", "text", "markdown", "content", "result"):
                        val = parsed.get(key)
                        if isinstance(val, str) and val.strip():
                            content = val.strip()
                            break
                    else:
                        continue  # All keys empty
            except (_json.JSONDecodeError, ValueError):
                pass

        extracted_parts.append(content)

    return "\n".join(extracted_parts)


def _parse_chat_response(raw: dict) -> str:
    """Extract text from /v1/chat/completions response.

    The model may return either:
      - Plain Markdown text
      - A JSON string like: {"natural_text": "..."}
    Both shapes are handled here.
    """
    choices = raw.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""

    content = ""
    first_choice = choices[0]
    if isinstance(first_choice, dict):
        msg = first_choice.get("message") or {}
        if isinstance(msg, dict):
            content = msg.get("content") or ""
        # Handle finish_reason for safety
        finish_reason = first_choice.get("finish_reason", "")
        if finish_reason == "content_filter":
            logger.warning("Typhoon OCR: content filtered by safety policy")
            return ""

    if not content:
        return ""

    content = content.strip()

    # Strip markdown image placeholders the model sometimes adds (![...](image.png))
    content = re.sub(r"!\[.*?\]\(.*?\)", "", content)
    # Strip free-text summary sections like "**Text Recognition:**" or "**Final Summary:**"
    # that the model adds when it goes beyond pure OCR
    content = re.sub(
        r"\*\*(Text Recognition|Final Summary|Image Description|Summary)[:\s*]*\*\*.*",
        "",
        content,
        flags=re.DOTALL | re.IGNORECASE,
    )
    content = content.strip()

    # Try to parse JSON response {"natural_text": "..."}
    if content.startswith("{"):
        try:
            parsed = _json.loads(content)
            if isinstance(parsed, dict):
                for key in ("natural_text", "text", "markdown", "content", "result"):
                    val = parsed.get(key)
                    if isinstance(val, str) and val.strip():
                        return val.strip()
                # All known keys are empty/missing — treat as no text extracted.
                # Return "" so the caller's empty-text guard triggers fallback
                # instead of leaking {"natural_text": ""} as literal OCR output.
                return ""
        except (_json.JSONDecodeError, ValueError):
            pass

    return content