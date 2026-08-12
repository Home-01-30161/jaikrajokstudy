"""LINE Messaging API webhook.

Supports all four input modes described in the proposal (p.4):
  - Text   -> Sentiment + Pathumma LLM
  - Image  -> Face Recognition (selfie) or OCR (homework photo)
  - Audio  -> Speech-to-Text -> Pathumma LLM
  - Sticker -> friendly fallback reply
"""

from __future__ import annotations

import asyncio
import logging
import ssl

import aiohttp
from fastapi import APIRouter, Header, HTTPException, Request
from linebot.v3 import WebhookParser
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    AsyncApiClient,
    AsyncMessagingApi,
    AsyncMessagingApiBlob,
    Configuration,
    FlexBox,
    FlexBubble,
    FlexButton,
    FlexCarousel,
    FlexImage,
    FlexMessage,
    FlexSeparator,
    FlexText,
    MessageAction,
    ReplyMessageRequest,
    TextMessage,
    URIAction,
)
from linebot.v3.webhooks import (
    AudioMessageContent,
    FollowEvent,
    ImageMessageContent,
    MessageEvent,
    StickerMessageContent,
    TextMessageContent,
)

from app.bots.conversation import WELCOME, handle_text, _is_crisis, CRISIS_REPLY, CRISIS_KEYWORDS
from app.config import get_settings
from app.services import face, ocr, stt
from app.services import pathumma
from app.services.pathumma import strip_latex_for_line
from app.services.mood import classify as classify_mood, MOOD_LABELS_TH

logger = logging.getLogger(__name__)
router = APIRouter(tags=["line"])

# Local shells with a broken CA bundle (MSYS2 Python) cannot verify certs, so
# INSECURE_TLS=1 opts out. It defaults to false, so the deployed container always
# verifies: replies to LINE users must not accept a forged certificate.
if get_settings().insecure_tls:
    logger.warning(
        "INSECURE_TLS is on - outbound TLS certificates are NOT verified. "
        "Local development only."
    )

    _original_tcp_connector_init = aiohttp.TCPConnector.__init__

    def _patched_tcp_connector_init(self, *args, **kwargs):
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        kwargs["ssl"] = ssl_context
        _original_tcp_connector_init(self, *args, **kwargs)

    aiohttp.TCPConnector.__init__ = _patched_tcp_connector_init


def _messaging_api() -> AsyncMessagingApi:
    settings = get_settings()
    configuration = Configuration(access_token=settings.line_channel_access_token)
    api_client = AsyncApiClient(configuration)
    return AsyncMessagingApi(api_client)


def _blob_api() -> tuple[AsyncMessagingApiBlob, AsyncApiClient]:
    """Return (blob_api, api_client) -- caller must close api_client."""
    settings = get_settings()
    configuration = Configuration(access_token=settings.line_channel_access_token)
    api_client = AsyncApiClient(configuration)
    return AsyncMessagingApiBlob(api_client), api_client


async def _reply(api: AsyncMessagingApi, reply_token: str, text: str) -> None:
    """Send a plain text reply, truncated to LINE 5000-char limit."""
    await api.reply_message(
        ReplyMessageRequest(
            reply_token=reply_token,
            messages=[TextMessage(text=text[:5000])],
        )
    )


async def _reply_flex(api: AsyncMessagingApi, reply_token: str, flex: FlexMessage) -> None:
    """Send a Flex Message reply."""
    await api.reply_message(
        ReplyMessageRequest(reply_token=reply_token, messages=[flex])
    )


# ---------------------------------------------------------------------------
# Flex Menu -- beautiful carousel with 3 feature cards
# ---------------------------------------------------------------------------

