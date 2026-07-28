"""Mood classifier tests.

These pin the behaviour that broke first: a topic word like "สอบ" (exam) must
not override a clearly positive message.
"""

import pytest

from app.services.mood import UI_MOODS, MOOD_LABELS_TH, classify


@pytest.mark.parametrize(
    "text,polarity,score,expected",
    [
        # Strong feeling words win over topic words.
        ("วันนี้สอบผ่าน ดีใจมาก", "positive", 0.75, "positive"),
        ("พรุ่งนี้สอบเลข เครียดมากเลย อ่านไม่ทัน", "negative", 0.9, "stressed"),
        ("เหนื่อยมาก อ่านหนังสือทั้งคืน", "negative", 0.8, "tired"),
        ("วันนี้สอบตก รู้สึกท้อมาก", "negative", 0.8, "sad"),
        ("วันนี้รู้สึกโล่งใจ", "positive", 0.6, "calm"),
        # A resolved worry reads positive, not stressed.
        ("เครียดมาก แต่สอบผ่าน ดีใจ", "positive", 0.8, "positive"),
        # Weak cue only counts when sentiment agrees.
        ("พรุ่งนี้มีสอบ", "negative", 0.6, "stressed"),
        ("พรุ่งนี้มีสอบ", "neutral", 0.5, "neutral"),
        # No cue at all: polarity decides.
        ("ช่วยอธิบาย photosynthesis", "neutral", 0.5, "neutral"),
        ("แย่มากเลย", "negative", 0.9, "stressed"),
        ("แย่นิดหน่อย", "negative", 0.5, "sad"),
    ],
)
def test_classify(text, polarity, score, expected):
    assert classify(text, polarity, score) == expected


def test_classify_survives_missing_sentiment():
    """A failed sentiment call must still yield a renderable mood."""
    assert classify("เครียดจัด", None, None) == "stressed"
    assert classify("", None, None) == "neutral"
    assert classify("อะไรก็ไม่รู้", None, None) == "neutral"


def test_every_mood_has_a_thai_label():
    """The UI renders MOOD_LABELS_TH directly, so no mood may be missing."""
    assert set(MOOD_LABELS_TH) == set(UI_MOODS)
