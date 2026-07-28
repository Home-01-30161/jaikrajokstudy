"""Text-to-Speech client: AI for Thai Vaja9, with optional TokenMind ptm-tts-1."""

from __future__ import annotations

import httpx

from app.config import get_settings
from app.services.base import ServiceResult
from app.utils.logging import get_logger

logger = get_logger(__name__)

_MAX_TTS_CHARS = 300


async def synthesize(text: str, *, speaker: int = 0) -> ServiceResult:
    """Convert Thai text to speech.

    Uses AI for Thai Vaja9. The TokenMind gateway also lists ptm-tts-1, but it
    answers HTTP 500 for every request, so it is tried first only when
    TOKENMIND_TTS_ENABLED is set; otherwise it would add a guaranteed-failing
    round-trip to each reply.

    Args:
        text: Thai text to synthesize (max 300 chars per request).
        speaker: 0 = male, 1 = female. Vaja9 only; ptm-tts-1 uses `voice`.

    Returns:
        ServiceResult with .data containing WAV audio bytes.
    """
    settings = get_settings()
    if not text.strip():
        return ServiceResult(service="tts", ok=False, error="Empty text")

    if settings.tokenmind_tts_enabled and settings.tokenmind_api_key:
        result = await _synthesize_tokenmind(text, settings)
        if result.ok:
            return result
        logger.warning("TokenMind TTS failed (%s); falling back to Vaja9", result.error)

    if not settings.aiforthai_api_key:
        return ServiceResult(
            service="tts", ok=False, error="Missing AIFORTHAI_API_KEY"
        )
    return await _synthesize_vaja9(text, speaker, settings)


async def _synthesize_tokenmind(text: str, settings) -> ServiceResult:
    """OpenAI-compatible /audio/speech call (ptm-tts-1)."""
    url = f"{settings.tokenmind_base_url.rstrip('/')}/audio/speech"
    headers = {
        "Authorization": f"Bearer {settings.tokenmind_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.tokenmind_tts_model,
        "input": text[:_MAX_TTS_CHARS],
        "response_format": "wav",
    }
    if settings.tokenmind_tts_voice:
        payload["voice"] = settings.tokenmind_tts_voice

    try:
        verify = not settings.insecure_tls
        async with httpx.AsyncClient(timeout=60.0, verify=verify) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code >= 400:
                logger.warning(
                    "TokenMind TTS HTTP %s: %s", resp.status_code, resp.text[:300]
                )
                return ServiceResult(
                    service="tts", ok=False, error=f"HTTP {resp.status_code}"
                )

            audio = resp.content
            # A JSON error body can still arrive with a 200, so require real audio.
            if not audio or audio[:4] not in (b"RIFF", b"OggS", b"fLaC", b"ID3\x03"):
                ctype = resp.headers.get("content-type", "")
                if "json" in ctype or not audio:
                    logger.warning("TokenMind TTS returned non-audio (%s)", ctype)
                    return ServiceResult(
                        service="tts", ok=False, error="response was not audio"
                    )

            return ServiceResult(service="tts", ok=True, data=audio)
    except httpx.TimeoutException:
        return ServiceResult(service="tts", ok=False, error="timeout")
    except Exception as exc:  # noqa: BLE001
        logger.exception("TokenMind TTS call failed")
        return ServiceResult(service="tts", ok=False, error=str(exc))


async def _synthesize_vaja9(text: str, speaker: int, settings) -> ServiceResult:
    """Legacy AI for Thai Vaja9 fallback."""
    url = f"{settings.aiforthai_base_url.rstrip('/')}/vaja9/synth_audiovisual"
    headers = {"Apikey": settings.aiforthai_api_key, "X-lib": "ai4thai-lib"}

    payload = {
        "input_text": text[:_MAX_TTS_CHARS],
        "speaker": speaker,
        "phrase_break": 0,
        "audiovisual": 0,
    }

    try:
        verify = not settings.insecure_tls
        async with httpx.AsyncClient(timeout=30.0, verify=verify) as client:
            resp = await client.post(url, json=payload, headers=headers)
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning("TTS synth HTTP %s: %s", resp.status_code, resp.text[:300])
                raw_dict = raw if isinstance(raw, dict) else {}
                api_msg = raw_dict.get("message") or raw_dict.get("error") or ""
                return ServiceResult(
                    service="tts",
                    ok=False,
                    error=f"HTTP {resp.status_code}{': ' + api_msg if api_msg else ''}",
                    raw=raw_dict,
                )

            wav_url = raw.get("wav_url") if isinstance(raw, dict) else None
            if not wav_url:
                logger.warning("TTS response missing wav_url: %s", str(raw)[:200])
                return ServiceResult(
                    service="tts",
                    ok=False,
                    error="No wav_url in response",
                    raw=raw if isinstance(raw, dict) else {},
                )

            audio_resp = await client.get(wav_url, headers=headers)
            if audio_resp.status_code >= 400:
                logger.warning("TTS download HTTP %s", audio_resp.status_code)
                return ServiceResult(
                    service="tts",
                    ok=False,
                    error=f"Audio download HTTP {audio_resp.status_code}",
                )

            return ServiceResult(
                service="tts",
                ok=True,
                data=audio_resp.content,
                raw=raw if isinstance(raw, dict) else {},
            )
    except httpx.TimeoutException:
        return ServiceResult(service="tts", ok=False, error="timeout")
    except Exception as exc:
        logger.exception("TTS call failed")
        return ServiceResult(service="tts", ok=False, error=str(exc))