def _make_feature_bubble(
    *,
    header_color: str,
    emoji: str,
    title: str,
    subtitle: str,
    body_lines: list[str],
    buttons: list[tuple[str, str, str]],
) -> FlexBubble:
    """Build a single bubble card for the menu carousel."""
    btn_objects = []
    for label, msg_text, style in buttons:
        btn_objects.append(
            FlexButton(
                action=MessageAction(label=label, text=msg_text),
                style="primary" if style == "primary" else "secondary",
                color=header_color if style == "primary" else None,
                height="sm",
                margin="sm",
            )
        )

    body_text_items = []
    for line in body_lines:
        body_text_items.append(
            FlexText(
                text=line,
                size="sm",
                color="#666666",
                wrap=True,
                margin="sm",
            )
        )

    return FlexBubble(
        size="kilo",
        header=FlexBox(
            layout="vertical",
            background_color=header_color,
            padding_all="20px",
            contents=[
                FlexText(text=emoji, size="xxl", align="center"),
                FlexText(
                    text=title,
                    weight="bold",
                    size="lg",
                    color="#FFFFFF",
                    align="center",
                    margin="sm",
                ),
                FlexText(
                    text=subtitle,
                    size="xs",
                    color="#FFFFFFB0",
                    align="center",
                    wrap=True,
                ),
            ],
        ),
        body=FlexBox(
            layout="vertical",
            padding_all="16px",
            spacing="sm",
            contents=[
                *body_text_items,
                FlexSeparator(margin="md"),
                FlexBox(
                    layout="vertical",
                    margin="md",
                    spacing="sm",
                    contents=btn_objects,
                ),
            ],
        ),
    )


def _build_flex_menu() -> FlexMessage:
    """Build the full 3-card Flex Carousel menu."""

    # Card 1 -- Mood Check (rose/coral)  matches Rich Menu button: "เช็คอารมณ์" / "ดูสถิติ"
    mood_bubble = _make_feature_bubble(
        header_color="#E8647A",
        emoji="😊",
        title="เช็คอารมณ์",
        subtitle="บอกความรู้สึกของคุณ\nกระจกจะอ่านอารมณ์ให้",
        body_lines=[
            "📝 พิมพ์ระบายความรู้สึก",
            "📊 ดูสถิติอารมณ์ย้อนหลัง 7 วัน",
            "🔔 แจ้งเตือนเมื่อเครียดต่อเนื่อง",
        ],
        buttons=[
            ("💬 เช็คอารมณ์ตอนนี้", "เช็คอารมณ์", "primary"),
            ("📊 ดูสถิติ", "ดูสถิติ", "secondary"),
        ],
    )

    # Card 2 -- Study Help (teal)  matches Rich Menu: "ตอบคำถามจากรูป"
    study_bubble = _make_feature_bubble(
        header_color="#2F7A6E",
        emoji="📚",
        title="ช่วยเรียน",
        subtitle="ถามคำถาม ส่งรูปการบ้าน\nหรือฝากไฟล์เสียงได้เลย",
        body_lines=[
            "💬 พิมพ์คำถาม AI ตอบทันที",
            "📷 ถ่ายรูปการบ้าน อ่านให้",
            "🎤 บันทึกเสียง แปลงเป็นข้อความ",
        ],
        buttons=[
            ("📖 เริ่มช่วยเรียน", "1", "primary"),
            ("📷 ตอบคำถามจากรูป", "ตอบคำถามจากรูป", "secondary"),
        ],
    )

    # Card 3 -- Wellness (indigo)  matches Rich Menu: "ฝึกหายใจ" / "ข้อมูลแอป"
    wellness_bubble = _make_feature_bubble(
        header_color="#5B4FCF",
        emoji="🌬️",
        title="ดูแลสุขภาพใจ",
        subtitle="ผ่อนคลาย ลดเครียด\nกระจกอยู่ตรงนี้เสมอ",
        body_lines=[
            "🌬️ ฝึกหายใจแบบ 4-4-4",
            "📞 สายด่วน 1323 ฟรี 24 ชม.",
            "💙 คุยระบายได้ตลอดเวลา",
        ],
        buttons=[
            ("🌬️ ฝึกหายใจเลย", "ฝึกหายใจ", "primary"),
            ("ℹ️ ข้อมูลแอป", "ข้อมูลแอป", "secondary"),
        ],
    )

    return FlexMessage(
        alt_text="เมนู JaiKrajok -- เลือกสิ่งที่อยากทำ",
        contents=FlexCarousel(contents=[mood_bubble, study_bubble, wellness_bubble]),
    )


