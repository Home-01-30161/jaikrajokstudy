"""Typhoon OCR client (SCB 10X) - uses /v1/chat/completions with base64 image.

The /v1/ocr multipart endpoint wraps this internally but adds 100+ second latency
because it defaults to max_tokens=16384. Calling /v1/chat/completions directly
with max_tokens=4096 completes in ~1-5 seconds.

Model: typhoon-ocr (v1.5, recommended) with typhoon-ocr-preview (v1, legacy) fallback.
Rate limit: 2 req/s, 20 req/min.

NOTE: OpenCV has been removed from image_prep.py — all preprocessing now uses
PIL only. This eliminates the opencv-python-headless dependency which was
conflicting with the headless container environment and causing import errors
that silently degraded OCR quality.
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
    "You are an OCR engine. Extract ALL text visible in this image exactly as it appears. "
    "Output language: Thai and English only. NEVER output Chinese, Japanese, or any other language. "
    "If the image contains a diagram, figure, or free-body diagram: "
    "describe all labels, angles, measurements, arrows, and forces in Thai. "
    "Format rules: "
    "- Mathematical equations: use $...$ for inline and $$...$$ for block LaTeX. "
    "- Include ALL text: headings, body, labels, choices (ก. ข. ค. ง.), numbers, units. "
    "- Do NOT skip, summarize, or add commentary. Transcribe verbatim. "
    "- Do NOT output Chinese or Japanese characters under any circumstances."
)

_DEFAULT_USER_PROMPT = (
    "Extract all text from this image exactly as it appears. "
    "Return clean Markdown only — no explanations, no commentary."
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
    """Extract text from image using Typhoon OCR via /v1/chat/completions.

    Uses base64-encoded image in a vision message — much faster than the
    /v1/ocr multipart endpoint (1-5s vs 100+s) because we control max_tokens.

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, or WebP).
        filename: Original filename (used for MIME type detection).
        user_prompt: Optional custom question about the image. If None, the
                     default OCR extraction prompt is used as the user turn.
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

    mime = _detect_mime(filename, image_bytes)
    b64_image = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{b64_image}"

    user_text = (user_prompt.strip() if user_prompt and user_prompt.strip()
                 else _DEFAULT_USER_PROMPT)

    headers = {
        "Authorization": f"Bearer {settings.typhoon_api_key}",
        "Content-Type": "application/json",
    }

    # Build payload — system + user message with image attachment.
    # The Typhoon OCR /v1/chat/completions endpoint is OpenAI-vision-compatible:
    # image_url content blocks are supported in user messages.
    payload = {
        "model": _OCR_MODELS[0],   # typhoon-ocr (v1.5)
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

    # Try primary model, then fall back to preview model on 404/422/quota errors.
    for model in _OCR_MODELS:
        payload["model"] = model
        try:
            async with httpx.AsyncClient(
                timeout=90.0, verify=not settings.insecure_tls
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
                        "Typhoon OCR [%s] HTTP %s: %s",
                        model, resp.status_code, str(raw)[:300],
                    )
                    last_error = err_msg
                    # On model-not-found or quota errors, try next model
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
                    logger.warning("Typhoon OCR [%s] returned empty text", model)
                    last_error = "empty response"
                    continue

                logger.info("Typhoon OCR succeeded with model=%s", model)
                return ServiceResult(
                    service="typhoon-ocr",
                    ok=True,
                    text=extracted_text,
                    raw=raw_dict,
                )

        except httpx.TimeoutException:
            logger.warning("Typhoon OCR [%s] timed out", model)
            last_error = "timeout"
            continue
        except Exception as exc:
            logger.exception("Typhoon OCR [%s] call failed", model)
            last_error = str(exc)
            continue

    return ServiceResult(service="typhoon-ocr", ok=False, error=last_error)


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