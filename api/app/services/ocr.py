"""AI for Thai OCR / Handwritten Text Recognition client."""

from __future__ import annotations

import httpx

from app.config import get_settings
from app.services.base import ServiceResult
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def extract_text(image_bytes: bytes) -> ServiceResult:
    """Extract text from an image using AI for Thai OCR API.

    Handles both handwritten and printed Thai text.
    """
    settings = get_settings()
    if not settings.aiforthai_api_key:
        return ServiceResult(service="ocr", ok=False, error="Missing AIFORTHAI_API_KEY")

    url = f"{settings.aiforthai_base_url.rstrip('/')}/handwritten"
    headers = {"Apikey": settings.aiforthai_api_key, "X-lib": "ai4thai-lib"}
    files = {"file": ("image.jpg", image_bytes, "image/jpeg")}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, files=files)
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning("OCR HTTP %s: %s", resp.status_code, resp.text[:300])
                raw_dict = raw if isinstance(raw, dict) else {}
                api_msg = raw_dict.get("message") or raw_dict.get("error") or ""
                return ServiceResult(
                    service="ocr",
                    ok=False,
                    error=f"HTTP {resp.status_code}{': ' + api_msg if api_msg else ''}",
                    raw=raw_dict,
                )

            raw_dict = raw if isinstance(raw, dict) else {}
            if raw_dict.get("errmsg"):
                err = str(raw_dict["errmsg"])[:300]
                logger.warning("OCR server error: %s", err)
                return ServiceResult(
                    service="ocr",
                    ok=False,
                    error=err,
                    raw=raw_dict,
                )

            text = _extract_text(raw_dict)
            return ServiceResult(
                service="ocr",
                ok=True,
                text=text,
                raw=raw_dict,
            )
    except httpx.TimeoutException:
        return ServiceResult(service="ocr", ok=False, error="timeout")
    except Exception as exc:
        logger.exception("OCR call failed")
        return ServiceResult(service="ocr", ok=False, error=str(exc))


def _extract_text(raw: dict) -> str | None:
    for key in ("text", "content", "result", "message", "output"):
        val = raw.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
        if isinstance(val, list) and val:
            parts = [v.get("text") or v.get("content") or str(v) for v in val if isinstance(v, dict)]
            if parts:
                return " ".join(p.strip() for p in parts if p.strip())

    # /handwritten returns per-character detections, not a text field:
    #   {"objects":[{"bbox":{"xLeftTop":31,...},"class":"๗","score":"0.58"}, ...]}
    # Rebuild reading order by sorting left-to-right within top-to-bottom lines.
    objects = raw.get("objects")
    if isinstance(objects, list) and objects:
        chars = []
        for o in objects:
            if not isinstance(o, dict):
                continue
            ch = o.get("class")
            if ch is None or str(ch) == "":
                continue
            box = o.get("bbox") or {}
            try:
                x = float(box.get("xLeftTop", 0))
                y = float(box.get("yLeftTop", 0))
            except (TypeError, ValueError):
                x = y = 0.0
            chars.append((y, x, str(ch)))
        if not chars:
            return None
        # group into lines using a tolerance relative to glyph spread
        chars.sort(key=lambda c: (c[0], c[1]))
        lines: list[list[tuple[float, float, str]]] = []
        tol = 12.0
        for c in chars:
            if lines and abs(c[0] - lines[-1][0][0]) <= tol:
                lines[-1].append(c)
            else:
                lines.append([c])
        out = []
        for line in lines:
            line.sort(key=lambda c: c[1])
            out.append("".join(c[2] for c in line))
        text = "\n".join(out).strip()
        return text or None
    return None
