"""Reply sanitising tests.

Two things must never reach a student: the reasoning model's <think> scratchpad,
and emoji. The system prompt asks for no emoji but the model only complies
intermittently, so the output filter is what actually holds the guarantee.
"""

import pytest

from app.services.pathumma import _strip_emoji, _strip_reasoning


@pytest.mark.parametrize(
    "raw,expected",
    [
        # Plain Thai text is untouched.
        ("ดีใจด้วยนะที่รู้สึกดีขึ้น", "ดีใจด้วยนะที่รู้สึกดีขึ้น"),
        # Pictographs and dingbats from the two blocks the model uses most.
        ("ดีใจด้วยนะ 📚✨", "ดีใจด้วยนะ"),
        ("สู้ๆ นะ ❤ ☀", "สู้ๆ นะ"),
        # Emoji mid-sentence must not leave a double space behind.
        ("อ่าน 📖 หนังสือ", "อ่าน หนังสือ"),
        # A stranded space before punctuation is closed up.
        ("เก่งมาก 🎉!", "เก่งมาก!"),
        # ZWJ sequences and variation selectors go with the glyph.
        ("ครอบครัว 👨‍👩‍👧 ของเรา", "ครอบครัว ของเรา"),
        # Flags are a surrogate pair of regional indicators, not a pictograph.
        ("ประเทศไทย 🇹🇭", "ประเทศไทย"),
        # Newlines survive so multi-line explanations keep their shape.
        ("ขั้นที่ 1 ✅\nขั้นที่ 2 ✅", "ขั้นที่ 1\nขั้นที่ 2"),
        # Thai numerals and ASCII maths must not be mistaken for symbols.
        ("คำตอบคือ ๗ + 3 = 10", "คำตอบคือ ๗ + 3 = 10"),
    ],
)
def test_strip_emoji(raw: str, expected: str) -> None:
    assert _strip_emoji(raw) == expected


def test_strip_emoji_leaves_nothing_when_reply_is_only_emoji() -> None:
    """An emoji-only reply must come back empty so the caller can fall back
    rather than send a blank bubble."""
    assert _strip_emoji("😀😀😀") == ""


def test_reasoning_block_removed_before_emoji_filter() -> None:
    """The two filters compose: scratchpad first, then glyphs."""
    raw = "<think>the user seems happy</think>ดีใจด้วยนะ 🎉"
    assert _strip_emoji(_strip_reasoning(raw)) == "ดีใจด้วยนะ"


def test_unclosed_reasoning_block_yields_empty() -> None:
    """Hitting max_tokens mid-thought leaves no usable answer."""
    assert _strip_reasoning("<think>still thinking about") == ""
