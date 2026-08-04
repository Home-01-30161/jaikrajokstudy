"""JaiKrajok FastAPI entrypoint."""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.webhooks.line import router as line_router
from app.api.web_chat import router as web_router
from app.config import get_settings
from app.utils.logging import setup_logging
from app.utils.security import new_request_id

setup_logging()
settings = get_settings()

# The hackathon reverse proxy strips the /api prefix before reaching this
# container, so routes stay unprefixed (/health) while the public URL is
# https://team07.aiforthai.in.th/api/health. root_path keeps /api/docs working.
app = FastAPI(
    title="JaiKrajok",
    description="AI Emotion-Aware Study Buddy (Phase 1)",
    version="0.1.0",
    root_path=settings.root_path,
)

# CORS for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.cors_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = (
        "camera=(self), microphone=(self), geolocation=()"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob:; "
        "media-src 'self' blob:; "
        "connect-src 'self'; "
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; "
        "form-action 'self'"
    )
    response.headers["X-Request-ID"] = new_request_id()
    if settings.app_env.lower() == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response

app.include_router(line_router)
app.include_router(web_router)


@app.get("/health")
async def health() -> dict:
    """Required by the deploy pipeline: must return 200 when ready."""
    session_configured = (
        len(settings.session_secret) >= 32
        or settings.app_env.lower() != "production"
    )
    if not session_configured:
        raise HTTPException(
            status_code=503,
            detail="SESSION_SECRET must be configured with at least 32 characters",
        )
    return {
        "status": "ok",
        "app": "jaikrajok",
        "team": settings.team,
        "env": settings.app_env,
        "line_configured": bool(
            settings.line_channel_access_token and settings.line_channel_secret
        ),
        "aiforthai_key_set": bool(settings.aiforthai_api_key),
        "session_configured": session_configured,
    }

# Serve frontend (must be after all routes, or it catches /health too)
frontend_dir = Path(__file__).parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
