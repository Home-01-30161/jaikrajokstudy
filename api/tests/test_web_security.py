from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.utils.security import SESSION_COOKIE


def test_data_routes_require_a_session():
    client = TestClient(app)

    assert client.get("/trend").status_code == 401
    assert client.get("/data/export").status_code == 401
    assert client.delete("/data").status_code == 401


def test_session_is_issued_and_old_user_id_routes_are_gone():
    settings = get_settings()
    settings.app_env = "test"
    settings.session_secret = "test-session-secret"
    client = TestClient(app)

    response = client.post("/session")
    assert response.status_code == 200
    assert "jaikrajok_session=" in response.headers.get("set-cookie", "")
    assert client.get("/trend").status_code == 200
    assert client.get("/trend/someone-else").status_code == 404


def test_upload_content_type_is_checked_after_authentication():
    settings = get_settings()
    settings.app_env = "test"
    settings.session_secret = "test-session-secret"
    client = TestClient(app)
    client.post("/session")

    response = client.post(
        "/selfie/analyze",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 415


def test_tampered_or_malformed_session_cookie_is_rejected():
    settings = get_settings()
    settings.app_env = "test"
    settings.session_secret = "test-session-secret"
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE, "not-a-valid-token")

    assert client.get("/trend").status_code == 401


def test_tts_input_is_bounded_before_upstream_processing():
    settings = get_settings()
    settings.app_env = "test"
    settings.session_secret = "test-session-secret"
    client = TestClient(app)
    client.post("/session")

    response = client.post("/tts/speak", json={"text": "x" * 301})
    assert response.status_code == 422


def test_production_rejects_a_short_session_secret(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "session_secret", "too-short")
    client = TestClient(app)

    assert client.get("/health").status_code == 503
    assert client.post("/session").status_code == 503


def test_security_headers_are_added_to_api_and_frontend_responses(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "session_secret", "test-session-secret")
    client = TestClient(app)

    for response in (client.get("/health"), client.get("/")):
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["referrer-policy"] == "no-referrer"
        assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
        assert response.headers["x-request-id"]
