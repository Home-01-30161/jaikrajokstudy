"""Phase 1 conversation flow (in-memory)."""

from __future__ import annotations

import threading
import time

from app.services import pathumma, sentiment
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

WELCOME = (
    "สวัสดี เราคือ JaiKrajok (ใจกระจก) เพื่อนช่วยเรียนที่ใส่ใจอารมณ์\n\n"
    "พิมพ์เลขเมนู:\n"
    "1) คุยเรื่องเรียน\n"
    "2) เช็คอารมณ์จากข้อความ\n"
    "3) วิธีใช้ / ช่วยเหลือ\n\n"
    "หรือพิมพ์คำถามเรียนมาได้เลย"
)

HELP = (
    "วิธีใช้:\n"
    "- เมนู 1: ถามเรื่องเรียน เราจะช่วยอธิบาย\n"
    "- เมนู 2: ส่งข้อความ เราจะประมาณอารมณ์จากข้อความ\n\n"
    "หมายเหตุ: เราไม่ใช่บริการฉุกเฉินหรือแพทย์ "
    "หากทุกข์ใจมาก ติดต่อสายด่วนสุขภาพจิต 1323"
)

CRISIS_KEYWORDS = ("ฆ่าตัวตาย", "อยากตาย", "ทำร้ายตัวเอง", "ไม่มีค่า")


async def handle_text(user_id: str, text: str) -> str:
    text = (text or "").strip()
    if not text:
        return "พิมพ์ข้อความมาได้เลยนะ"

    if any(k in text for k in CRISIS_KEYWORDS):
        _set_mode(user_id, "start")
        return (
            "เราห่วงใยคุณมาก ตอนนี้คุณไม่ได้อยู่คนเดียว "
            "โปรดติดต่อสายด่วนสุขภาพจิต 1323 "
            "หรือคนที่ไว้ใจใกล้ตัวด้วยนะ"
        )

    mode = _get_mode(user_id)

    if text in {"1", "เรียน", "study"}:
        _set_mode(user_id, "study")
        return "โหมดเรียนแล้ว ส่งคำถามมาได้เลย"
    if text in {"2", "อารมณ์", "emotion"}:
        _set_mode(user_id, "emotion")
        return "โหมดเช็คอารมณ์ ส่งข้อความที่อยากให้เราอ่านได้เลย"
    if text in {"3", "help", "ช่วยเหลือ", "เมนู", "menu"}:
        _set_mode(user_id, "start")
        return HELP + "\n\n" + WELCOME

    if mode == "emotion":
        result = await sentiment.analyze_text(text)
        _set_mode(user_id, "start")
        if not result.ok:
            return f"เช็คอารมณ์ไม่สำเร็จตอนนี้ ({result.error}). ลองใหม่หรือพิมพ์ เมนู"
        label = result.label or "unknown"
        score = f"{result.score:.2f}" if result.score is not None else "-"
        return (
            f"จากการอ่านข้อความ โดยประมาณรู้สึก: {label} (ความมั่นใจ {score})\n"
            "พักหายใจลึก ๆ สักครั้งแล้วค่อยเรียนต่อก็ได้นะ\n"
            "พิมพ์ เมนู เพื่อกลับเมนูหลัก"
        )

    result = await pathumma.generate_reply(text)
    if not result.ok:
        logger.warning("Pathumma failed for %s: %s", user_id, result.error)
        return (
            "ตอนนี้สมอง AI ตอบช้าหรือยังตั้งค่า API ไม่ครบ "
            f"({result.error}). ตรวจ .env แล้วลองใหม่ หรือพิมพ์ เมนู"
        )
    return result.text or "..."
