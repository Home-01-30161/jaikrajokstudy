"""LINE Messaging API webhook.

Supports all four input modes described in the proposal (p.4):
  - Text   → Sentiment + Pathumma LLM
  - Image  → Face Recognition (selfie) or OCR (homework photo)
  - Audio  → Speech-to-Text → Pathumma LLM
  - Sticker → friendly fallback reply
"""

from __future__ import annotations

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

from app.bots.conversation import WELCOME, handle_text, _is_crisis, CRISIS_REPLY
from app.config import get_settings
from app.services import face, ocr, stt
from app.services import pathumma
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
    """Return (blob_api, api_client) — caller must close api_client."""
    settings = get_settings()
    configuration = Configuration(access_token=settings.line_channel_access_token)
    api_client = AsyncApiClient(configuration)
    return AsyncMessagingApiBlob(api_client), api_client


async def _reply(api: AsyncMessagingApi, reply_token: str, text: str) -> None:
    """Send a plain text reply, truncated to LINE's 5 000-char limit."""
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
# Flex Menu — beautiful carousel with 3 feature cards
# ---------------------------------------------------------------------------

def _make_feature_bubble(
    *,
    header_color: str,
    emoji: str,
    title: str,
    subtitle: str,
    body_lines: list[str],
    buttons: list[tuple[str, str, str]],  # (label, message_text, style)
) -> FlexBubble:
    """Build a single bubble card for the menu carousel.

    buttons: list of (label, message_text_to_send, 'primary'|'secondary'|'link')
    """
    btn_objects = []
    for label, msg_text, style in buttons:
        color_map = {
            "primary":   {"bg": header_color, "fg": "#FFFFFF"},
            "secondary": {"bg": "#F5F5F5",    "fg": "#555555"},
        }
        c = color_map.get(style, color_map["secondary"])
        btn_objects.append(
            FlexButton(
                action=MessageAction(label=label, text=msg_text),
                style="primary" if style == "primary" else "secondary",
                color=c["bg"] if style == "primary" else None,
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
                FlexText(
                    text=emoji,
                    size="xxl",
                    align="center",
                ),
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

    # Card 1 — Mood Check (rose/coral)
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
            ("💬 เช็คอารมณ์ตอนนี้", "2", "primary"),
            ("📊 ดูสรุปอารมณ์", "สรุป", "secondary"),
        ],
    )

    # Card 2 — Study Help (teal/green)
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
            ("📷 วิธีส่งรูปการบ้าน", "วิธีใช้", "secondary"),
        ],
    )

    # Card 3 — Wellness (indigo/purple)
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
            ("🌬️ ฝึกหายใจเลย", "หายใจ", "primary"),
            ("💙 คุยกับกระจก", "สวัสดี", "secondary"),
        ],
    )

    return FlexMessage(
        alt_text="เมนู JaiKrajok — เลือกสิ่งที่อยากทำ",
        contents=FlexCarousel(contents=[mood_bubble, study_bubble, wellness_bubble]),
    )


# ---------------------------------------------------------------------------
# Image handler — detect intent from content
# ---------------------------------------------------------------------------
_SELFIE_PHRASE = (
    "กระจกเห็นใบหน้าของคุณแล้ว ตรวจพบ {count} ใบหน้า\n\n"
    "กระจกอ่านได้แค่ว่ามีใบหน้าในภาพนะ ยังอ่านอารมณ์จากสีหน้าไม่ได้\n"
    "ถ้าอยากให้เข้าใจความรู้สึกจริง ๆ พิมพ์หรือพูดมาได้เลย"
)
_NO_FACE_PHRASE = (
    "กระจกยังไม่เห็นใบหน้าในภาพนี้ ลองถ่ายให้เห็นหน้าชัด ๆ "
    "ในที่สว่างอีกครั้งนะ หรือส่งรูปการบ้านถ้าอยากให้ช่วยอ่าน"
)
_OCR_PROMPT = (
    "นักเรียนส่งรูปการบ้านมาทาง LINE "
    "ข้อความที่อ่านได้จากภาพคือ:\n{text}\n\n"
    "ช่วยอธิบายหรือแนะนำวิธีทำอย่างเป็นขั้นตอน โดยไม่เฉลยคำตอบตรง ๆ ทันที"
)

