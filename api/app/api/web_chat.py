"""Web chat API endpoints for the JaiKrajok frontend.

Covers the four chat modes the UI offers (text / selfie / voice / homework
photo), plus the trend and school views. Every mode ends in the same place: a
mood label the UI can render and an LLM reply written for that mood.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field

from app import store
from app.services import face, mood as mood_svc, ocr, pathumma, stt, tts
from app.services.sentiment import analyze_sentiment
from app.utils.security import create_session, enforce_rate_limit, require_session

router = APIRouter(tags=["web"], dependencies=[Depends(enforce_rate_limit)])

# Upload guard: keep the amount handed to an upstream AI service bounded even
# when the multipart parser has already accepted the request body.
_MAX_UPLOAD_BYTES = 8 * 1024 * 1024
_MAX_MESSAGE_CHARS = 2000
_MAX_OCR_CHARS = 4000
_MAX_TTS_CHARS = 300

# Crisis detection is deliberately a literal phrase list, not a model call.
# Probing showed /ssense scores "อยากตาย ไม่อยากอยู่แล้ว" as neutral (score 0,
# polarity ""), so sentiment cannot be trusted to catch self-harm language --
# this list is the real safety net and must stand on its own.
# False positives here are cheap (a student sees a hotline they did not need);
# false negatives are not. When in doubt, add the phrase.
CRISIS_KEYWORDS = (
    # explicit
    "ฆ่าตัวตาย", "อยากตาย", "ทำร้ายตัวเอง", "ไม่อยากอยู่", "อยากหายไป",
    "ไม่อยากมีชีวิต", "ไม่อยากตื่น", "จบชีวิต", "ตายไปเลยดีกว่า", "หายไปเลยดีกว่า",
    "ไม่อยากอยู่ต่อ", "อยากจบทุกอย่าง", "ขอตาย", "อยากนอนไม่ตื่น",
    # self-harm methods / acts
    "กรีดแขน", "กรีดข้อมือ", "ทำร้ายร่างกายตัวเอง", "กินยาเกินขนาด",
    # hopelessness that commonly precedes it
    "ไม่มีใครสนใจถ้าฉันตาย", "อยู่ไปก็ไร้ค่า", "เป็นภาระของทุกคน",
    "ไม่มีทางออก", "หมดหวังแล้ว",
    # English, since Thai students code-switch
    "kill myself", "want to die", "end my life", "suicide", "self harm",
)
CRISIS_REPLY = (
    "เราห่วงใยคุณมากนะ ตอนนี้คุณไม่ได้อยู่คนเดียว "
    "โปรดติดต่อสายด่วนสุขภาพจิต 1323 (ฟรี 24 ชั่วโมง) "
    "หรือคนที่ไว้ใจใกล้ตัวด้วยนะ"
)


def is_crisis(text: str) -> bool:
    """True when the text contains self-harm language.

    Matching is case-insensitive and ignores spaces so that "อยาก ตาย" or
    "Want To Die" are not missed by a bare substring test.
    """
    lowered = (text or "").lower()
    stripped = lowered.replace(" ", "")
    return any(k in lowered or k.replace(" ", "") in stripped for k in CRISIS_KEYWORDS)


class HistoryMessage(BaseModel):
    role: str  # "user" | "bot"
    text: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=_MAX_MESSAGE_CHARS)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    reply: str
    emotion: str | None = None
    mood: str = "neutral"
    confidence: float | None = None
    crisis: bool = False
    concern_streak: int = 0  # consecutive negative mood count (proposal p.11 alert)
    service: str = "sentiment+llm"
    degraded: list[str] = Field(default_factory=list)


class EmotionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=_MAX_MESSAGE_CHARS)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=_MAX_TTS_CHARS)


class EmotionResponse(BaseModel):
    emotion: str
    polarity: str
    confidence: float
    mood: str = "neutral"


class AnalysisResponse(BaseModel):
    """Shared shape for the three upload-driven modes."""

    ok: bool
    mood: str = "neutral"
    reply: str
    detail: str | None = None
    transcript: str | None = None
    service: str
    error: str | None = None


async def _read_upload(upload: UploadFile, *allowed_types: str) -> bytes:
    content_type = (upload.content_type or "").lower()
    if allowed_types and not any(content_type.startswith(t) for t in allowed_types):
        raise HTTPException(status_code=415, detail="Unsupported file type")

    if upload.size is not None and upload.size > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large (max {_MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
        )

    chunks: list[bytes] = []
    total = 0
    while chunk := await upload.read(1024 * 1024):
        total += len(chunk)
        if total > _MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large (max {_MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
            )
        chunks.append(chunk)

    if total == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    return b"".join(chunks)


async def _mood_and_reply(user_id: str, text: str, *, source: str, history: list | None = None) -> tuple[str, str, float | None, list[str]]:
    """Sentiment -> mood -> mood-aware LLM reply. Returns (mood, reply, confidence, degraded)."""
    degraded: list[str] = []

    sentiment_result = await analyze_sentiment(text)
    polarity = score = None
    if sentiment_result.ok and sentiment_result.sentiment:
        polarity = sentiment_result.sentiment.polarity
        score = sentiment_result.sentiment.score
    else:
        degraded.append("sentiment")

    detected = mood_svc.classify(text, polarity, score)

    llm = await pathumma.generate_reply(text, emotion_hint=mood_svc.MOOD_LABELS_TH.get(detected), history=history)
    if llm.ok and llm.text:
        reply = llm.text
    else:
        degraded.append("llm")
        reply = (
            "กระจกยังตอบไม่ได้ตอนนี้ (ระบบ AI ขัดข้องชั่วคราว) "
            "แต่เราอ่านข้อความของคุณแล้วนะ ลองส่งอีกครั้งในอีกสักครู่"
        )

    store.record_mood(user_id, detected, source=source, channel="web", confidence=score,
                      text_confidence=score if source == "text" else None,
                      audio_confidence=score if source == "voice" else None)
    return detected, reply, score, degraded


# The reverse proxy strips /api before the request reaches this container
# (guide s.7/s.15), so routes are declared WITHOUT the /api prefix.
# Public URL: https://team07.aiforthai.in.th/api/chat/send
@router.post("/session")
async def start_session(response: Response, request: Request) -> dict:
    """Issue or refresh the signed pseudonymous browser session cookie."""
    create_session(response, request)
    return {"ok": True}


@router.post("/chat/send")
async def send_message(
    req: ChatRequest,
    user_id: str = Depends(require_session),
) -> ChatResponse:
    """Text mode: sentiment analysis + mood-aware LLM reply."""
    text = req.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(text) > _MAX_MESSAGE_CHARS:
        raise HTTPException(
            status_code=413, detail=f"Message too long (max {_MAX_MESSAGE_CHARS} chars)"
        )

    # Crisis language short-circuits the LLM: a generated reply is not safe here.
    if is_crisis(text):
        store.record_mood(user_id, "sad", source="crisis", channel="web")
        return ChatResponse(
            reply=CRISIS_REPLY, emotion="negative", mood="sad", crisis=True, service="safety"
        )

    detected, reply, score, degraded = await _mood_and_reply(
        user_id, text, source="text", history=[{"role": m.role, "text": m.text} for m in req.history]
    )
    streak = store.concern_streak(user_id)
    return ChatResponse(
        reply=reply,
        emotion="negative" if detected in ("stressed", "sad") else "positive"
        if detected == "positive"
        else "neutral",
        mood=detected,
        confidence=score,
        concern_streak=streak,
        degraded=degraded,
    )


@router.post("/emotion/analyze")
async def analyze_emotion(
    req: EmotionRequest,
    _user_id: str = Depends(require_session),
) -> EmotionResponse:
    """Analyze emotion/sentiment of text."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    result = await analyze_sentiment(req.text)

    if not result.ok or not result.sentiment:
        return EmotionResponse(
            emotion="neutral",
            polarity="neutral",
            confidence=0.5,
            mood=mood_svc.classify(req.text, None, None),
        )

    return EmotionResponse(
        emotion=result.sentiment.label,
        polarity=result.sentiment.polarity,
        confidence=result.sentiment.score,
        mood=mood_svc.classify(
            req.text, result.sentiment.polarity, result.sentiment.score
        ),
    )


