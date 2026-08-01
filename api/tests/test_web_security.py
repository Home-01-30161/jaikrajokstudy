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
