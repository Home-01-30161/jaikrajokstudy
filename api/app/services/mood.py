"""Mood classification for the six moods the web UI renders.

The UI needs one of stressed / sad / tired / neutral / calm / positive. The
sentiment API (/ssense) only returns positive / negative / neutral, so the
coarse polarity is refined with Thai lexical cues. This is deliberately
transparent and cheap: no extra model round-trip per message, and the LLM reply
is still generated from the full text, not from this label.
"""

from __future__ import annotations

UI_MOODS = ("stressed", "sad", "tired", "neutral", "calm", "positive")

# Strong cues name a feeling outright, so they outrank sentiment polarity.
# Ordered so a message carrying several resolves to the mood needing most care.
_STRONG: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "stressed",
        ("เครียด", "กดดัน", "กังวล", "วิตก", "ประหม่า", "หนักมาก", "รับไม่ไหว"),
    ),
    (
        "tired",
        ("เหนื่อย", "ง่วง", "อ่อนเพลีย", "หมดแรง", "ไม่มีแรง", "เพลีย"),
    ),
    (
        "sad",
        ("เศร้า", "ร้องไห้", "เสียใจ", "ท้อ", "หมดกำลังใจ", "เหงา", "โดดเดี่ยว", "ผิดหวัง"),
    ),
    (
        "positive",
        ("ดีใจ", "สนุก", "เยี่ยม", "มีความสุข", "ภูมิใจ", "สุดยอด", "ชอบมาก"),
    ),
    (
        "calm",
        ("สงบ", "ผ่อนคลาย", "สบายใจ", "โล่งใจ", "ปกติดี"),
    ),
)

# Weak cues are topics or situations, not feelings ("สอบ", "การบ้าน"). They only
# decide the mood when sentiment already leans the same way, so "สอบผ่าน ดีใจมาก"
# is not filed as stress just because it mentions an exam.
_WEAK: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("stressed", ("สอบ", "การบ้านเยอะ", "ไม่ทัน", "เดดไลน์", "งานเยอะ", "รีบ")),
    ("tired", ("นอนไม่พอ", "อดนอน", "ตื่นเช้า", "พักผ่อนน้อย")),
    ("calm", ("สบาย", "โอเค", "พร้อมแล้ว")),
    ("positive", ("สำเร็จ", "ผ่านแล้ว", "ทำได้")),
)

_NEGATIVE_MOODS = ("stressed", "sad", "tired")


def classify(text: str, polarity: str | None, score: float | None) -> str:
    """Map text plus sentiment polarity onto one of UI_MOODS.

    Args:
        text: The user's message.
        polarity: "positive" / "negative" / "neutral" from /ssense, or None
            when the sentiment call failed.
        score: Confidence in [0,1], or None.

    Returns:
        One of UI_MOODS. Never raises, so a caller can rely on a usable label.
    """
    lowered = (text or "").lower()
    conf = score or 0.0

    strong_hits = [m for m, cues in _STRONG if any(c in lowered for c in cues)]

    if strong_hits:
        # A positive feeling word alongside a negative one usually means the
        # worry is being described as resolved ("เครียดมาก แต่สอบผ่าน ดีใจ"),
        # and sentiment agreeing tips it positive.
        if (
            polarity == "positive"
            and "positive" in strong_hits
            and strong_hits[0] in _NEGATIVE_MOODS
        ):
            return "positive"
        return strong_hits[0]

    weak_hits = [m for m, cues in _WEAK if any(c in lowered for c in cues)]
    for mood in weak_hits:
        agrees = (
            (mood in _NEGATIVE_MOODS and polarity == "negative")
            or (mood in ("calm", "positive") and polarity == "positive")
        )
        if agrees:
            return mood

    # No usable cue: fall back to polarity alone.
    if polarity == "negative":
        return "stressed" if conf >= 0.75 else "sad"
    if polarity == "positive":
        return "positive" if conf >= 0.75 else "calm"
    return "neutral"


# Thai labels mirror the EMO table in the frontend so both stay in sync.
MOOD_LABELS_TH: dict[str, str] = {
    "stressed": "เครียด",
    "tired": "เหนื่อย",
    "neutral": "ปกติ",
    "calm": "สงบ",
    "sad": "เศร้า",
    "positive": "สดใส",
}
