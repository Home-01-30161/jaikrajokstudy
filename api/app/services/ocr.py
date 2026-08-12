"""OCR client for JaiKrajok homework photos.

Fallback chain:
  1. Typhoon OCR (SCB 10X) — fast, handles complex diagrams and Thai text
  2. AI for Thai Document OCR (/ocr, /ocr/tocr, /ocr/deepocr)
  3. AI for Thai VQA — final fallback for images the other services reject
"""

from __future__ import annotations

import httpx

from app.config import get_settings
from app.services.base import ServiceResult
from app.services.image_prep import prepare_for_ocr
from app.services.typhoon_ocr import extract_text_typhoon
from app.utils.logging import get_logger

logger = get_logger(__name__)

# Pathumma VQA vision model: transcribes whole images in one call, unlike the
# /handwritten detector (per-character bbox model) which crashes with
# "local variable 'roi' referenced before assignment" on complex images.
VQA_URL = "https://api.aiforthai.in.th/vqa/inference/"
VQA_QUERY = (
    "อ่านข้อความลายมือในภาพนี้ให้หน่อย แปลงเป็นข้อความภาษาไทย "
    "ตอบเฉพาะข้อความที่อ่านได้เท่านั้น"
)


# Document OCR tiers. Probing showed /ocr and /ocr/tocr exist on the gateway
# (they return 413/502/429 rather than 404), while /tocr, /deepocr and friends
# route to gRPC services that reject multipart. Each tier is tried in turn so a
# single broken upstream cannot take the whole homework feature down.
TOCR_CANDIDATES = ("/ocr", "/ocr/tocr", "/ocr/deepocr")

# The AI for Thai gateway rate-limits the free tier aggressively; a document
# larger than roughly 1 MB is rejected outright with 413.
_OCR_MAX_BYTES = 900_000


async def transcribe_image(image_bytes: bytes, user_prompt: str | None = None) -> ServiceResult:
    """Transcribe an image, trying each OCR backend until one returns text.

    Order: Typhoon OCR (SCB 10X) -> AI for Thai Document OCR -> AI for Thai VQA.

    Args:
        image_bytes: Raw image bytes.
        user_prompt: Optional question/instruction about the image content.
                     Passed to Typhoon OCR so it can answer specific questions
                     (e.g. "explain step 2", "solve this maths problem").
                     Falls back to default OCR extraction when None.

    Applies automatic image preprocessing before sending to OCR APIs.
    """
    errors: list[str] = []

    # Preprocess image to improve OCR accuracy
    try:
        image_bytes = prepare_for_ocr(image_bytes, enhance="auto")
    except Exception as e:
        logger.warning("Image preprocessing failed: %s", e)
        # Continue with original image if preprocessing fails

    # Try Typhoon OCR first (avoids AI for Thai "roi" errors).
    # Pass filename hint so MIME detection works correctly.
    typhoon = await extract_text_typhoon(image_bytes, filename="image.jpg", user_prompt=user_prompt)
    if typhoon.ok and (typhoon.text or "").strip():
        return typhoon
    errors.append(f"typhoon: {typhoon.error}")
    logger.warning("Typhoon OCR failed (%s); trying AI for Thai document OCR", typhoon.error)

    # Fallback to AI for Thai document OCR
    doc = await extract_text_document(image_bytes)
    if doc.ok and (doc.text or "").strip():
        return doc
    errors.append(f"doc: {doc.error}")
    logger.warning("Document OCR failed (%s); falling back to VQA", doc.error)

    # Final fallback to VQA
    vqa = await extract_text_vqa(image_bytes)
    if vqa.ok and (vqa.text or "").strip():
        return vqa
    errors.append(f"vqa: {vqa.error}")

    return ServiceResult(
        service="ocr", ok=False, error="all OCR backends failed -> " + "; ".join(errors)
    )


