"""Conversation flow for JaiKrajok LINE Official Account."""

from __future__ import annotations

import threading
import time

from app.services import pathumma, sentiment
from app.services.mood import classify as classify_mood, MOOD_LABELS_TH
from app.utils.logging import get_logger

logger = get_logger(__name__)

_SESSION_TTL_SECONDS = 24 * 60 * 60
_SESSION_MAX_ENTRIES = 10_000
_sessions: dict[str, tuple[str, float]] = {}
_sessions_lock = threading.Lock()


def _get_mode(user_id: str) -> str:
    now = time.monotonic()
    with _sessions_lock:
        entry = _sessions.get(user_id)
        if entry is None:
            return "start"
        mode, last_seen = entry
        if last_seen < now - _SESSION_TTL_SECONDS:
            _sessions.pop(user_id, None)
            return "start"
        _sessions[user_id] = (mode, now)
        return mode


def _set_mode(user_id: str, mode: str) -> None:
    now = time.monotonic()
    with _sessions_lock:
        if mode == "start":
            _sessions.pop(user_id, None)
            return

        if user_id not in _sessions and len(_sessions) >= _SESSION_MAX_ENTRIES:
            cutoff = now - _SESSION_TTL_SECONDS
            for stale_user, (_, last_seen) in list(_sessions.items()):
                if last_seen < cutoff:
                    _sessions.pop(stale_user, None)
            if len(_sessions) >= _SESSION_MAX_ENTRIES:
                oldest_user = min(_sessions, key=lambda key: _sessions[key][1])
                _sessions.pop(oldest_user, None)

        _sessions[user_id] = (mode, now)


# ---------------------------------------------------------------------------
# Message templates
# ---------------------------------------------------------------------------

WELCOME = (
    "สวัสดี! ฉันคือ ใจกระจก (JaiKrajok)\n"
    "เพื่อนช่วยเรียนที่ใส่ใจอารมณ์ของคุณ\n\n"
    "━━━━━━━━━━━━━━━\n"
    "เลือกสิ่งที่อยากทำ:\n\n"
    "1️⃣  คุยเรื่องเรียน\n"
    "2️⃣  เช็คอารมณ์จากข้อความ\n"
    "3️⃣  วิธีใช้งาน\n\n"
    "หรือส่งมาได้เลย:\n"
    "📷 รูปภาพ → วิเคราะห์ใบหน้า / อ่านการบ้าน\n"
    "🎤 เสียงพูด → แปลงเป็นข้อความแล้วตอบ\n"
    "🌬️ พิมพ์ หายใจ → ฝึกหายใจคลายเครียด\n"
    "━━━━━━━━━━━━━━━\n"
    "พิมพ์คำถามเรียนมาได้เลยนะ"
)

HELP = (
    "━━━━━━━━━━━━━━━\n"
    "วิธีใช้งาน JaiKrajok\n"
    "━━━━━━━━━━━━━━━\n\n"
    "💬 พิมพ์ข้อความ\n"
    "   → AI ตอบและวิเคราะห์อารมณ์\n\n"
    "📷 ส่งรูปภาพ\n"
    "   → เซลฟี่: วิเคราะห์ใบหน้า\n"
    "   → การบ้าน: OCR + อธิบายขั้นตอน\n\n"
    "🎤 ส่งเสียงพูด\n"
    "   → Speech-to-Text แล้ว AI ตอบ\n\n"
    "🌬️ พิมพ์ หายใจ หรือ ลดเครียด\n"
    "   → ฝึกหายใจแบบ 4-4-4 คลายเครียด\n\n"
    "━━━━━━━━━━━━━━━\n"
    "⚠️  ระบบนี้ไม่ใช่บริการทางการแพทย์\n"
    "หากทุกข์ใจมาก โทร 1323 (24 ชม.)"
)

# Mood → emoji map for LINE replies
_MOOD_EMOJI: dict[str, str] = {
    "stressed": "😣",
    "sad":      "😢",
    "tired":    "😴",
    "neutral":  "😐",
    "calm":     "😌",
    "positive": "😊",
}

CRISIS_KEYWORDS = (
    # explicit
    "ฆ่าตัวตาย", "อยากตาย", "ทำร้ายตัวเอง", "ไม่อยากอยู่", "อยากหายไป",
    "ไม่อยากมีชีวิต", "ไม่อยากตื่น", "จบชีวิต", "ตายไปเลยดีกว่า", "หายไปเลยดีกว่า",
    "ไม่อยากอยู่ต่อ", "อยากจบทุกอย่าง", "ขอตาย", "อยากนอนไม่ตื่น",
    "ไม่มีค่า",
    # self-harm methods
    "กรีดแขน", "กรีดข้อมือ", "ทำร้ายร่างกายตัวเอง", "กินยาเกินขนาด",
    # hopelessness
    "ไม่มีใครสนใจถ้าฉันตาย", "อยู่ไปก็ไร้ค่า", "เป็นภาระของทุกคน",
    "ไม่มีทางออก", "หมดหวังแล้ว",
    # English code-switching
    "kill myself", "want to die", "end my life", "suicide", "self harm",
)

CRISIS_REPLY = (
    "━━━━━━━━━━━━━━━\n"
    "เราห่วงใยคุณมากนะ\n"
    "ตอนนี้คุณไม่ได้อยู่คนเดียว\n"
    "━━━━━━━━━━━━━━━\n\n"
    "📞 สายด่วนสุขภาพจิต 1323\n"
    "   (ฟรี ตลอด 24 ชั่วโมง)\n\n"
    "โปรดติดต่อสายด่วนหรือคนที่ไว้ใจ\n"
    "ใกล้ตัวด้วยนะ เราอยู่ตรงนี้เสมอ"
)