async def api_client_reply_flex_then_text(
    api: AsyncMessagingApi, reply_token: str, welcome_text: str
) -> None:
    """Send welcome text + Flex menu as two messages on follow event."""
    await api.reply_message(
        ReplyMessageRequest(
            reply_token=reply_token,
            messages=[
                TextMessage(text=welcome_text[:5000]),
                _build_flex_menu(),
            ],
        )
    )


# ---------------------------------------------------------------------------
# Image handler -- detect intent from content
# ---------------------------------------------------------------------------
_OCR_PROMPT = (
    "นักเรียนส่งรูปการบ้านมาทาง LINE\n"
    "ระบบ OCR อ่านข้อความและข้อมูลจากภาพได้ดังนี้:\n"
    "---\n"
    "{text}\n"
    "---\n\n"
    "คำสั่ง: วิเคราะห์และเฉลยโจทย์ที่อ่านได้ด้านบนเป็น**ภาษาไทยเท่านั้น**\n"
    "กฎเด็ดขาด:\n"
    "1. ตอบเป็นภาษาไทยเท่านั้น ห้ามตอบเป็นภาษาอังกฤษ ภาษาจีน หรือภาษาอื่น\n"
    "2. ห้าม Step-by-step ภาษาอังกฤษ ห้าม Part A/B/C ห้าม EXAMPLE CASE\n"
    "3. ถ้า OCR อ่านได้ 'g' หรือ '8' ในบริบทฟิสิกส์/แรงโน้มถ่วง ให้ตีความว่าคือ g (ความเร่งโน้มถ่วง)\n"
    "4. ถ้าโจทย์เป็นฟิสิกส์หรือคณิตศาสตร์ ให้แสดงวิธีคิดทีละขั้นตอนพร้อมเฉลยคำตอบด้วยสัญกรณ์คณิตศาสตร์ที่ถูกต้อง\n"
    "5. ถ้าข้อความไม่ชัดเจนบางส่วน ให้ใช้บริบทจากส่วนที่อ่านได้เพื่ออนุมานและระบุสิ่งที่ไม่แน่ใจ\n"
    "6. ตอบกระชับ ไม่เกิน 500 คำ"
)
_NO_FACE_PHRASE = (
    "กระจกยังไม่เห็นใบหน้าในภาพนี้ ลองถ่ายให้เห็นหน้าชัด ๆ "
    "ในที่สว่างอีกครั้งนะ หรือส่งรูปการบ้านถ้าอยากให้ช่วยอ่าน"
)

# Emotion → empathetic LLM prompt template
# Uses the structured emotion data returned by face.py (typhoon-ocr primary path)
_EMOTION_LLM_PROMPT = (
    "ผู้ใช้ส่งรูปเซลฟี่มาทาง LINE "
    "จากการวิเคราะห์ใบหน้าด้วย AI พบว่าดูรู้สึก {emotion_th} "
    "({description}) ความมั่นใจในการวิเคราะห์ {pct:.0%}\n\n"
    "ตอบสนองด้วยความเห็นอกเห็นใจ อบอุ่น กระชับ 2-3 ประโยคภาษาไทย "
    "สอบถามความรู้สึกและให้กำลังใจ ห้ามใส่ Task List หรือ Mermaid "
    "ห้ามตอบเป็นภาษาจีนหรือภาษาอื่นที่ไม่ใช่ภาษาไทย"
)