@router.post("/selfie/analyze")
async def analyze_selfie(
    file: UploadFile = File(...),
    user_id: str = Depends(require_session),
) -> AnalysisResponse:
    """Selfie mode: emotion analysis via Typhoon Vision (primary) with LLM empathetic reply.
    Falls back to AI for Thai face detection (presence + LLM greeting) if Typhoon unavailable.
    """
    data = await _read_upload(file, "image/")
    result = await face.analyze_image(data)

    if not result.ok:
        return AnalysisResponse(
            ok=False,
            reply="กระจกยังวิเคราะห์ภาพไม่ได้ตอนนี้ ลองอีกครั้งได้นะ",
            service="face",
            error=result.error,
        )

    objects = result.raw.get("objects") or []
    count = len(objects) if isinstance(objects, list) else 0
    if count == 0:
        return AnalysisResponse(
            ok=True,
            reply="กระจกยังไม่เห็นใบหน้าในภาพนี้ ลองถ่ายให้เห็นหน้าชัด ๆ ในที่สว่างอีกครั้งนะ",
            detail="ไม่พบใบหน้าในภาพ",
            service="face",
        )

    # Typhoon Vision path — has real emotion data, generate LLM empathetic reply
    if result.service == "face-typhoon":
        emotion_th = result.raw.get("emotion_th", "ปกติ")
        description = result.raw.get("description", "")
        confidence = result.score or 0.0
        mood = result.label or "neutral"

        detail = f"ตรวจพบใบหน้า {count} ใบหน้า · อารมณ์: {emotion_th} ({confidence:.0%})"

        # Ask LLM to generate a warm empathetic reply based on detected emotion
        llm_prompt = (
            f"ผู้ใช้ส่งรูปเซลฟี่มา จากการวิเคราะห์ใบหน้าพบว่าดูรู้สึก {emotion_th} "
            f"({description}) ความมั่นใจ {confidence:.0%}\n\n"
            "ตอบสนองด้วยความเห็นอกเห็นใจ อบอุ่น 2-3 ประโยคภาษาไทย "
            "สอบถามความรู้สึกและให้กำลังใจ ห้ามใส่ Task List หรือ Mermaid"
        )
        llm = await pathumma.generate_reply(llm_prompt)
        reply = (
            llm.text
            if llm.ok and llm.text
            else (
                f"{description}\n\n"
                f"กระจกอ่านจากสีหน้าว่าคุณดูรู้สึก {emotion_th} นะ "
                f"ถ้าอยากคุยเรื่องนี้เพิ่มเติม พิมพ์มาได้เลย"
            )
        )

        store.record_mood(
            user_id, mood, source="selfie", channel="image",
            face_confidence=confidence,
        )
        return AnalysisResponse(
            ok=True, mood=mood, reply=reply, detail=detail, service="face-typhoon"
        )

    # AI for Thai fallback — no emotion, generate a warm greeting via LLM
    scores = []
    for o in objects if isinstance(objects, list) else []:
        if isinstance(o, dict):
            try:
                scores.append(float(o.get("score", 0)))
            except (TypeError, ValueError):
                pass
    best = max(scores) if scores else None
    detail = f"ตรวจพบใบหน้า {count} ใบหน้า"
    if best is not None:
        detail += f" (ความมั่นใจ {best:.0%})"

    llm = await pathumma.generate_reply(
        "ผู้ใช้ส่งเซลฟี่มา กระจกตรวจพบใบหน้าในภาพ "
        "ตอบทักทายอบอุ่น สอบถามความรู้สึกวันนี้ 2-3 ประโยคภาษาไทย"
    )
    reply = (
        llm.text
        if llm.ok and llm.text
        else (
            f"{detail}\n\n"
            "กระจกอ่านได้แค่ว่ามีใบหน้าอยู่ในภาพนะ ยังอ่านอารมณ์จากสีหน้าไม่ได้ "
            "ถ้าอยากให้เข้าใจความรู้สึกจริง ๆ เล่าเป็นข้อความหรือพูดมาได้เลย"
        )
    )
    store.record_mood(user_id, "neutral", source="selfie", channel="image")
    return AnalysisResponse(
        ok=True,
        reply=reply,
        detail=detail,
        service="face",
    )