BREATHE_REPLY = (
    "🌬️ หายใจคลายเครียด 4-4-4\n"
    "━━━━━━━━━━━━━━━\n"
    "ค่อย ๆ ทำตามนะ ไม่ต้องรีบ\n\n"
    "1️⃣  สูดลมเข้าช้า ๆ\n"
    "     นับ 1... 2... 3... 4...\n\n"
    "2️⃣  กลั้นลมหายใจไว้\n"
    "     นับ 1... 2... 3... 4...\n\n"
    "3️⃣  ผ่อนลมออกช้า ๆ\n"
    "     นับ 1... 2... 3... 4...\n\n"
    "🔄 ทำซ้ำ 4 รอบ\n\n"
    "━━━━━━━━━━━━━━━\n"
    "รู้สึกดีขึ้นไหม? 😊\n"
    "พิมพ์ อีกรอบ เพื่อทำซ้ำ\n"
    "หรือพิมพ์ เมนู เพื่อกลับหน้าหลัก"
)


def _is_crisis(text: str) -> bool:
    lowered = (text or "").lower()
    stripped = lowered.replace(" ", "")
    return any(k in lowered or k.replace(" ", "") in stripped for k in CRISIS_KEYWORDS)


async def handle_text(user_id: str, text: str) -> str:
    text = (text or "").strip()
    if not text:
        return "พิมพ์ข้อความมาได้เลยนะ"

    # Crisis check first — always takes priority
    if _is_crisis(text):
        _set_mode(user_id, "start")
        return CRISIS_REPLY

    mode = _get_mode(user_id)

    # Menu shortcuts
    if text in {"1", "เรียน", "study", "การบ้าน", "homework"}:
        _set_mode(user_id, "study")
        return (
            "━━━━━━━━━━━━━━━\n"
            "โหมดช่วยเรียน\n"
            "━━━━━━━━━━━━━━━\n"
            "ส่งคำถาม โจทย์ หรือเนื้อหาที่ไม่เข้าใจมาได้เลย\n"
            "หรือถ่ายรูปการบ้านส่งมาก็ได้นะ"
        )
    if text in {"2", "อารมณ์", "emotion", "ความรู้สึก", "feeling"}:
        _set_mode(user_id, "emotion")
        return (
            "━━━━━━━━━━━━━━━\n"
            "โหมดเช็คอารมณ์\n"
            "━━━━━━━━━━━━━━━\n"
            "ส่งข้อความที่อยากระบาย หรือบอกว่าวันนี้รู้สึกยังไง\n"
            "กระจกจะอ่านอารมณ์จากข้อความให้นะ"
        )
    if text in {"3", "help", "ช่วยเหลือ", "เมนู", "menu", "วิธีใช้"}:
        _set_mode(user_id, "start")
        return HELP

    # Breathing exercise — trigger or repeat
    _BREATHE_TRIGGERS = {
        "หายใจ", "ลดเครียด", "breathe", "breathing",
        "คลายเครียด", "เครียดมาก", "หายใจคลาย",
    }
    if text in _BREATHE_TRIGGERS or (mode == "breathe" and text in {"อีกรอบ", "again", "repeat", "ทำอีก"}):
        _set_mode(user_id, "breathe")
        return BREATHE_REPLY

    # If in breathe mode but user typed something else — exit breathe mode and continue
    if mode == "breathe":
        _set_mode(user_id, "start")

    # Emotion mode — sentiment analysis
    if mode == "emotion":
        result = await sentiment.analyze_text(text)
        _set_mode(user_id, "start")
        if not result.ok:
            return (
                "โหมดเช็คอารมณ์ขัดข้องชั่วคราว ลองใหม่อีกครั้งนะ\n"
                "หรือพิมพ์ เมนู เพื่อกลับหน้าหลัก"
            )
        label = result.label or "ไม่ทราบ"
        score = f"{result.score:.0%}" if result.score is not None else "-"
        # Map to Thai mood label + emoji
        mood = classify_mood(text, result.polarity if hasattr(result, "polarity") else None, result.score)
        emoji = _MOOD_EMOJI.get(mood, "💭")
        mood_th = MOOD_LABELS_TH.get(mood, label)
        return (
            f"━━━━━━━━━━━━━━━\n"
            f"ผลการวิเคราะห์อารมณ์\n"
            f"━━━━━━━━━━━━━━━\n\n"
            f"{emoji} รู้สึก: {mood_th}\n"
            f"ความมั่นใจ: {score}\n\n"
            f"ลองหายใจลึก ๆ สักครั้ง\n"
            f"แล้วค่อยเรียนต่อก็ได้นะ\n\n"
            f"พิมพ์ เมนู เพื่อกลับหน้าหลัก"
        )

    # Default — LLM reply (study mode or free chat)
    result = await pathumma.generate_reply(text)
    if not result.ok:
        logger.warning("Pathumma failed for %s: %s", user_id, result.error)
        return (
            "ขณะนี้ AI ยังตอบไม่ได้ชั่วคราว\n"
            "ลองส่งใหม่อีกสักครู่นะ\n\n"
            "พิมพ์ เมนู เพื่อดูตัวเลือกอื่น"
        )

    reply = result.text or "..."
    # Append subtle footer for study mode to remind about other features
    if mode == "study" and len(reply) < 4500:
        reply += "\n\n─────────────────\nพิมพ์ เมนู เพื่อดูตัวเลือกอื่น"
    return reply