async def _handle_image(message_id: str, blob: AsyncMessagingApiBlob) -> str:
    """Download image from LINE, detect faces/emotion first then OCR.

    Routing logic (matches proposal p.4 — 4 interaction modes):
      1. face.analyze_image() → tries typhoon-ocr with emotion-analysis prompt
         - service="face-typhoon", face_count>0  → selfie with emotion → LLM empathy reply
         - service="face-typhoon", face_count=0  → no faces → fall through to OCR
         - service="face" (AI for Thai fallback), face_count>0 → selfie (no emotion) → LLM reply
         - service="face" (AI for Thai fallback), face_count=0 → fall through to OCR
      2. ocr.transcribe_image() → homework/document photo → LLM explains content
      3. Neither succeeds → generic error message

    KEY OPTIMISATION: face detection and OCR now run IN PARALLEL via asyncio.gather
    so we don't pay the Typhoon face timeout (30s) before starting OCR (90s).
    Total wall-clock time is max(face_time, ocr_time) instead of face_time + ocr_time.

    An outer 40-second hard deadline ensures LINE never sees a timeout (LINE requires
    response within ~50s; previously the serial chain could take 270s+).
    """
    try:
        data: bytearray = await blob.get_message_content(message_id)
        image_bytes = bytes(data)
    except Exception as exc:
        logger.warning("Failed to download LINE image %s: %s", message_id, exc)
        return "กระจกดาวน์โหลดรูปภาพไม่ได้ ลองส่งใหม่อีกครั้งนะ"

    async def _run_with_timeout() -> str:
        # Step 1 + Step 2 in PARALLEL — face detection and OCR start at the same time.
        # This eliminates the serial 30s face timeout before OCR even begins.
        face_task = asyncio.create_task(face.analyze_image(image_bytes))
        ocr_task  = asyncio.create_task(ocr.transcribe_image(image_bytes))

        face_result, ocr_result = await asyncio.gather(face_task, ocr_task)

        # --- Route on face result first ---
        if face_result.ok:
            # Typhoon OCR emotion path: full emotion data available
            if face_result.service == "face-typhoon":
                raw = face_result.raw
                face_count = int(raw.get("face_count", 0))
                if face_count > 0:
                    emotion_th = str(raw.get("emotion_th", "ปกติ"))
                    description = str(raw.get("description", ""))
                    confidence = float(face_result.score or 0.5)

                    llm_prompt = _EMOTION_LLM_PROMPT.format(
                        emotion_th=emotion_th,
                        description=description,
                        pct=confidence,
                    )
                    llm = await pathumma.generate_reply(llm_prompt)
                    if llm.ok and llm.text:
                        return strip_latex_for_line(llm.text)
                    # LLM failed — use structured fallback with emotion data
                    return (
                        f"กระจกเห็นใบหน้าของคุณแล้ว ดูเหมือนรู้สึก {emotion_th} นะ\n\n"
                        f"{description}\n\n"
                        "ถ้าอยากคุยเรื่องนี้เพิ่มเติม พิมพ์มาได้เลย"
                    )
                # face_count == 0 from typhoon-ocr → likely homework photo → fall through to OCR result

            # AI for Thai fallback path: face presence only, no emotion data
            elif face_result.service == "face":
                objects = face_result.raw.get("objects") or []
                count = len(objects) if isinstance(objects, list) else 0
                if count > 0:
                    llm = await pathumma.generate_reply(
                        "ผู้ใช้ส่งเซลฟี่มาทาง LINE กระจกตรวจพบใบหน้าในภาพ "
                        "ตอบทักทายอบอุ่น สอบถามความรู้สึกวันนี้ 2-3 ประโยคภาษาไทย "
                        "ห้ามตอบเป็นภาษาจีนหรือภาษาอื่นที่ไม่ใช่ภาษาไทย"
                    )
                    if llm.ok and llm.text:
                        return strip_latex_for_line(llm.text)
                    return (
                        f"กระจกเห็นใบหน้าของคุณแล้ว ({count} ใบหน้า) 😊\n\n"
                        "วันนี้รู้สึกเป็นยังไงบ้าง? พิมพ์มาเล่าให้ฟังได้นะ"
                    )
                # count == 0 → fall through to OCR result

        # --- Step 2: Use the OCR result that was already fetched in parallel ---
        if ocr_result.ok and (ocr_result.text or "").strip():
            extracted = ocr_result.text.strip()[:3000]
            llm = await pathumma.generate_reply(_OCR_PROMPT.format(text=extracted))
            if llm.ok and llm.text:
                reply_text = strip_latex_for_line(llm.text)
                # Reject hallucinated replies: Chinese/Japanese, no Thai, OR English-dominant.
                import re as _re
                has_chinese = bool(_re.search(r"[一-鿿぀-ヿ]", reply_text))
                has_thai = bool(_re.search(r"[฀-๿]", reply_text))
                # English-dominant: hard markers OR latin >> thai ratio
                _eng_markers = bool(_re.search(
                    r"(Step-by-step|Part [A-Z][\s：:]|EXAMPLE CASE|Suppose\s+\w+|"
                    r"Determine[sd]? [Ww]hether|ObjectiveFunction|Imagine Scenario|"
                    r"TheirHeightsMust|STEPS THREE|"
                    r"STEP_\d|END OF DRAFT|\[Diagram\]|\[Example\s*Diagram\]|"
                    r"Note:\s*This draft|\\boxed\{)",
                    reply_text, _re.IGNORECASE,
                ))
                _latin = len(_re.findall(r"[A-Za-z]", reply_text))
                _thai_cnt = len(_re.findall(r"[฀-๿]", reply_text))
                _english_dominant = (
                    _eng_markers
                    or (not has_thai)
                    or (len(reply_text) > 200 and _thai_cnt > 0 and _latin > _thai_cnt * 3)
                )
                if has_chinese or _english_dominant:
                    logger.warning(
                        "LLM reply for OCR prompt is hallucinated "
                        "(chinese=%s english_dominant=%s has_thai=%s) — showing raw OCR text",
                        has_chinese, _english_dominant, has_thai,
                    )
                    return (
                        "📷 กระจกอ่านข้อความจากภาพได้:\n\n"
                        f"{extracted}\n\n"
                        "พิมพ์ถามมาได้เลย ว่าอยากให้ช่วยอธิบายตรงไหน"
                    )
                return reply_text
            return (
                "📷 กระจกอ่านข้อความจากภาพได้:\n\n"
                f"{extracted}\n\n"
                "พิมพ์ถามมาได้เลย ว่าอยากให้ช่วยอธิบายตรงไหน"
            )

        return _NO_FACE_PHRASE

    # Hard 40-second deadline: LINE requires a reply within ~50s.
    # Previously the serial face+OCR+fallback chain could take 270s+ causing LINE
    # to re-deliver the message (which produced the duplicate reply in the screenshot).
    try:
        return await asyncio.wait_for(_run_with_timeout(), timeout=40.0)
    except asyncio.TimeoutError:
        logger.warning("_handle_image timed out after 40s — returning graceful fallback")
        return (
            "📷 กระจกกำลังประมวลผลรูปภาพช้าไปหน่อย\n\n"
            "ลองส่งรูปใหม่อีกครั้ง หรือพิมพ์โจทย์มาแทนได้เลยนะ"
        )


