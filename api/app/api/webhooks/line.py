"""LINE Messaging API webhook."""

from __future__ import annotations

import asyncio
import logging
import ssl

import aiohttp
from fastapi import APIRouter, Header, HTTPException, Request
from linebot.v3 import WebhookParser
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    AsyncApiClient,
    AsyncMessagingApi,
    Configuration,
    ReplyMessageRequest,
    TextMessage,
)
from linebot.v3.webhooks import FollowEvent, MessageEvent, TextMessageContent
import httpx

from app.bots.conversation import WELCOME, handle_text
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["line"])

# Local shells with a broken CA bundle (MSYS2 Python) cannot verify certs, so
# INSECURE_TLS=1 opts out. It defaults to false, so the deployed container always
# verifies: replies to LINE users must not accept a forged certificate.
if get_settings().insecure_tls:
    logger.warning(
        "INSECURE_TLS is on - outbound TLS certificates are NOT verified. "
        "Local development only."
    )

    _original_tcp_connector_init = aiohttp.TCPConnector.__init__

    def _patched_tcp_connector_init(self, *args, **kwargs):
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        kwargs["ssl"] = ssl_context
        _original_tcp_connector_init(self, *args, **kwargs)

    aiohttp.TCPConnector.__init__ = _patched_tcp_connector_init


_LOADING_SECONDS = 60


async def _show_loading(user_id: str, token: str) -> None:
    """Show the typing indicator in a 1:1 LINE chat.

    Never raises: the indicator is cosmetic, so a failure here must not cost the
    user their reply.
    """
    try:
        verify = not get_settings().insecure_tls
        async with httpx.AsyncClient(verify=verify, timeout=10.0) as client:
            resp = await client.post(
                "https://api.line.me/v2/bot/chat/loading/start",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={"chatId": user_id, "loadingSeconds": _LOADING_SECONDS},
            )
            if resp.status_code == 202:
                # Logged at info so the container log can distinguish "we never
                # asked" from "LINE accepted it but the user saw nothing", which
                # happens when the chat screen is not open (LINE drops it).
                logger.info("Loading animation accepted by LINE (202)")
            else:
                logger.warning(
                    "Loading animation returned %s: %s",
                    resp.status_code, resp.text[:200],
                )
    except Exception as e:
        logger.warning("Could not show loading animation: %s", e)


def _messaging_api() -> AsyncMessagingApi:
    settings = get_settings()
    configuration = Configuration(access_token=settings.line_channel_access_token)
    api_client = AsyncApiClient(configuration)
    return AsyncMessagingApi(api_client)


@router.post("/webhooks/line")
async def line_webhook(
    request: Request,
    x_line_signature: str | None = Header(default=None, alias="X-Line-Signature"),
) -> dict:
    settings = get_settings()
    if not settings.line_channel_secret or not settings.line_channel_access_token:
        raise HTTPException(status_code=503, detail="LINE credentials not configured")
    if not x_line_signature:
        raise HTTPException(status_code=400, detail="Missing X-Line-Signature")

    body = (await request.body()).decode("utf-8")
    parser = WebhookParser(settings.line_channel_secret)

    try:
        events = parser.parse(body, x_line_signature)
    except InvalidSignatureError as exc:
        logger.warning("Invalid LINE signature")
        raise HTTPException(status_code=400, detail="Invalid signature") from exc

    api = _messaging_api()
    try:
        logger.info(f"Processing {len(events)} events")
        for event in events:
            logger.info(f"Event type: {type(event).__name__}")
            if isinstance(event, FollowEvent):
                await api.reply_message(
                    ReplyMessageRequest(
                        reply_token=event.reply_token,
                        messages=[TextMessage(text=WELCOME)],
                    )
                )
            elif isinstance(event, MessageEvent) and isinstance(
                event.message, TextMessageContent
            ):
                user_id = event.source.user_id if event.source else "unknown"
                source_type = getattr(event.source, "type", None) if event.source else None

                # The loading indicator only exists for 1:1 chats, so group and
                # room events skip it. It runs alongside handle_text rather than
                # before it: awaiting it first would add its round-trip to every
                # reply, and the LLM leg already takes seconds.
                show_loading = (
                    user_id
                    and user_id != "unknown"
                    and source_type not in ("group", "room")
                )
                if show_loading:
                    reply, _ = await asyncio.gather(
                        handle_text(user_id, event.message.text),
                        _show_loading(user_id, settings.line_channel_access_token),
                    )
                else:
                    reply = await handle_text(user_id or "unknown", event.message.text)
                await api.reply_message(
                    ReplyMessageRequest(
                        reply_token=event.reply_token,
                        messages=[TextMessage(text=reply[:5000])],
                    )
                )
    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        raise
    finally:
        await api.api_client.close()

    return {"ok": True}