async def _handle_image(
    message_id: str,
    blob: AsyncMessagingApiBlob,
) -> str:
    """Download image from LINE, try face detection first then OCR."""
    try:
        data: bytearray = await blob.get_message_content(message_id)
        image_bytes = bytes(data)
    except Exception as exc:
        logger.warning("Failed to download LINE image %s: %s", message_id, exc)
        return "กระจกดาวน์โหลดรูปภาพไม่ได้ ลองส่งใหม่อีกครั้งนะ"

    # --- Try face detection first ---
    face_result = await face.analyze_image(image_bytes)
    if face_result.ok:
        objects = face_result.raw.get("objects") or []
        count = len(objects) if isinstance(objects, list) else 0
        if count > 0:
            return _SELFIE_PHRASE.format(count=count)
        # Face API OK but no faces → likely a homework photo
        # fall through to OCR

    # --- OCR for homework/document images ---
    ocr_result = await ocr.transcribe_image(image_bytes)
    if ocr_result.ok and (ocr_result.text or "").strip():
        extracted = ocr_result.text.strip()[:3000]
        llm = await pathumma.generate_reply(_OCR_PROMPT.format(text=extracted))
        if llm.ok and llm.text:
            return llm.text
        return f"อ่านข้อความจากภาพได้แล้ว:\n\n{extracted}\n\n(ระบบ AI ยังตอบไม่ได้ตอนนี้ ลองอีกครั้งนะ)"

    # Nothing found
    return _NO_FACE_PHRASE


# ---------------------------------------------------------------------------
# Audio handler
# ---------------------------------------------------------------------------
_AUDIO_FAIL = (
    "กระจกยังฟังเสียงนี้ไม่ออก ลองอัดในที่เงียบ ๆ "
    "หรือพิมพ์มาก็ได้นะ"
)

async def _handle_audio(
    message_id: str,
    blob: AsyncMessagingApiBlob,
) -> str:
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
    from app.bots.conversation import CRISIS_KEYWORDS
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
        mood = classify_mood(transcript, None, None)
        mood_label = MOOD_LABELS_TH.get(mood, "")
        prefix = f"[กระจกได้ยิน: \"{transcript[:80]}{'...' if len(transcript) > 80 else ''}\"]\\n\\n"
        return prefix + llm.text

    return (
        f"กระจกได้ยินว่า: \"{transcript[:200]}\"\n\n"
        "ระบบ AI ยังตอบไม่ได้ตอนนี้ ลองพิมพ์มาก็ได้นะ"
    )


# ---------------------------------------------------------------------------
# Webhook entry point
# ---------------------------------------------------------------------------
_FLEX_TRIGGERS = {"เมนู", "menu", "3", "help", "ช่วยเหลือ", "วิธีใช้"}

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

            # --- Follow / add friend — send Flex menu + welcome text ---
            if isinstance(event, FollowEvent):
                await api_client_reply_flex_then_text(
                    messaging, event.reply_token, WELCOME
                )
                continue

            if not isinstance(event, MessageEvent):
                continue

            user_id: str = (event.source.user_id if event.source else None) or "unknown"
            msg = event.message

            # --- Text ---
            if isinstance(msg, TextMessageContent):
                text_input = (msg.text or "").strip()

                # Intercept menu triggers → send Flex carousel instead of plain text
                if text_input.lower() in _FLEX_TRIGGERS:
                    await _reply_flex(messaging, event.reply_token, _build_flex_menu())
                else:
                    reply = await handle_text(user_id, text_input)
                    await _reply(messaging, event.reply_token, reply)

            # --- Image (selfie or homework photo) ---
            elif isinstance(msg, ImageMessageContent):
                reply = await _handle_image(msg.id, blob)
                await _reply(messaging, event.reply_token, reply)

            # --- Audio (voice message) ---
            elif isinstance(msg, AudioMessageContent):
                reply = await _handle_audio(msg.id, blob)
                await _reply(messaging, event.reply_token, reply)

            # --- Sticker / other ---
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


async def api_client_reply_flex_then_text(
    api: AsyncMessagingApi, reply_token: str, welcome_text: str
) -> None:
    """Send Flex menu + welcome text as two messages on follow event."""
    await api.reply_message(
        ReplyMessageRequest(
            reply_token=reply_token,
            messages=[
                TextMessage(text=welcome_text[:5000]),
                _build_flex_menu(),
            ],
        )
    )


from app.bots.conversation import WELCOME, handle_text, _is_crisis, CRISIS_REPLY
from app.config import get_settings
from app.services import face, ocr, stt
from app.services import pathumma
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
    """Return (blob_api, api_client) — caller must close api_client."""
    settings = get_settings()
    configuration = Configuration(access_token=settings.line_channel_access_token)
    api_client = AsyncApiClient(configuration)
    return AsyncMessagingApiBlob(api_client), api_client


async def _reply(api: AsyncMessagingApi, reply_token: str, text: str) -> None:
    """Send a plain text reply, truncated to LINE's 5 000-char limit."""
    await api.reply_message(
        ReplyMessageRequest(
            reply_token=reply_token,
            messages=[TextMessage(text=text[:5000])],
        )
    )


