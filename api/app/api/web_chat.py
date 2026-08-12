"""Web chat API endpoints for the JaiKrajok frontend.

Covers the four chat modes the UI offers (text / selfie / voice / homework
photo), plus the trend and school views. Every mode ends in the same place: a
mood label the UI can render and an LLM reply written for that mood.
"""

from __future__ import annotations

import asyncio
import re

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field

from app import store
from app.services import face, mood as mood_svc, ocr, pathumma, stt, tts
from app.services.pathumma import _fix_thai_choices, _wrap_plain_math, MATH_SYSTEM_PROMPT
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
        reply = _wrap_plain_math(llm.text)
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
    """Homework mode: dual-call OCR (text + diagram), then LLM solve.

    Ported from analyzeHomework() in pathummaApi.ts (reference repo):
    1. Two parallel Typhoon OCR calls: text extraction + diagram description
    2. Combine into a rich prompt with [คำอธิบายแผนภาพ] section
    3. Detect multiple-choice vs open-ended problems
    4. Route to appropriate solve prompt (choice analysis vs step-by-step)
    5. Use MATH_SYSTEM_PROMPT + low temperature for high precision

    Args:
        file: Image file to OCR.
        caption: Optional user question typed alongside the image.
    """
    data = await _read_upload(file, "image/")

    # Preprocess image once for both calls
    from app.services.image_prep import prepare_for_ocr
    try:
        prepared = prepare_for_ocr(data, enhance="auto")
    except Exception:
        prepared = data

    # ── Step 1: Dual parallel vision calls (reference: analyzeHomework lines 753-767) ──
    # Call 1: OCR the prose text (Thai problem statement, numbers, variable names)
    # Call 2: Describe the diagram in structured natural language sentences
    ocr_task = ocr.transcribe_image(data, user_prompt=caption or None)
    diagram_task = ocr.describe_diagram(data)
    ocr_result, diagram_result = await asyncio.gather(ocr_task, diagram_task)

    ocr_text = (ocr_result.text or "").strip() if ocr_result.ok else ""
    diagram_text = (diagram_result.text or "").strip() if diagram_result.ok else ""

    if not ocr_text and not diagram_text:
        return AnalysisResponse(
            ok=False,
            reply="กระจกยังอ่านตัวหนังสือในภาพนี้ไม่ออก ลองถ่ายให้ชัดและตรงขึ้นอีกครั้งนะ",
            service="ocr",
            error=ocr_result.error or "no text found",
        )

    # ── Step 2: Combine OCR text + diagram description ──
    # (reference: analyzeHomework line 779)
    # With the /v1/ocr endpoint, the OCR text may already contain
    # [คำอธิบายแผนภาพ] from <figure> blocks. Only append the separate
    # diagram description if the OCR text doesn't already include one.
    answer = ocr_text[:_MAX_OCR_CHARS]
    has_embedded_diagram = "[คำอธิบายแผนภาพ]" in answer
    if diagram_text and not has_embedded_diagram:
        answer += f"\n\n[คำอธิบายแผนภาพ]\n{diagram_text[:2000]}"
    elif diagram_text and has_embedded_diagram:
        # Append as supplementary info if the embedded one is short
        embedded_diag_len = len(answer.split("[คำอธิบายแผนภาพ]", 1)[-1])
        if embedded_diag_len < 100 and len(diagram_text) > embedded_diag_len:
            answer += f"\n\n[คำอธิบายแผนภาพเพิ่มเติม]\n{diagram_text[:2000]}"

    # ── Step 3: Detect multiple-choice vs open-ended ──
    # (reference: analyzeHomework lines 786-792)
    # Require choice labels at line start, at least 2 distinct labels
    line_start_choice_re = re.compile(r"(?:^|\n)\s*([กขคง])\.\s")
    choice_letters_found = set(m.group(1) for m in line_start_choice_re.finditer(answer))
    has_choices = len(choice_letters_found) >= 2

    # ── Step 4: If user typed a caption, use it as the solve prompt ──
    if caption and caption.strip():
        llm_prompt = (
            "นักเรียนส่งรูปการบ้านมาพร้อมคำถามว่า: \"" + caption.strip() + "\"\n"
            "ข้อมูลโจทย์ที่อ่านและวิเคราะห์ได้จากภาพ:\n" + answer + "\n\n"
            "⚠️ คำสั่งสำคัญ:\n"
            "ส่วน [คำอธิบายแผนภาพ] ด้านบนคือข้อมูลจากแผนภาพจริงในโจทย์\n"
            "ห้ามบอกว่า 'ขาดข้อมูล' หากข้อมูลนั้นปรากฏในส่วน [คำอธิบายแผนภาพ]\n\n"
            "ช่วยตอบคำถามนี้อย่างละเอียด แสดงขั้นตอนการคิดและการคำนวณทุกขั้นตอน\n"
            "📐 สูตรและสมการทุกอันต้องเขียนด้วย LaTeX: inline ใช้ $...$ และ block ใช้ $$...$$"
        )
    elif has_choices:
        # ── Multiple-choice problem (reference: analyzeHomework lines 800-807) ──
        llm_prompt = (
            f"ข้อมูลโจทย์และตัวเลือกที่อ่านและวิเคราะห์ได้จากภาพ:\n{answer[:3000]}\n\n"
            "คำสั่งเรียบเรียงเฉลย:\n"
            "1. **โจทย์และข้อมูลในภาพ**: สรุปโจทย์และรายละเอียดสั้น ๆ\n"
            "2. **ตัวเลือกทั้งหมด**: แสดงตัวเลือก ก., ข., ค., ง. ที่ **ถอดความได้จากภาพข้างต้นเท่านั้น** "
            "— ห้ามประดิษฐ์หรือแต่งตัวเลือกใหม่เด็ดขาด\n"
            "3. **วิเคราะห์ตัวเลือก**: อธิบายเหตุผลของแต่ละตัวเลือกว่าถูกหรือผิด\n"
            "4. **สรุปคำตอบ**: ปิดท้ายด้วยบรรทัด **คำตอบที่ถูกต้องคือ: [ก./ข./ค./ง.]** เพียง 1 ครั้งเท่านั้น\n\n"
            "❌ ห้ามใส่ตัวเลือกที่ไม่ได้ปรากฏในข้อความด้านบนเด็ดขาด\n"
            "📐 สูตรและสมการทุกอันต้องเขียนด้วย LaTeX: inline ใช้ $...$ และ block ใช้ $$...$$"
        )
    else:
        # ── Open-ended problem (reference: analyzeHomework lines 810-833) ──
        llm_prompt = (
            f"โจทย์ที่อ่านได้จากภาพ (รวมคำอธิบายแผนภาพ):\n{answer[:4000]}\n\n"
            "⚠️ คำสั่งสำคัญ:\n"
            "ส่วน [คำอธิบายแผนภาพ] ด้านบนคือข้อมูลจากแผนภาพจริงในโจทย์ ไม่ใช่คำอธิบายทั่วไป\n"
            "ทุกมุมที่ระบุในแผนภาพ เช่น 'มุม 60° ที่จุด A จากแนวดิ่ง' คือ ข้อมูลทางฟิสิกส์ที่ต้องใช้คำนวณโดยตรง\n"
            "ห้ามบอกว่า 'ขาดข้อมูล' หากข้อมูลนั้นปรากฏในส่วน [คำอธิบายแผนภาพ]\n\n"
            "คำสั่ง: แก้โจทย์นี้แบบเฉลยสมบูรณ์\n"
            "1. **โจทย์**: สรุปข้อมูลทั้งหมดที่กำหนด รวมมุมและค่าจากแผนภาพ\n"
            "2. **วิเคราะห์และหาคำตอบ**: แสดงขั้นตอนการคำนวณอย่างละเอียด\n"
            "3. **คำตอบสุดท้าย**: ระบุค่าคำตอบชัดเจน\n\n"
            "❌ ห้ามสร้างตัวเลือก ก. ข. ค. ง. เพิ่มเองเด็ดขาด เพราะโจทย์นี้ไม่มีตัวเลือก\n"
            "📐 สูตรและสมการทุกอันต้องเขียนด้วย LaTeX: inline ใช้ $...$ และ block ใช้ $$...$$"
        )

    # ── Step 5: Call LLM with MATH_SYSTEM_PROMPT + low temperature ──
    # (reference: analyzeHomework lines 836-841)
    import logging as _logging
    _hw_log = _logging.getLogger("homework")
    _hw_log.info("LLM prompt (%d chars): %.200s", len(llm_prompt), llm_prompt)
    llm = await pathumma.generate_reply(llm_prompt)
    _hw_log.info("LLM result: ok=%s service=%s error=%s text_len=%d",
                 llm.ok, llm.service, llm.error, len(llm.text or ""))
    if llm.ok and llm.text:
        reply = _wrap_plain_math(_fix_thai_choices(llm.text, answer))
        if len(reply) < 30:
            reply = f"## 📝 เฉลยการบ้าน\n\n{answer}"
    else:
        reply = f"## 📝 โจทย์และเฉลยจากภาพ\n\n{answer}"

    llm_service = llm.service or "unknown"
    store.record_mood(user_id, "neutral", source="homework", channel="image")
    return AnalysisResponse(
        ok=True,
        mood="neutral",
        reply=reply,
        detail=answer,
        transcript=ocr_text,
        service=f"ocr+{llm_service}",
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
