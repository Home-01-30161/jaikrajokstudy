"""Typhoon OCR client (SCB 10X) - uses /v1/chat/completions with base64 image.

The /v1/ocr multipart endpoint wraps this internally but adds 100+ second latency
because it defaults to max_tokens=16384. Calling /v1/chat/completions directly
with max_tokens=4096 completes in ~1-5 seconds.

Model: typhoon-ocr (v1.5, recommended) with typhoon-ocr-preview (v1, legacy) fallback.
Rate limit: 2 req/s, 20 req/min.
"""

from __future__ import annotations

import base64
import json as _json

import httpx

from app.config import get_settings
from app.services.base import ServiceResult
from app.utils.logging import get_logger

logger = get_logger(__name__)

_CHAT_URL = "https://api.opentyphoon.ai/v1/chat/completions"

# Default OCR prompt — instructs the model to extract text.
# The web_chat endpoint can pass a custom user_prompt to ask a specific question
# about the image content (e.g. "explain step 2" or "solve this problem").
_DEFAULT_PROMPT = (
    "อ่านข้อความทั้งหมดในภาพนี้ให้ครบถ้วน "
    "ถ้ามีสมการหรือสูตรคณิตศาสตร์ให้แสดงให้ชัดเจน "
    "ตอบเป็นข้อความล้วน ไม่ต้องใส่คำอธิบายเพิ่มเติม"
)


async def extract_text_typhoon(
    image_bytes: bytes,
    filename: str = "image.jpg",
    user_prompt: str | None = None,
) -> ServiceResult:
    """Extract text from image using Typhoon OCR via /v1/chat/completions.

    Uses base64-encoded image in a vision message — much faster than the
    /v1/ocr multipart endpoint (1-5s vs 100+s) because we control max_tokens.

    Args:
        image_bytes: Raw image bytes (JPEG or PNG).
        filename: Original filename (used only for MIME type detection).
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

    # Detect MIME type from filename extension
    fname_lower = (filename or "").lower()
    mime = "image/png" if fname_lower.endswith(".png") else "image/jpeg"
    b64_image = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{b64_image}"

    prompt = user_prompt.strip() if user_prompt and user_prompt.strip() else _DEFAULT_PROMPT

    headers = {
        "Authorization": f"Bearer {settings.typhoon_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "typhoon-ocr-preview",   # v1 — widely available; swap to "typhoon-ocr" if quota allows
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "max_tokens": 4096,
        "temperature": 0.1,
        "top_p": 0.6,
        "repetition_penalty": 1.2,
    }

    try:
        async with httpx.AsyncClient(
            timeout=60.0, verify=not settings.insecure_tls
        ) as client:
            resp = await client.post(_CHAT_URL, headers=headers, json=payload)

            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                err = ""
                if isinstance(raw, dict):
                    err = (raw.get("error") or {}).get("message", "")
                if not err:
                    err = f"HTTP {resp.status_code}"
                logger.warning("Typhoon OCR HTTP %s: %s", resp.status_code, str(raw)[:200])
                return ServiceResult(
                    service="typhoon-ocr",
                    ok=False,
                    error=err,
                    raw=raw if isinstance(raw, dict) else {},
                )

            extracted_text = _parse_chat_response(raw if isinstance(raw, dict) else {})

            if not extracted_text:
                logger.warning("Typhoon OCR returned empty text")
                return ServiceResult(
                    service="typhoon-ocr",
                    ok=False,
                    error="empty response",
                    raw=raw if isinstance(raw, dict) else {},
                )

            return ServiceResult(
                service="typhoon-ocr",
                ok=True,
                text=extracted_text,
                raw=raw if isinstance(raw, dict) else {},
            )

    except httpx.TimeoutException:
        return ServiceResult(service="typhoon-ocr", ok=False, error="timeout")
    except Exception as exc:
        logger.exception("Typhoon OCR call failed")
        return ServiceResult(service="typhoon-ocr", ok=False, error=str(exc))


def _parse_chat_response(raw: dict) -> str:
    """Extract text from /v1/chat/completions response.

    The model returns either plain text or a JSON string like:
        {"natural_text": "..."}
    Both are handled here.
    """
    choices = raw.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""

    content = ""
    msg = choices[0].get("message") or {}
    if isinstance(msg, dict):
        content = msg.get("content") or ""

    if not content:
        return ""

    # Try to parse JSON response {"natural_text": "..."}
    content = content.strip()
    if content.startswith("{"):
        try:
            parsed = _json.loads(content)
            if isinstance(parsed, dict):
                return (
                    parsed.get("natural_text")
                    or parsed.get("text")
                    or parsed.get("markdown")
                    or content
                )
        except (_json.JSONDecodeError, ValueError):
            pass

    return content