# ---------------------------------------------------------------------------
# Image handler — detect intent from content
# ---------------------------------------------------------------------------
_SELFIE_PHRASE = (
    "กระจกเห็นใบหน้าของคุณแล้ว ตรวจพบ {count} ใบหน้า\n\n"
    "กระจกอ่านได้แค่ว่ามีใบหน้าในภาพนะ ยังอ่านอารมณ์จากสีหน้าไม่ได้\n"
    "ถ้าอยากให้เข้าใจความรู้สึกจริง ๆ พิมพ์หรือพูดมาได้เลย"
)
_NO_FACE_PHRASE = (
    "กระจกยังไม่เห็นใบหน้าในภาพนี้ ลองถ่ายให้เห็นหน้าชัด ๆ "
    "ในที่สว่างอีกครั้งนะ หรือส่งรูปการบ้านถ้าอยากให้ช่วยอ่าน"
)
_OCR_PROMPT = (
    "นักเรียนส่งรูปการบ้านมาทาง LINE "
    "ข้อความที่อ่านได้จากภาพคือ:\n{text}\n\n"
    "ช่วยอธิบายหรือแนะนำวิธีทำอย่างเป็นขั้นตอน โดยไม่เฉลยคำตอบตรง ๆ ทันที"
)

async def _handle_image(
    message_id: str,
    blob: AsyncMessagingApiBlob,
) -> str:
    """Download image from LINE, try face detection first then OCR."""
    try:
        data: bytearray = await blob.get_message_content(message_id)
        image_bytes = bytes(data)
    except Exception as exc:
        logger.warning("Failed to download LINE image %s: %s", message_id, exc)
        return "กระจกดาวน์โหลดรูปภาพไม่ได้ ลองส่งใหม่อีกครั้งนะ"

    # --- Try face detection first ---
    face_result = await face.analyze_image(image_bytes)
    if face_result.ok:
        objects = face_result.raw.get("objects") or []
        count = len(objects) if isinstance(objects, list) else 0
        if count > 0:
            return _SELFIE_PHRASE.format(count=count)
        # Face API OK but no faces → likely a homework photo
        # fall through to OCR

    # --- OCR for homework/document images ---
    ocr_result = await ocr.transcribe_image(image_bytes)
    if ocr_result.ok and (ocr_result.text or "").strip():
        extracted = ocr_result.text.strip()[:3000]
        llm = await pathumma.generate_reply(_OCR_PROMPT.format(text=extracted))
        if llm.ok and llm.text:
            return llm.text
        return f"อ่านข้อความจากภาพได้แล้ว:\n\n{extracted}\n\n(ระบบ AI ยังตอบไม่ได้ตอนนี้ ลองอีกครั้งนะ)"

    # Nothing found
    return _NO_FACE_PHRASE


# ---------------------------------------------------------------------------
# Audio handler
# ---------------------------------------------------------------------------
_AUDIO_FAIL = (
    "กระจกยังฟังเสียงนี้ไม่ออก ลองอัดในที่เงียบ ๆ "
    "หรือพิมพ์มาก็ได้นะ"
)

async def _handle_audio(
    message_id: str,
    blob: AsyncMessagingApiBlob,
) -> str:
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
    from app.bots.conversation import CRISIS_KEYWORDS
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
        mood = classify_mood(transcript, None, None)
        mood_label = MOOD_LABELS_TH.get(mood, "")
        prefix = f"[กระจกได้ยิน: \"{transcript[:80]}{'...' if len(transcript) > 80 else ''}\"]\n\n"
        return prefix + llm.text

    return (
        f"กระจกได้ยินว่า: \"{transcript[:200]}\"\n\n"
        "ระบบ AI ยังตอบไม่ได้ตอนนี้ ลองพิมพ์มาก็ได้นะ"
    )


# ---------------------------------------------------------------------------
# Webhook entry point
# ---------------------------------------------------------------------------
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

            # --- Follow / add friend ---
            if isinstance(event, FollowEvent):
                await _reply(messaging, event.reply_token, WELCOME)
                continue

            if not isinstance(event, MessageEvent):
                continue

            user_id: str = (event.source.user_id if event.source else None) or "unknown"
            msg = event.message

            # --- Text ---
            if isinstance(msg, TextMessageContent):
                reply = await handle_text(user_id, msg.text)
                await _reply(messaging, event.reply_token, reply)

            # --- Image (selfie or homework photo) ---
            elif isinstance(msg, ImageMessageContent):
                reply = await _handle_image(msg.id, blob)
                await _reply(messaging, event.reply_token, reply)

            # --- Audio (voice message) ---
            elif isinstance(msg, AudioMessageContent):
                reply = await _handle_audio(msg.id, blob)
                await _reply(messaging, event.reply_token, reply)

            # --- Sticker / other ---
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