# ---------------------------------------------------------------------------
# Audio handler
# ---------------------------------------------------------------------------
_AUDIO_FAIL = "กระจกยังฟังเสียงนี้ไม่ออก ลองอัดในที่เงียบ ๆ หรือพิมพ์มาก็ได้นะ"


async def _handle_audio(message_id: str, blob: AsyncMessagingApiBlob) -> str:
    """Download audio from LINE, transcribe, then reply with LLM."""
    try:
        data: bytearray = await blob.get_message_content(message_id)
        audio_bytes = bytes(data)
    except Exception as exc:
        logger.warning("Failed to download LINE audio %s: %s", message_id, exc)
        return _AUDIO_FAIL

    # LINE sends m4a audio
    stt_result = await stt.transcribe(
        audio_bytes,
        filename="voice.m4a",
        content_type="audio/mp4",
    )
    if not stt_result.ok or not (stt_result.text or "").strip():
        logger.warning("LINE STT failed: %s", stt_result.error)
        return _AUDIO_FAIL

    transcript = stt_result.text.strip()

    # Crisis check on transcript
    lowered = transcript.lower()
    stripped = lowered.replace(" ", "")
    if any(k in lowered or k.replace(" ", "") in stripped for k in CRISIS_KEYWORDS):
        return (
            "เราห่วงใยคุณมาก ตอนนี้คุณไม่ได้อยู่คนเดียว "
            "โปรดติดต่อสายด่วนสุขภาพจิต 1323 "
            "หรือคนที่ไว้ใจใกล้ตัวด้วยนะ"
        )

    llm = await pathumma.generate_reply(transcript)
    if llm.ok and llm.text:
        dots = "..." if len(transcript) > 80 else ""
        prefix = f"[กระจกได้ยิน: \"{transcript[:80]}{dots}\"]\n\n"
        return prefix + strip_latex_for_line(llm.text)

    return (
        f"กระจกได้ยินว่า: \"{transcript[:200]}\"\n\n"
        "ระบบ AI ยังตอบไม่ได้ตอนนี้ ลองพิมพ์มาก็ได้นะ"
    )


