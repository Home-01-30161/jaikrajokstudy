"""Conversation flow for JaiKrajok LINE Official Account."""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

from app.services import pathumma, sentiment
from app.services.pathumma import strip_latex_for_line
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
    "📊 พิมพ์ สรุป → ดูอารมณ์ 7 วันที่ผ่านมา\n"
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
    "📊 พิมพ์ สรุป หรือ ดูอารมณ์\n"
    "   → สถิติอารมณ์ของคุณ 7 วันที่ผ่านมา\n\n"
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


def _build_mood_summary(user_id: str) -> str:
    """Pull user_trend() from store and format it as a LINE text message."""
    try:
        from app import store
        data = store.user_trend(user_id, days=7)
    except Exception:
        return (
            "ขออภัย ดึงข้อมูลอารมณ์ไม่ได้ชั่วคราว\n"
            "ลองพิมพ์ สรุป อีกครั้งในอีกสักครู่นะ"
        )

    days_data = data.get("days", [])
    total_msgs = data.get("messages", 0)
    dominant = data.get("dominant_mood")

    # Count each mood across the 7-day window
    mood_counts: dict[str, int] = {}
    for entry in days_data:
        m = entry.get("mood", "neutral")
        mood_counts[m] = mood_counts.get(m, 0) + 1

    if not days_data:
        return (
            "📊 ยังไม่มีข้อมูลอารมณ์ในช่วง 7 วันที่ผ่านมา\n\n"
            "ลองพิมพ์ระบายความรู้สึก หรือเลือก 2 เช็คอารมณ์\n"
            "แล้วกระจกจะเริ่มเก็บสถิติให้นะ 😊"
        )

    # Emoji + Thai label for each mood
    _EMOJI = {
        "stressed": "😣",
        "sad":      "😢",
        "tired":    "😴",
        "neutral":  "😐",
        "calm":     "😌",
        "positive": "😊",
    }
    _ORDER = ["positive", "calm", "neutral", "tired", "sad", "stressed"]

    # Build bar chart rows (max bar = 8 chars wide)
    max_count = max(mood_counts.values(), default=1)
    bar_rows = []
    for mood in _ORDER:
        if mood not in mood_counts:
            continue
        count = mood_counts[mood]
        label_th = MOOD_LABELS_TH.get(mood, mood)
        emoji = _EMOJI.get(mood, "💭")
        filled = round(count / max_count * 8)
        bar = "█" * filled + "░" * (8 - filled)
        bar_rows.append(f"{emoji} {label_th:<6}  {bar}  {count} วัน")

    # Overall trend sentence
    dominant_th = MOOD_LABELS_TH.get(dominant, dominant) if dominant else None
    dominant_emoji = _EMOJI.get(dominant, "💭") if dominant else ""
    if dominant in ("positive", "calm"):
        trend_line = f"แนวโน้มโดยรวม: ดี {dominant_emoji}"
    elif dominant in ("stressed", "sad"):
        trend_line = f"แนวโน้มโดยรวม: ต้องการดูแล {dominant_emoji}"
    elif dominant == "tired":
        trend_line = f"แนวโน้มโดยรวม: เหนื่อย ควรพักผ่อน {dominant_emoji}"
    else:
        trend_line = f"แนวโน้มโดยรวม: ปกติ {dominant_emoji}"

    # Active days label
    unique_days = len(days_data)

    lines = [
        "📊 สรุปอารมณ์ 7 วันที่ผ่านมา",
        "━━━━━━━━━━━━━━━",
        *bar_rows,
        "━━━━━━━━━━━━━━━",
        trend_line,
        f"บันทึกทั้งหมด {unique_days} วัน · {total_msgs} ข้อความ",
        "",
        "พิมพ์ เมนู เพื่อกลับหน้าหลัก",
    ]
    return "\n".join(lines)


