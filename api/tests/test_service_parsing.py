from __future__ import annotations

import asyncio
import time
from collections import deque
from unittest.mock import AsyncMock

from fastapi import Request

from app.api import web_chat
from app.bots import conversation
from app.config import get_settings
from app.services import pathumma, sentiment
from app.services.base import ServiceResult
from app.utils import security


def test_sentiment_preserves_a_valid_zero_score(monkeypatch) -> None:
    monkeypatch.setattr(
        sentiment,
        "analyze_text",
        AsyncMock(
            return_value=ServiceResult(
                service="sentiment", ok=True, label="neutral", score=0.0
            )
        ),
    )

    result = asyncio.run(sentiment.analyze_sentiment("ทดสอบ"))

    assert result.sentiment is not None
    assert result.sentiment.score == 0.0


def test_sentiment_parser_does_not_replace_zero_with_another_field() -> None:
    assert sentiment._parse_sentiment(
        {"sentiment": "negative", "score": 0, "confidence": 0.9}
    ) == ("negative", 0.0)


def test_unrecognised_llm_json_is_not_shown_as_a_reply() -> None:
    assert pathumma._extract_text({"error": "upstream failed"}) == ""
    assert pathumma._extract_text({"metadata": {"request": "abc"}}) == ""


def test_rate_limit_bucket_map_stays_bounded(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "session_secret", "test-session-secret")
    monkeypatch.setattr(security, "_RATE_MAX_BUCKETS", 2)
    security._rate_windows.clear()
    now = time.monotonic()
    security._rate_windows["older"] = deque([now - 10])
    security._rate_windows["newer"] = deque([now - 5])
    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/bounded",
            "raw_path": b"/bounded",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
        }
    )

    security.enforce_rate_limit(request)

    assert len(security._rate_windows) == 2
    assert "127.0.0.1:GET:/bounded" in security._rate_windows
    assert "older" not in security._rate_windows


def test_line_mode_map_stays_bounded(monkeypatch) -> None:
    monkeypatch.setattr(conversation, "_SESSION_MAX_ENTRIES", 2)
    conversation._sessions.clear()
    conversation._sessions["older"] = ("study", time.monotonic() - 10)
    conversation._sessions["newer"] = ("emotion", time.monotonic() - 5)

    conversation._set_mode("latest", "study")

    assert len(conversation._sessions) == 2
    assert "latest" in conversation._sessions
    assert "older" not in conversation._sessions


def test_web_and_line_crisis_terms_cover_core_self_harm_phrases() -> None:
    shared = {"ฆ่าตัวตาย", "อยากตาย", "ทำร้ายตัวเอง"}
    assert shared.issubset(set(web_chat.CRISIS_KEYWORDS))
    assert shared.issubset(set(conversation.CRISIS_KEYWORDS))
