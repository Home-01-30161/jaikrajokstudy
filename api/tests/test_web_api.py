from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app import store
from app.api import web_chat
from app.config import get_settings
from app.main import app
from app.services.base import SentimentResult, ServiceResult
from app.utils import security


@pytest.fixture(autouse=True)
def isolated_backend(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """Give each test a private SQLite database and rate-limit bucket."""
    if store._conn is not None:
        store._conn.close()
        store._conn = None

    monkeypatch.setenv("JAIKRAJOK_DB_PATH", str(tmp_path / "jaikrajok.db"))
    settings = get_settings()
    settings.app_env = "test"
    settings.session_secret = "test-session-secret"
    security._rate_windows.clear()

    yield

    if store._conn is not None:
        store._conn.close()
        store._conn = None
    security._rate_windows.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def authenticated_client(client: TestClient) -> TestClient:
    response = client.post("/session")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    return client


def sentiment_result(*, polarity: str = "positive", score: float = 0.88) -> ServiceResult:
    return ServiceResult(
        service="sentiment",
        ok=True,
        sentiment=SentimentResult(label=polarity, polarity=polarity, score=score),
    )


def llm_result(text: str = "A helpful reply") -> ServiceResult:
    return ServiceResult(service="pathumma", ok=True, text=text)


def upload(name: str, content_type: str = "image/jpeg") -> dict:
    return {"file": (name, b"test payload", content_type)}


def test_create_session_issues_cookie_and_enables_protected_calls(client: TestClient):
    response = client.post("/session")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert "jaikrajok_session=" in response.headers["set-cookie"]
    assert client.get("/trend").status_code == 200


def test_send_message_returns_frontend_chat_shape(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    sentiment = AsyncMock(return_value=sentiment_result())
    reply = AsyncMock(return_value=llm_result("You can handle this."))
    monkeypatch.setattr(web_chat, "analyze_sentiment", sentiment)
    monkeypatch.setattr(web_chat.pathumma, "generate_reply", reply)

    response = authenticated_client.post("/chat/send", json={"message": "I feel good"})

    assert response.status_code == 200
    assert response.json() == {
        "reply": "You can handle this.",
        "emotion": "positive",
        "mood": "positive",
        "confidence": 0.88,
        "crisis": False,
        "service": "sentiment+llm",
        "degraded": [],
    }
    sentiment.assert_awaited_once_with("I feel good")
    reply.assert_awaited_once()


def test_crisis_message_bypasses_external_ai(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    sentiment = AsyncMock(side_effect=AssertionError("sentiment must be bypassed"))
    reply = AsyncMock(side_effect=AssertionError("LLM must be bypassed"))
    monkeypatch.setattr(web_chat, "analyze_sentiment", sentiment)
    monkeypatch.setattr(web_chat.pathumma, "generate_reply", reply)

    response = authenticated_client.post(
        "/chat/send", json={"message": web_chat.CRISIS_KEYWORDS[0]}
    )

    body = response.json()
    assert response.status_code == 200
    assert body["crisis"] is True
    assert body["mood"] == "sad"
    assert body["service"] == "safety"
    assert body["emotion"] == "negative"
    assert body["confidence"] is None
    sentiment.assert_not_awaited()
    reply.assert_not_awaited()


def test_analyze_emotion_success_and_degraded_fallback(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    analyze = AsyncMock(return_value=sentiment_result(polarity="negative", score=0.91))
    monkeypatch.setattr(web_chat, "analyze_sentiment", analyze)

    response = authenticated_client.post("/emotion/analyze", json={"text": "I am worried"})

    assert response.status_code == 200
    assert response.json() == {
        "emotion": "negative",
        "polarity": "negative",
        "confidence": 0.91,
        "mood": "stressed",
    }

    analyze.return_value = ServiceResult(service="sentiment", ok=False, error="upstream")
    fallback = authenticated_client.post("/emotion/analyze", json={"text": "anything"})
    assert fallback.status_code == 200
    assert fallback.json() == {
        "emotion": "neutral",
        "polarity": "neutral",
        "confidence": 0.5,
        "mood": "neutral",
    }


def test_selfie_face_detected_and_no_face_results(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    detect = AsyncMock(
        return_value=ServiceResult(
            service="face", ok=True, raw={"objects": [{"score": 0.93}]}
        )
    )
    monkeypatch.setattr(web_chat.face, "analyze_image", detect)

    detected = authenticated_client.post("/selfie/analyze", files=upload("selfie.jpg"))
    assert detected.status_code == 200
    assert detected.json()["ok"] is True
    assert detected.json()["service"] == "face"
    assert "1" in detected.json()["detail"]

    detect.return_value = ServiceResult(service="face", ok=True, raw={"objects": []})
    no_face = authenticated_client.post("/selfie/analyze", files=upload("selfie.jpg"))
    assert no_face.status_code == 200
    assert no_face.json()["ok"] is True
    assert no_face.json()["detail"]


def test_selfie_provider_failure_is_a_degraded_analysis(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(
        web_chat.face,
        "analyze_image",
        AsyncMock(return_value=ServiceResult(service="face", ok=False, error="timeout")),
    )

    response = authenticated_client.post("/selfie/analyze", files=upload("selfie.jpg"))

    assert response.status_code == 200
    assert response.json()["ok"] is False
    assert response.json()["service"] == "face"
    assert response.json()["error"] == "timeout"


def test_voice_transcription_runs_text_pipeline(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    transcribe = AsyncMock(
        return_value=ServiceResult(service="stt", ok=True, text="I passed my exam")
    )
    sentiment = AsyncMock(return_value=sentiment_result())
    reply = AsyncMock(return_value=llm_result("That is great."))
    monkeypatch.setattr(web_chat.stt, "transcribe", transcribe)
    monkeypatch.setattr(web_chat, "analyze_sentiment", sentiment)
    monkeypatch.setattr(web_chat.pathumma, "generate_reply", reply)

    response = authenticated_client.post(
        "/voice/transcribe", files=upload("voice.webm", "audio/webm")
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "mood": "positive",
        "reply": "That is great.",
        "detail": None,
        "transcript": "I passed my exam",
        "service": "stt+llm",
        "error": None,
    }
    transcribe.assert_awaited_once_with(
        b"test payload", filename="voice.webm", content_type="audio/webm"
    )


def test_voice_transcription_failure_is_renderable(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(
        web_chat.stt,
        "transcribe",
        AsyncMock(return_value=ServiceResult(service="stt", ok=False, error="no speech")),
    )

    response = authenticated_client.post(
        "/voice/transcribe", files=upload("voice.webm", "audio/webm")
    )

    assert response.status_code == 200
    assert response.json()["ok"] is False
    assert response.json()["service"] == "stt"
    assert response.json()["error"] == "no speech"


def test_homework_ocr_returns_extracted_text_and_reply(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    extract = AsyncMock(
        return_value=ServiceResult(service="ocr", ok=True, text="2 + 2 = 4")
    )
    reply = AsyncMock(return_value=llm_result("Add the two numbers."))
    monkeypatch.setattr(web_chat.ocr, "extract_text", extract)
    monkeypatch.setattr(web_chat.pathumma, "generate_reply", reply)

    response = authenticated_client.post("/homework/ocr", files=upload("homework.jpg"))

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "mood": "neutral",
        "reply": "Add the two numbers.",
        "detail": "2 + 2 = 4",
        "transcript": "2 + 2 = 4",
        "service": "ocr+llm",
        "error": None,
    }
    extract.assert_awaited_once_with(b"test payload")


def test_homework_ocr_failure_does_not_call_llm(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(
        web_chat.ocr,
        "extract_text",
        AsyncMock(return_value=ServiceResult(service="ocr", ok=False, error="unreadable")),
    )
    reply = AsyncMock(side_effect=AssertionError("LLM must not run when OCR fails"))
    monkeypatch.setattr(web_chat.pathumma, "generate_reply", reply)

    response = authenticated_client.post("/homework/ocr", files=upload("homework.jpg"))

    assert response.status_code == 200
    assert response.json()["ok"] is False
    assert response.json()["service"] == "ocr"
    assert response.json()["error"] == "unreadable"
    reply.assert_not_awaited()


def test_trend_export_and_delete_share_the_frontend_contract(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(web_chat, "analyze_sentiment", AsyncMock(return_value=sentiment_result()))
    monkeypatch.setattr(
        web_chat.pathumma, "generate_reply", AsyncMock(return_value=llm_result())
    )
    assert authenticated_client.post("/chat/send", json={"message": "I feel good"}).status_code == 200

    trend = authenticated_client.get("/trend")
    assert trend.status_code == 200
    trend_body = trend.json()
    assert trend_body["messages"] == 1
    assert trend_body["active_days"] == 1
    assert trend_body["dominant_mood"] == "positive"
    assert len(trend_body["days"]) == 1
    assert trend_body["days"][0]["mood"] == "positive"
    assert isinstance(trend_body["labels"], dict)
    assert "positive" in trend_body["labels"]

    exported = authenticated_client.get("/data/export")
    assert exported.status_code == 200
    export_body = exported.json()
    assert export_body["messages"] == 1
    assert len(export_body["readings"]) == 1
    reading = export_body["readings"][0]
    assert reading["mood"] == "positive"
    assert reading["source"] == "text"
    assert reading["confidence"] == 0.88
    assert "user_id" not in export_body

    deleted = authenticated_client.delete("/data")
    assert deleted.status_code == 200
    assert deleted.json() == {"deleted": 2}

    after_delete = authenticated_client.get("/data/export")
    assert after_delete.status_code == 200
    assert after_delete.json()["messages"] == 0
    assert after_delete.json()["readings"] == []


def test_school_overview_is_suppressed_until_anonymity_threshold(
    authenticated_client: TestClient,
):
    response = authenticated_client.get("/school/overview")

    assert response.status_code == 200
    assert response.json() == {
        "users": 0,
        "readings": 0,
        "distribution": {},
        "stress_ratio": None,
        "regular_ratio": None,
        "suppressed": True,
    }


def test_health_returns_frontend_status_shape(client: TestClient):
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"] == "jaikrajok"
    assert body["session_configured"] is True
    assert isinstance(body["line_configured"], bool)
    assert isinstance(body["aiforthai_key_set"], bool)


def test_tts_returns_wav_bytes_and_maps_provider_failure(
    authenticated_client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    synthesize = AsyncMock(
        return_value=ServiceResult(service="tts", ok=True, data=b"RIFF-test-wav")
    )
    monkeypatch.setattr(web_chat.tts, "synthesize", synthesize)

    response = authenticated_client.post("/tts/speak", json={"text": "Read this"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert response.content == b"RIFF-test-wav"
    synthesize.assert_awaited_once_with("Read this")

    synthesize.return_value = ServiceResult(service="tts", ok=False, error="upstream")
    failed = authenticated_client.post("/tts/speak", json={"text": "Read this"})
    assert failed.status_code == 502
    assert failed.json()["detail"] == "upstream"


@pytest.mark.parametrize(
    ("method", "path", "kwargs"),
    [
        ("post", "/chat/send", {"json": {"message": "hello"}}),
        ("post", "/emotion/analyze", {"json": {"text": "hello"}}),
        ("post", "/selfie/analyze", {"files": upload("selfie.jpg")}),
        ("post", "/voice/transcribe", {"files": upload("voice.webm", "audio/webm")}),
        ("post", "/homework/ocr", {"files": upload("homework.jpg")}),
        ("post", "/tts/speak", {"json": {"text": "hello"}}),
        ("get", "/trend", {}),
        ("get", "/school/overview", {}),
        ("get", "/data/export", {}),
        ("delete", "/data", {}),
    ],
)
def test_all_protected_frontend_routes_require_session(
    client: TestClient, method: str, path: str, kwargs: dict
):
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 401


def test_frontend_upload_and_text_validation_errors(
    authenticated_client: TestClient,
):
    assert authenticated_client.post(
        "/selfie/analyze", files=upload("notes.txt", "text/plain")
    ).status_code == 415
    assert authenticated_client.post(
        "/voice/transcribe", files=upload("notes.txt", "text/plain")
    ).status_code == 415
    assert authenticated_client.post(
        "/homework/ocr", files=upload("voice.mp3", "audio/mpeg")
    ).status_code == 415
    assert authenticated_client.post("/chat/send", json={"message": "   "}).status_code == 400
    assert authenticated_client.post("/emotion/analyze", json={"text": "   "}).status_code == 400
    assert authenticated_client.post("/tts/speak", json={"text": "   "}).status_code == 400
