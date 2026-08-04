"""Security helpers for request IDs, sessions, and lightweight abuse control."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import secrets
import threading
import time
from collections import deque

from fastapi import HTTPException, Request, Response

from app.config import get_settings

SESSION_COOKIE = "jaikrajok_session"
_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
_MIN_PRODUCTION_SECRET_CHARS = 32
_DEV_SESSION_SECRET = secrets.token_urlsafe(32)
_RATE_WINDOW_SECONDS = 60.0
_RATE_LIMITS = {"GET": 60, "POST": 20, "DELETE": 20}
_RATE_MAX_BUCKETS = 10_000
_rate_lock = threading.Lock()
_rate_windows: dict[str, deque[float]] = {}


def new_request_id() -> str:
    return secrets.token_hex(8)


def _session_secret() -> bytes:
    settings = get_settings()
    if settings.session_secret:
        if (
            settings.app_env.lower() == "production"
            and len(settings.session_secret) < _MIN_PRODUCTION_SECRET_CHARS
        ):
            raise HTTPException(
                status_code=503,
                detail="Session signing key must be at least 32 characters",
            )
        return settings.session_secret.encode("utf-8")
    if settings.app_env.lower() == "production":
        raise HTTPException(status_code=503, detail="Session signing key is not configured")
    return _DEV_SESSION_SECRET.encode("utf-8")


def _encode(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("ascii").rstrip("=")


def _decode(value: str) -> str | None:
    try:
        padded = value + "=" * (-len(value) % 4)
        return base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
    except (binascii.Error, ValueError, UnicodeError):
        return None


def _signature(payload: str) -> str:
    digest = hmac.new(_session_secret(), payload.encode("ascii"), hashlib.sha256).hexdigest()
    return _encode(digest)


def _session_token(user_id: str) -> str:
    payload = _encode(f"{user_id}|{int(time.time())}")
    return f"{payload}.{_signature(payload)}"


def _session_user(token: str | None) -> str | None:
    if not token or token.count(".") != 1:
        return None
    payload, supplied = token.split(".", 1)
    try:
        if not hmac.compare_digest(supplied, _signature(payload)):
            return None
    except (UnicodeError, ValueError):
        return None
    decoded = _decode(payload)
    if not decoded or "|" not in decoded:
        return None
    user_id, issued_at_raw = decoded.rsplit("|", 1)
    try:
        issued_at = int(issued_at_raw)
    except ValueError:
        return None
    now = int(time.time())
    if issued_at < now - _SESSION_TTL_SECONDS or issued_at > now + 300:
        return None
    if not user_id or len(user_id) > 128:
        return None
    return user_id


def create_session(response: Response, request: Request) -> str:
    """Reuse a valid session or issue a new pseudonymous server-owned identity."""
    user_id = _session_user(request.cookies.get(SESSION_COOKIE))
    if user_id is None:
        user_id = f"web_{secrets.token_urlsafe(24)}"

    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        _session_token(user_id),
        max_age=_SESSION_TTL_SECONDS,
        httponly=True,
        secure=settings.app_env.lower() == "production",
        samesite="lax",
        path="/",
    )
    return user_id


def require_session(request: Request) -> str:
    user_id = _session_user(request.cookies.get(SESSION_COOKIE))
    if user_id is None:
        raise HTTPException(status_code=401, detail="A valid session is required")
    return user_id


def enforce_rate_limit(request: Request) -> None:
    """Bound unauthenticated and authenticated traffic per client and route."""
    now = time.monotonic()
    method = request.method.upper()
    limit = _RATE_LIMITS.get(method, 60)
    client = request.client.host if request.client else "unknown"
    # Behind the shared reverse proxy every browser has the same source IP.
    # A valid signed session gives authenticated users an independent bucket;
    # unauthenticated traffic remains bounded by the client address.
    identity = _session_user(request.cookies.get(SESSION_COOKIE)) or client
    key = f"{identity}:{method}:{request.url.path}"

    with _rate_lock:
        if key not in _rate_windows and len(_rate_windows) >= _RATE_MAX_BUCKETS:
            cutoff = now - _RATE_WINDOW_SECONDS
            for stale_key, stale_window in list(_rate_windows.items()):
                while stale_window and stale_window[0] <= cutoff:
                    stale_window.popleft()
                if not stale_window:
                    _rate_windows.pop(stale_key, None)

            if len(_rate_windows) >= _RATE_MAX_BUCKETS:
                oldest_key = min(
                    _rate_windows,
                    key=lambda bucket_key: _rate_windows[bucket_key][-1],
                )
                _rate_windows.pop(oldest_key, None)

        window = _rate_windows.setdefault(key, deque())
        cutoff = now - _RATE_WINDOW_SECONDS
        while window and window[0] <= cutoff:
            window.popleft()
        if len(window) >= limit:
            retry_after = max(1, int(window[0] + _RATE_WINDOW_SECONDS - now))
            raise HTTPException(
                status_code=429,
                detail="Too many requests; please try again shortly",
                headers={"Retry-After": str(retry_after)},
            )
        window.append(now)