@router.post("/voice/transcribe")
async def transcribe_voice(
    file: UploadFile = File(...),
    user_id: str = Depends(require_session),
) -> AnalysisResponse:
    """Voice mode: speech-to-text, then the same mood + reply path as text."""
    data = await _read_upload(file, "audio/", "video/")
    result = await stt.transcribe(
        data,
        filename=file.filename or "voice.webm",
        content_type=file.content_type or "audio/webm",
    )

    if not result.ok or not (result.text or "").strip():
        return AnalysisResponse(
            ok=False,
            reply="กระจกยังฟังเสียงนี้ไม่ออก ลองอัดใหม่ในที่เงียบ ๆ หรือพิมพ์มาก็ได้นะ",
            service="stt",
            error=result.error or "empty transcript",
        )

    transcript = result.text.strip()
    if is_crisis(transcript):
        store.record_mood(user_id, "sad", source="crisis", channel="voice")
        return AnalysisResponse(
            ok=True, mood="sad", reply=CRISIS_REPLY, transcript=transcript, service="safety"
        )

    detected, reply, _, _ = await _mood_and_reply(user_id, transcript, source="voice")
    return AnalysisResponse(
        ok=True, mood=detected, reply=reply, transcript=transcript, service="stt+llm"
    )


@router.post("/homework/ocr")
async def homework_ocr(
    file: UploadFile = File(...),
    caption: str | None = None,
    user_id: str = Depends(require_session),
) -> AnalysisResponse:
    """Homework mode: OCR the photo, then let the LLM help with what it read.

    Args:
        file: Image file to OCR.
        caption: Optional user question typed alongside the image
                 (e.g. "อธิบายข้อ 2" / "solve this problem").
                 When provided, Typhoon OCR is asked the question directly.
                 When omitted, default text-extraction + LLM explain is used.
    """
    data = await _read_upload(file, "image/")

    # ocr.transcribe_image() runs prepare_for_ocr() internally (resize + CLAHE
    # + denoising + shadow removal) — no pre-processing needed here.
    result = await ocr.transcribe_image(data, user_prompt=caption or None)

    if not result.ok or not (result.text or "").strip():
        return AnalysisResponse(
            ok=False,
            reply="กระจกยังอ่านตัวหนังสือในภาพนี้ไม่ออก ลองถ่ายให้ชัดและตรงขึ้นอีกครั้งนะ",
            service="ocr",
            error=result.error or "no text found",
        )

    extracted = result.text.strip()[:_MAX_OCR_CHARS]

    # If user typed a caption, Typhoon already answered the question in `extracted`.
    # Pass to LLM only to structure/prettify the answer.
    # If no caption, run the standard homework-explain prompt.
    if caption and caption.strip():
        llm_prompt = (
            "นักเรียนส่งรูปการบ้านมาพร้อมคำถามว่า: \"" + caption.strip() + "\"\n"
            "ผลการวิเคราะห์ภาพ/คำตอบเบื้องต้น:\n" + extracted + "\n\n"
            "ช่วยอธิบายหรือเรียบเรียงคำตอบให้ชัดเจนขึ้นสำหรับนักเรียนมัธยม "
            "ถ้าเป็นโจทย์คณิตศาสตร์หรือวิทยาศาสตร์ให้แสดงขั้นตอนการคิดด้วย"
        )
    else:
        llm_prompt = (
            "นักเรียนส่งรูปการบ้านมา ข้อความที่อ่านได้จากภาพคือ:\n" + extracted + "\n\n"
            "ช่วยอธิบายหรือแนะนำวิธีทำอย่างเป็นขั้นตอน โดยไม่เฉลยคำตอบตรง ๆ ทันที"
        )
    llm = await pathumma.generate_reply(llm_prompt)
    reply = (
        llm.text
        if llm.ok and llm.text
        else "กระจกอ่านข้อความจากภาพได้แล้ว แต่ระบบ AI ยังตอบไม่ได้ตอนนี้ ลองอีกครั้งนะ"
    )

    store.record_mood(user_id, "neutral", source="homework", channel="image")
    return AnalysisResponse(
        ok=True,
        mood="neutral",
        reply=reply,
        detail=extracted,
        transcript=extracted,
        service="ocr+llm",
    )


@router.post("/tts/speak")
async def speak(
    req: TTSRequest,
    _user_id: str = Depends(require_session),
):
    """Read a reply aloud. Returns WAV audio."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    result = await tts.synthesize(text)
    if not result.ok or not result.data:
        raise HTTPException(status_code=502, detail=result.error or "TTS failed")
    return Response(content=result.data, media_type="audio/wav")


@router.get("/trend")
async def trend(user_id: str = Depends(require_session)) -> dict:
    """Per-user mood history for the trend view."""
    data = store.user_trend(user_id)
    data["labels"] = mood_svc.MOOD_LABELS_TH
    return data


@router.get("/school/overview")
async def school(_user_id: str = Depends(require_session)) -> dict:
    """Anonymous aggregate stats for the school view."""
    return store.school_overview()


@router.get("/data/export")
async def export_data(user_id: str = Depends(require_session)) -> dict:
    """PDPA data-access for the authenticated pseudonymous session."""
    return store.export_user(user_id)


@router.delete("/data")
async def delete_data(user_id: str = Depends(require_session)) -> dict:
    """PDPA erasure for the authenticated pseudonymous session."""
    return {"deleted": store.delete_user(user_id)}