async def handle_text(user_id: str, text: str) -> str:
    text = (text or "").strip()
    if not text:
        return "พิมพ์ข้อความมาได้เลยนะ"

    # Crisis check first — always takes priority
    if _is_crisis(text):
        _set_mode(user_id, "start")
        return CRISIS_REPLY

    mode = _get_mode(user_id)

    # Rich Menu shortcuts — image/voice guide
    if text in {"ตอบคำถามจากรูป"}:
        _set_mode(user_id, "start")
        return (
            "━━━━━━━━━━━━━━━\n"
            "📷 ตอบคำถามจากรูป\n"
            "━━━━━━━━━━━━━━━\n"
            "ถ่ายรูปการบ้าน โจทย์ หรือเนื้อหาที่ไม่เข้าใจ\n"
            "แล้วส่งรูปมาได้เลย กระจกจะอ่านและอธิบายให้ ✨\n\n"
            "💡 เคล็ดลับ: ถ่ายให้ตรง แสงพอ ตัวหนังสือชัด\n"
            "แล้วกระจกจะอ่านได้แม่นขึ้นนะ"
        )
    if text in {"แชทด้วยเสียง"}:
        _set_mode(user_id, "start")
        return (
            "━━━━━━━━━━━━━━━\n"
            "🎤 แชทด้วยเสียง\n"
            "━━━━━━━━━━━━━━━\n"
            "กดปุ่มไมค์ใน LINE แล้วพูดสิ่งที่อยากถามหรืออยากระบาย\n"
            "กระจกจะแปลงเสียงเป็นข้อความและตอบให้นะ 🎙️\n\n"
            "💡 เคล็ดลับ: พูดในที่เงียบ ๆ\n"
            "ชัดและช้านิดนึง กระจกจะเข้าใจได้ดีขึ้น"
        )

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
    if text in {"2", "อารมณ์", "emotion", "ความรู้สึก", "feeling", "เช็คอารมณ์"}:
        _set_mode(user_id, "emotion")
        return (
            "━━━━━━━━━━━━━━━\n"
            "โหมดเช็คอารมณ์\n"
            "━━━━━━━━━━━━━━━\n"
            "ส่งข้อความที่อยากระบาย หรือบอกว่าวันนี้รู้สึกยังไง\n"
            "กระจกจะอ่านอารมณ์จากข้อความให้นะ"
        )
    if text in {"3", "help", "ช่วยเหลือ", "เมนู", "menu", "วิธีใช้", "ข้อมูลแอป"}:
        _set_mode(user_id, "start")
        return HELP

    # Breathing exercise — trigger or repeat
    _BREATHE_TRIGGERS = {
        "หายใจ", "ลดเครียด", "breathe", "breathing",
        "คลายเครียด", "เครียดมาก", "หายใจคลาย", "ฝึกหายใจ",
    }
    if text in _BREATHE_TRIGGERS or (mode == "breathe" and text in {"อีกรอบ", "again", "repeat", "ทำอีก"}):
        _set_mode(user_id, "breathe")
        return BREATHE_REPLY

    # If in breathe mode but user typed something else — exit breathe mode and continue
    if mode == "breathe":
        _set_mode(user_id, "start")

    # Mood summary report
    _SUMMARY_TRIGGERS = {
        "สรุป", "ดูอารมณ์", "อารมณ์ฉัน", "สถิติ", "ประวัติ",
        "summary", "report", "mood history", "ดูสถิติ",
    }
    if text in _SUMMARY_TRIGGERS:
        _set_mode(user_id, "start")
        return _build_mood_summary(user_id)

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

        # Persist mood + check concern streak
        try:
            from app import store
            store.record_mood(user_id, mood, source="line_text", channel="line",
                              confidence=result.score, text_confidence=result.score)
            streak = store.concern_streak(user_id, window=3)
        except Exception:
            streak = 0

        reply = (
            f"━━━━━━━━━━━━━━━\n"
            f"ผลการวิเคราะห์อารมณ์\n"
            f"━━━━━━━━━━━━━━━\n\n"
            f"{emoji} รู้สึก: {mood_th}\n"
            f"ความมั่นใจ: {score}\n\n"
            f"ลองหายใจลึก ๆ สักครั้ง\n"
            f"แล้วค่อยเรียนต่อก็ได้นะ\n\n"
            f"พิมพ์ เมนู เพื่อกลับหน้าหลัก"
        )
        if streak >= 3:
            reply += (
                "\n\n━━━━━━━━━━━━━━━\n"
                "🔔 กระจกสังเกตว่าช่วงนี้คุณดูหนักใจอยู่นิดหน่อย\n"
                "ไม่เป็นไรนะ ทุกคนผ่านช่วงแบบนี้กันได้\n\n"
                "อยากระบายอะไรไหม? พิมพ์มาได้เลย\n"
                "หรือโทรคุยกับผู้เชี่ยวชาญก็ได้นะ\n"
                "📞 1323 ฟรี ตลอด 24 ชั่วโมง"
            )
        return reply

    # Default — LLM reply (study mode or free chat)
    # Run a quick sentiment check in the background to record mood + check streak
    _bg_mood: str = "neutral"
    _bg_streak: int = 0
    try:
        from app import store
        _sent = await sentiment.analyze_text(text)
        if _sent.ok:
            _bg_mood = classify_mood(
                text,
                _sent.polarity if hasattr(_sent, "polarity") else None,
                _sent.score,
            )
        store.record_mood(user_id, _bg_mood, source="line_chat", channel="line",
                          confidence=getattr(_sent, "score", None) if _sent.ok else None,
                          text_confidence=getattr(_sent, "score", None) if _sent.ok else None)
        _bg_streak = store.concern_streak(user_id, window=3)
    except Exception:
        pass

    result = await pathumma.generate_reply(text)
    if not result.ok:
        logger.warning("Pathumma failed for %s: %s", user_id, result.error)
        return (
            "ขณะนี้ AI ยังตอบไม่ได้ชั่วคราว\n"
            "ลองส่งใหม่อีกสักครู่นะ\n\n"
            "พิมพ์ เมนู เพื่อดูตัวเลือกอื่น"
        )

    reply = strip_latex_for_line(result.text or "...")
    # Append subtle footer for study mode to remind about other features
    if mode == "study" and len(reply) < 4500:
        reply += "\n\n─────────────────\nพิมพ์ เมนู เพื่อดูตัวเลือกอื่น"

    # Concern streak alert — append after LLM reply if streak ≥ 3
    if _bg_streak >= 3 and len(reply) < 4700:
        reply += (
            "\n\n━━━━━━━━━━━━━━━\n"
            "🔔 กระจกสังเกตว่าช่วงนี้คุณดูหนักใจอยู่นิดหน่อย\n"
            "ไม่เป็นไรนะ ทุกคนผ่านช่วงแบบนี้กันได้\n\n"
            "อยากระบายอะไรไหม? พิมพ์มาได้เลย\n"
            "หรือโทรคุยกับผู้เชี่ยวชาญก็ได้นะ\n"
            "📞 1323 ฟรี ตลอด 24 ชั่วโมง"
        )
    return reply
