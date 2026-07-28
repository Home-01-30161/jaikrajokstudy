"""AI for Thai Speech-to-Text client."""

from __future__ import annotations

import httpx

from app.config import get_settings
from app.services.base import ServiceResult
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _scrub(text: str, secret: str) -> str:
    """Remove the API key from text before logging.

    The STT API echoes the key back inside `inputfilename`, so raw response
    bodies must never be logged verbatim (container logs are exposed at /logs/).
    """
    if secret and secret in text:
        return text.replace(secret, "<redacted>")
    return text


async def transcribe(audio_bytes: bytes) -> ServiceResult:
    """Transcribe Thai speech to text.

    Prefers the TokenMind gateway (ptm-asr-1); falls back to the legacy AI for
    Thai /partii-webapi endpoint, whose quota may be zero on some keys.
    """
    settings = get_settings()

    if settings.tokenmind_api_key:
        result = await _transcribe_tokenmind(audio_bytes, settings)
        if result.ok:
            return result
        logger.warning("TokenMind ASR failed (%s); falling back to partii", result.error)

    if not settings.aiforthai_api_key:
        return ServiceResult(
            service="stt", ok=False, error="Missing TOKENMIND_API_KEY and AIFORTHAI_API_KEY"
        )
    return await _transcribe_partii(audio_bytes, settings)


async def _transcribe_tokenmind(audio_bytes: bytes, settings) -> ServiceResult:
    """OpenAI-compatible /audio/transcriptions call (ptm-asr-1)."""
    url = f"{settings.tokenmind_base_url.rstrip('/')}/audio/transcriptions"
    headers = {"Authorization": f"Bearer {settings.tokenmind_api_key}"}
    files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
    try:
        verify = not settings.insecure_tls
        async with httpx.AsyncClient(timeout=120.0, verify=verify) as client:
            resp = await client.post(
                url, headers=headers, files=files, data={"model": settings.tokenmind_asr_model}
            )
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning(
                    "TokenMind ASR HTTP %s: %s",
                    resp.status_code,
                    _scrub(resp.text[:300], settings.tokenmind_api_key),
                )
                return ServiceResult(
                    service="stt",
                    ok=False,
                    error=f"HTTP {resp.status_code}",
                    raw=raw if isinstance(raw, dict) else {},
                )

            text = raw.get("text") if isinstance(raw, dict) else None
            if not (isinstance(text, str) and text.strip()):
                return ServiceResult(service="stt", ok=False, error="empty transcript")
            return ServiceResult(
                service="stt",
                ok=True,
                text=text.strip(),
                raw=raw if isinstance(raw, dict) else {},
            )
    except httpx.TimeoutException:
        return ServiceResult(service="stt", ok=False, error="timeout")
    except Exception as exc:  # noqa: BLE001
        logger.exception("TokenMind ASR call failed")
        return ServiceResult(service="stt", ok=False, error=str(exc))


async def _transcribe_partii(audio_bytes: bytes, settings) -> ServiceResult:
    """Legacy AI for Thai Partii fallback."""
    url = f"{settings.aiforthai_base_url.rstrip('/')}/partii-webapi"
    headers = {
        "Apikey": settings.aiforthai_api_key,
        "Cache-Control": "no-cache",
    }
    files = {"wavfile": ("audio.wav", audio_bytes, "audio/wav")}
    params = {"outputlevel": "--uttlevel", "outputformat": "--txt"}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, files=files, data=params)
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning(
                    "STT HTTP %s: %s",
                    resp.status_code,
                    _scrub(resp.text[:300], settings.aiforthai_api_key),
                )
                raw_dict = raw if isinstance(raw, dict) else {}
                raw_dict.pop("inputfilename", None)  # contains the API key
                api_msg = raw_dict.get("message") or raw_dict.get("error") or ""
                return ServiceResult(
                    service="stt",
                    ok=False,
                    error=f"HTTP {resp.status_code}{': ' + api_msg if api_msg else ''}",
                    raw=raw_dict,
                )

            text = _extract_transcript(raw if isinstance(raw, dict) else {})
            return ServiceResult(
                service="stt",
                ok=True,
                text=text,
                raw=raw if isinstance(raw, dict) else {},
            )
    except httpx.TimeoutException:
        return ServiceResult(service="stt", ok=False, error="timeout")
    except Exception as exc:
        logger.exception("STT call failed")
        return ServiceResult(service="stt", ok=False, error=str(exc))


def _extract_transcript(raw: dict) -> str | None:
    text = raw.get("message") or raw.get("text") or raw.get("content") or raw.get("transcript")
    if isinstance(text, str) and text.strip():
        return text.strip()
    return None
