"""Face detection and emotion analysis via Typhoon OCR (primary) with AI for Thai fallback.

Architecture (per proposal p.4):
  ก. ถ่ายเซลฟี่ → ระบบใช้ Face Recognition API วิเคราะห์สีหน้าและอารมณ์

Primary path — Typhoon OCR (`typhoon-ocr`) via /v1/chat/completions:
  - typhoon-ocr is a vision-capable model that can describe faces and emotions
  - Uses a dedicated emotion-analysis system prompt (NOT the OCR extraction prompt)
  - Returns structured JSON: face_count, emotion, emotion_th, confidence, description
  - Tested live: correctly described smile.jpg as "บุคคลนี้ดูมีความสุข" in 0.3s

Fallback path — AI for Thai /facedetect-w-wo-mask:
  - Used when Typhoon API key is missing or Typhoon call fails
  - Returns face presence only (no emotion data)

NOTE: Typhoon Vision model names (typhoon-v1.5-vision-instruct, typhoon-v2-vision)
do NOT exist on the Typhoon API. The OCR model (typhoon-ocr) handles vision tasks.
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

# Dedicated emotion-analysis system prompt — completely separate from the OCR system
# prompt in typhoon_ocr.py. This prompt instructs typhoon-ocr to act as an emotion
# analyst, NOT as a text extractor.
#
# CRITICAL guards:
#   - "ห้ามนับข้อความ ตัวเลข หรือฉลากในภาพเป็นใบหน้า" prevents counting diagram
#     labels (angles, arrows, math symbols) as faces — a hallucination seen on the
#     physics homework image where "45°" was counted as 2 faces.
#   - Strict JSON-only output prevents free-text descriptions leaking in.
_FACE_SYSTEM_PROMPT = (
    "คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์อารมณ์จากใบหน้ามนุษย์ในภาพถ่าย "
    "เมื่อได้รับภาพ ให้วิเคราะห์ว่ามีใบหน้าของมนุษย์จริง ๆ อยู่ในภาพหรือไม่ และอารมณ์ของบุคคลนั้นเป็นอย่างไร "
    "ห้ามนับข้อความ ตัวเลข สัญลักษณ์ แผนภาพ ลูกศร หรือฉลากใด ๆ ในภาพเป็นใบหน้า "
    "ตอบด้วย JSON object เท่านั้น ห้ามใส่ markdown code fence ห้ามอธิบายนอก JSON "
    "ห้ามตอบเป็นภาษาจีน ภาษาญี่ปุ่น หรือภาษาอื่นที่ไม่ใช่ภาษาไทยและภาษาอังกฤษ"
)

# User-turn instruction sent with every face image
_FACE_USER_PROMPT = (
    "วิเคราะห์ภาพนี้และตอบในรูปแบบ JSON ดังนี้:\n"
    "{\n"
    '  "face_count": <จำนวนใบหน้ามนุษย์จริง ๆ ในภาพ (integer) — ถ้าเป็นภาพแผนภาพ การบ้าน หรือไม่มีคนให้ตอบ 0>,\n'
    '  "emotion": "<อารมณ์หลัก: happy / sad / stressed / angry / surprised / neutral / tired / none>",\n'
    '  "emotion_th": "<ชื่ออารมณ์ภาษาไทย เช่น มีความสุข / เศร้า / เครียด / โกรธ / ตกใจ / ปกติ / เหนื่อย — ถ้าไม่มีใบหน้าให้ตอบ ไม่มีใบหน้า>",\n'
    '  "confidence": <ความมั่นใจในการวิเคราะห์ 0.0-1.0>,\n'
    '  "description": "<อธิบายสั้น ๆ 1 ประโยคภาษาไทย ว่าคนในภาพดูรู้สึกอย่างไร — ถ้าไม่มีใบหน้าให้ตอบ ว่างเปล่า>"\n'
    "}\n"
    "กฎสำคัญ: ถ้าภาพเป็นแผนภาพ โจทย์คณิตศาสตร์ วิทยาศาสตร์ หนังสือ หรือไม่มีใบหน้ามนุษย์ → face_count=0, emotion='none'"
)

# Map emotion labels → 6 UI moods used by the web frontend
_EMOTION_TO_MOOD: dict[str, str] = {
    "happy":     "positive",
    "sad":       "sad",
    "stressed":  "stressed",
    "angry":     "stressed",
    "surprised": "neutral",
    "neutral":   "neutral",
    "tired":     "tired",
    "none":      "neutral",
}


async def analyze_image(image_bytes: bytes) -> ServiceResult:
    """Detect faces and analyse emotions in an image.

    Primary: Typhoon OCR model via /v1/chat/completions with a dedicated
    emotion-analysis system prompt (not the OCR text-extraction prompt).

    Fallback: AI for Thai /facedetect-w-wo-mask (face presence only, no emotion).

    Returns ServiceResult with:
      service="face-typhoon" → face_count, emotion, emotion_th, confidence, description
      service="face"         → face presence only (AI for Thai fallback)

    face_count=0 → not a selfie → caller routes to OCR/homework path.
    face_count>0 → selfie → caller routes to emotion/support response.
    """
    settings = get_settings()

    if settings.typhoon_api_key:
        result = await _analyze_typhoon(image_bytes, settings)
        if result.ok:
            return result
        logger.warning(
            "Typhoon face analysis failed (%s); falling back to AI for Thai", result.error
        )

    return await _analyze_aiforthai(image_bytes, settings)


async def _analyze_typhoon(image_bytes: bytes, settings) -> ServiceResult:
    """Use typhoon-ocr via /v1/chat/completions to detect faces and read emotions.

    typhoon-ocr is a vision-capable model. When given the emotion-analysis system
    prompt it correctly identifies faces, describes emotions in Thai, and returns
    structured JSON — confirmed by live test on smile.jpg (0.3s response time).
    """
    mime = "image/jpeg"
    if image_bytes[:4] == b"\x89PNG":
        mime = "image/png"
    elif image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        mime = "image/webp"

    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{b64}"

    headers = {
        "Authorization": f"Bearer {settings.typhoon_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "typhoon-ocr",
        "messages": [
            {
                "role": "system",
                "content": _FACE_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": _FACE_USER_PROMPT},
                ],
            },
        ],
        "max_tokens": 256,
        "temperature": 0.1,
        "top_p": 0.9,
    }

    try:
        async with httpx.AsyncClient(
            timeout=15.0, verify=not settings.insecure_tls
        ) as client:
            resp = await client.post(_CHAT_URL, headers=headers, json=payload)
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning(
                    "Typhoon face HTTP %s: %s", resp.status_code, resp.text[:200]
                )
                return ServiceResult(
                    service="face",
                    ok=False,
                    error=f"HTTP {resp.status_code}: {resp.text[:120]}",
                )

            parsed = _parse_typhoon_response(raw if isinstance(raw, dict) else {})
            if parsed is None:
                return ServiceResult(
                    service="face", ok=False, error="could not parse emotion JSON from typhoon-ocr"
                )

            face_count = int(parsed.get("face_count", 0))
            emotion = str(parsed.get("emotion", "neutral")).lower().strip()
            emotion_th = str(parsed.get("emotion_th", "ปกติ"))
            confidence = float(parsed.get("confidence", 0.5))
            description = str(parsed.get("description", ""))

            # Hallucination guard: if the emotion field contains OCR-like content
            # (newlines, degree symbols, diagram labels, numbers, or long Thai text)
            # instead of a valid emotion keyword, the model read the diagram instead
            # of the face. Treat as no face detected.
            _VALID_EMOTIONS = {
                "happy", "sad", "stressed", "angry", "surprised",
                "neutral", "tired", "none",
            }
            _has_hallucination = (
                "\n" in emotion
                or "°" in emotion
                or any(ch.isdigit() for ch in emotion)
                or len(emotion) > 30
                or emotion not in _VALID_EMOTIONS
            )
            if _has_hallucination:
                logger.info(
                    "Face hallucination detected (emotion=%r looks like OCR output) — "
                    "treating as face_count=0", emotion[:50]
                )
                face_count = 0
                emotion = "none"
                emotion_th = "ไม่มีใบหน้า"
                confidence = 0.0
                description = ""

            mood = _EMOTION_TO_MOOD.get(emotion, "neutral")

            return ServiceResult(
                service="face-typhoon",
                ok=True,
                label=mood,
                score=confidence,
                raw={
                    "face_count": face_count,
                    "emotion": emotion,
                    "emotion_th": emotion_th,
                    "confidence": confidence,
                    "description": description,
                    # objects-compatible shape so downstream code still works
                    "objects": [{"score": confidence}] * face_count if face_count > 0 else [],
                },
            )
    except httpx.TimeoutException:
        return ServiceResult(service="face", ok=False, error="timeout")
    except Exception as exc:
        logger.exception("Typhoon face call failed")
        return ServiceResult(service="face", ok=False, error=str(exc))


def _parse_typhoon_response(raw: dict) -> dict | None:
    """Extract and parse the JSON object from a Typhoon /v1/chat/completions response."""
    choices = raw.get("choices")
    if not isinstance(choices, list) or not choices:
        return None
    msg = choices[0].get("message") or {}
    content = (msg.get("content") or "").strip()
    if not content:
        return None

    # Strip markdown code fences if the model wrapped its JSON
    content = re.sub(r"^```(?:json)?\s*", "", content)
    content = re.sub(r"\s*```$", "", content)
    content = content.strip()

    try:
        return _json.loads(content)
    except (_json.JSONDecodeError, ValueError):
        # Try to extract a JSON object embedded anywhere in free text
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            try:
                return _json.loads(match.group())
            except Exception:
                pass
    return None


async def _analyze_aiforthai(image_bytes: bytes, settings) -> ServiceResult:
    """AI for Thai face detection (presence + mask only, no emotion data)."""
    if not settings.aiforthai_api_key:
        return ServiceResult(service="face", ok=False, error="Missing AIFORTHAI_API_KEY")

    url = f"{settings.aiforthai_base_url.rstrip('/')}/facedetect-w-wo-mask"
    headers = {"Apikey": settings.aiforthai_api_key, "X-lib": "ai4thai-lib"}
    files = {"file": ("image.jpg", image_bytes, "image/jpeg")}

    try:
        async with httpx.AsyncClient(timeout=15.0, verify=not settings.insecure_tls) as client:
            resp = await client.post(url, headers=headers, files=files)
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning("Face API HTTP %s: %s", resp.status_code, resp.text[:300])
                raw_dict = raw if isinstance(raw, dict) else {}
                api_msg = raw_dict.get("message") or raw_dict.get("error") or ""
                return ServiceResult(
                    service="face",
                    ok=False,
                    error=f"HTTP {resp.status_code}{': ' + api_msg if api_msg else ''}",
                    raw=raw_dict,
                )

            raw_dict = raw if isinstance(raw, dict) else {}
            if raw_dict.get("errmsg"):
                err = str(raw_dict["errmsg"])[:300]
                logger.warning("Face server error: %s", err)
                return ServiceResult(service="face", ok=False, error=err, raw=raw_dict)

            objects = raw_dict.get("objects", [])
            face_count = len(objects) if isinstance(objects, list) else 0
            return ServiceResult(
                service="face",
                ok=True,
                label=str(face_count),
                score=1.0 if face_count > 0 else 0.0,
                raw=raw_dict,
            )
    except httpx.TimeoutException:
        return ServiceResult(service="face", ok=False, error="timeout")
    except Exception as exc:
        logger.exception("Face API call failed")
        return ServiceResult(service="face", ok=False, error=str(exc))