async def extract_text_document(image_bytes: bytes) -> ServiceResult:
    """Try the AI for Thai document OCR routes (T-OCR / DeepOCR) in order."""
    settings = get_settings()
    if not settings.aiforthai_api_key:
        return ServiceResult(service="ocr", ok=False, error="Missing AIFORTHAI_API_KEY")

    if len(image_bytes) > _OCR_MAX_BYTES:
        return ServiceResult(
            service="ocr", ok=False, error="image too large for document OCR"
        )

    base = settings.aiforthai_base_url.rstrip("/")
    headers = {"Apikey": settings.aiforthai_api_key, "X-lib": "ai4thai-lib"}
    errors: list[str] = []

    try:
        async with httpx.AsyncClient(
            timeout=20.0, verify=not settings.insecure_tls
        ) as client:
            for path in TOCR_CANDIDATES:
                try:
                    resp = await client.post(
                        base + path,
                        headers=headers,
                        files={"file": ("image.jpg", image_bytes, "image/jpeg")},
                    )
                except httpx.TimeoutException:
                    errors.append(f"{path}: timeout")
                    continue

                body = resp.text.strip()
                if resp.status_code >= 400:
                    errors.append(f"{path}: HTTP {resp.status_code}")
                    continue

                # The gateway sometimes answers 200 with a bare upstream status
                # code (e.g. "404") when the backing service is unavailable.
                if body.isdigit():
                    errors.append(f"{path}: upstream {body}")
                    continue

                try:
                    raw = resp.json()
                except Exception:
                    if body:
                        return ServiceResult(
                            service="ocr", ok=True, text=body, raw={"text": body}
                        )
                    errors.append(f"{path}: empty body")
                    continue

                raw_dict = raw if isinstance(raw, dict) else {}
                if raw_dict.get("errmsg"):
                    errors.append(f"{path}: {str(raw_dict['errmsg'])[:120]}")
                    continue

                text = _extract_text(raw_dict)
                if text:
                    logger.info("Document OCR succeeded via %s", path)
                    return ServiceResult(
                        service="ocr", ok=True, text=text, raw=raw_dict
                    )
                errors.append(f"{path}: no text")
    except Exception as exc:
        logger.exception("Document OCR call failed")
        return ServiceResult(service="ocr", ok=False, error=str(exc))

    return ServiceResult(service="ocr", ok=False, error="; ".join(errors) or "no backend")


async def extract_text_vqa(image_bytes: bytes) -> ServiceResult:
    """Transcribe an image with the Pathumma VQA vision model."""
    settings = get_settings()
    if not settings.aiforthai_api_key:
        return ServiceResult(service="ocr", ok=False, error="Missing AIFORTHAI_API_KEY")

    headers = {"Apikey": settings.aiforthai_api_key, "X-lib": "ai4thai-lib"}
    files = {"file": ("image.jpg", image_bytes, "image/jpeg")}
    data = {"query": VQA_QUERY}

    try:
        async with httpx.AsyncClient(
            timeout=30.0, verify=not settings.insecure_tls
        ) as client:
            resp = await client.post(VQA_URL, headers=headers, files=files, data=data)
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning("VQA HTTP %s: %s", resp.status_code, resp.text[:300])
                raw_dict = raw if isinstance(raw, dict) else {}
                api_msg = raw_dict.get("message") or raw_dict.get("error") or ""
                return ServiceResult(
                    service="ocr",
                    ok=False,
                    error=f"HTTP {resp.status_code}{': ' + api_msg if api_msg else ''}",
                    raw=raw_dict,
                )

            raw_dict = raw if isinstance(raw, dict) else {}
            text = _extract_vqa_text(raw_dict)
            if not text:
                return ServiceResult(
                    service="ocr",
                    ok=False,
                    error="empty VQA reply",
                    raw=raw_dict,
                )
            return ServiceResult(
                service="ocr",
                ok=True,
                text=text,
                raw=raw_dict,
            )
    except httpx.TimeoutException:
        return ServiceResult(service="ocr", ok=False, error="timeout")
    except Exception as exc:
        logger.exception("VQA call failed")
        return ServiceResult(service="ocr", ok=False, error=str(exc))


def _extract_vqa_text(raw: dict) -> str | None:
    for key in ("content", "text", "result", "answer", "output", "message"):
        val = raw.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
        if isinstance(val, list) and val:
            parts = [v.get("content") or v.get("text") or str(v) for v in val if isinstance(v, dict)]
            if parts:
                return " ".join(p.strip() for p in parts if p.strip())
    return None


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
