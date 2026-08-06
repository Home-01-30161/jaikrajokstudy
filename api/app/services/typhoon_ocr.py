"""Typhoon OCR client (SCB 10X) - replaces AI for Thai OCR to avoid "roi" errors."""

from __future__ import annotations

import httpx

from app.config import get_settings
from app.services.base import ServiceResult
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def extract_text_typhoon(image_bytes: bytes, filename: str = "image.jpg") -> ServiceResult:
    """Extract text from image using Typhoon OCR API.
    
    Typhoon OCR is a Thai company (SCB 10X) service that handles Thai text
    extraction without the "roi" errors from AI for Thai /handwritten endpoint.
    
    Rate limit: 2 RPS / 20 RPM for typhoon-ocr model.
    
    API: https://api.opentyphoon.ai/v1/ocr
    Model: typhoon-ocr-7b
    """
    settings = get_settings()
    
    if not settings.typhoon_api_key:
        return ServiceResult(
            service="typhoon-ocr",
            ok=False,
            error="Missing TYPHOON_API_KEY"
        )
    
    url = settings.typhoon_base_url
    headers = {
        "Authorization": f"Bearer {settings.typhoon_api_key}"
    }
    
    # Typhoon OCR expects multipart form with 'file' and parameters
    files = {
        "file": (filename, image_bytes, "image/jpeg")
    }
    data = {
        "model": "typhoon-ocr",
        "task_type": "default",
        "max_tokens": "16384",
        "temperature": "0.1",
        "top_p": "0.6",
        "repetition_penalty": "1.2"
    }
    
    try:
        async with httpx.AsyncClient(timeout=90.0, verify=not settings.insecure_tls) as client:
            resp = await client.post(url, headers=headers, files=files, data=data)
            
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}
            
            if resp.status_code >= 400:
                error_msg = raw.get("error", {}).get("message", "") if isinstance(raw, dict) else ""
                if not error_msg:
                    error_msg = f"HTTP {resp.status_code}"
                
                logger.warning("Typhoon OCR HTTP %s: %s", resp.status_code, str(raw)[:200])
                return ServiceResult(
                    service="typhoon-ocr",
                    ok=False,
                    error=error_msg,
                    raw=raw if isinstance(raw, dict) else {}
                )
            
            # Parse Typhoon OCR response format
            extracted_text = _parse_typhoon_response(raw if isinstance(raw, dict) else {})
            
            if not extracted_text:
                logger.warning("Typhoon OCR returned empty text")
                return ServiceResult(
                    service="typhoon-ocr",
                    ok=False,
                    error="empty response",
                    raw=raw if isinstance(raw, dict) else {}
                )
            
            return ServiceResult(
                service="typhoon-ocr",
                ok=True,
                text=extracted_text,
                raw=raw if isinstance(raw, dict) else {}
            )
            
    except httpx.TimeoutException:
        return ServiceResult(service="typhoon-ocr", ok=False, error="timeout")
    except Exception as exc:
        logger.exception("Typhoon OCR call failed")
        return ServiceResult(service="typhoon-ocr", ok=False, error=str(exc))


def _parse_typhoon_response(raw: dict) -> str:
    """Extract text from Typhoon OCR JSON response.
    
    Expected format:
    {
      "results": [
        {
          "message": {
            "choices": [
              {
                "message": {
                  "content": "extracted text or JSON with natural_text field"
                }
              }
            ]
          }
        }
      ]
    }
    """
    extracted_texts = []
    
    results = raw.get("results", [])
    if not isinstance(results, list):
        return ""
    
    for page_result in results:
        if not isinstance(page_result, dict):
            continue
            
        # Check for error in this page result
        if not page_result.get("success", True):
            logger.warning(
                "Typhoon OCR page error: %s",
                page_result.get("error", "unknown error")
            )
            continue
        
        message = page_result.get("message")
        if not isinstance(message, dict):
            continue
        
        choices = message.get("choices", [])
        if not isinstance(choices, list) or not choices:
            continue
        
        choice = choices[0]
        if not isinstance(choice, dict):
            continue
        
        msg = choice.get("message", {})
        if not isinstance(msg, dict):
            continue
        
        content = msg.get("content", "")
        if not content:
            continue
        
        # Content might be JSON with natural_text field or plain text
        try:
            import json
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                text = parsed.get("natural_text", content)
            else:
                text = content
        except (json.JSONDecodeError, ValueError):
            text = content
        
        if text:
            extracted_texts.append(text)
    
    return "\n".join(extracted_texts)