# ---------------------------------------------------------------------------
# Webhook entry point
# ---------------------------------------------------------------------------

# Text inputs that should show the interactive Flex menu carousel
# NOTE: "ข้อมูลแอป" is also handled here so the user gets the Flex menu
# (which has the app info button) rather than a plain HELP text.
_FLEX_TRIGGERS = {
    "เมนู", "menu", "3", "help", "ช่วยเหลือ",
}


@router.post("/webhooks/line")
async def line_webhook(
    request: Request,
    x_line_signature: str | None = Header(default=None, alias="X-Line-Signature"),
) -> dict:
    settings = get_settings()
    if not settings.line_channel_secret or not settings.line_channel_access_token:
        raise HTTPException(status_code=503, detail="LINE credentials not configured")
    if not x_line_signature:
        raise HTTPException(status_code=400, detail="Missing X-Line-Signature")

    body = (await request.body()).decode("utf-8")
    parser = WebhookParser(settings.line_channel_secret)

    try:
        events = parser.parse(body, x_line_signature)
    except InvalidSignatureError as exc:
        logger.warning("Invalid LINE signature")
        raise HTTPException(status_code=400, detail="Invalid signature") from exc

    messaging = _messaging_api()
    blob, blob_client = _blob_api()

    try:
        logger.info("Processing %d events", len(events))

        for event in events:
            logger.info("Event: %s", type(event).__name__)

            # Follow / add friend -- send welcome text + Flex menu
            if isinstance(event, FollowEvent):
                await api_client_reply_flex_then_text(
                    messaging, event.reply_token, WELCOME
                )
                continue

            if not isinstance(event, MessageEvent):
                continue

            user_id: str = (event.source.user_id if event.source else None) or "unknown"
            msg = event.message

            # Text
            if isinstance(msg, TextMessageContent):
                text_input = (msg.text or "").strip()

                # Intercept menu triggers -> send Flex carousel instead of plain text
                if text_input.lower() in _FLEX_TRIGGERS:
                    await _reply_flex(messaging, event.reply_token, _build_flex_menu())
                else:
                    reply = await handle_text(user_id, text_input)
                    await _reply(messaging, event.reply_token, reply)

            # Image (selfie or homework photo)
            elif isinstance(msg, ImageMessageContent):
                reply = await _handle_image(msg.id, blob)
                await _reply(messaging, event.reply_token, reply)

            # Audio (voice message)
            elif isinstance(msg, AudioMessageContent):
                reply = await _handle_audio(msg.id, blob)
                await _reply(messaging, event.reply_token, reply)

            # Sticker / other
            elif isinstance(msg, StickerMessageContent):
                await _reply(
                    messaging,
                    event.reply_token,
                    "สติ๊กเกอร์น่ารักมาก! ถ้าอยากให้ช่วยเรื่องเรียนหรืออยากระบาย พิมพ์มาได้เลยนะ",
                )
            else:
                await _reply(
                    messaging,
                    event.reply_token,
                    "กระจกรับได้เฉพาะข้อความ รูปภาพ และเสียงพูดนะ ลองพิมพ์มาได้เลย",
                )

    except Exception as e:
        logger.error("Error processing webhook: %s", e, exc_info=True)
        raise
    finally:
        await messaging.api_client.close()
        await blob_client.close()

    return {"ok": True}