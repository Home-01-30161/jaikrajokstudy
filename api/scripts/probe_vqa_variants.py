"""Probe VQA with different images and preprocessing variants."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

from app.config import get_settings
from app.services.base import ServiceResult


async def vqa(image: bytes, query: str) -> ServiceResult:
    settings = get_settings()
    url = "https://api.aiforthai.in.th/vqa/inference/"
    headers = {"Apikey": settings.aiforthai_api_key, "X-lib": "ai4thai-lib"}
    files = {"file": ("image.jpg", image, "image/jpeg")}
    data = {"query": query}
    async with httpx.AsyncClient(timeout=90.0, verify=not settings.insecure_tls) as client:
        resp = await client.post(url, headers=headers, files=files, data=data)
        raw = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"text": resp.text}
        return ServiceResult(
            service="vqa", ok=resp.status_code < 400, text=raw.get("content") or raw.get("text") or None,
            error=None if resp.status_code < 400 else f"HTTP {resp.status_code}",
            raw=raw if isinstance(raw, dict) else {},
        )


async def main() -> None:
    good = Path(r"E:\pathummalesgo\api\scripts\test_ocr.jpg").read_bytes()
    submit = Path(r"C:\Users\Admin\Downloads\submit.png").read_bytes()

    print(f"test_ocr.jpg bytes: {len(good)}")
    print(f"submit.png bytes: {len(submit)}")

    print("\n=== 1. VQA test_ocr.jpg ===")
    r = await vqa(good, "อ่านข้อความลายมือในภาพนี้ให้หน่อย แปลงเป็นข้อความภาษาไทย ตอบเฉพาะข้อความที่อ่านได้เท่านั้น")
    print(f"ok={r.ok} content={r.text!r}")

    print("\n=== 2. VQA test_ocr.jpg (short query) ===")
    r = await vqa(good, "transcribe the handwriting")
    print(f"ok={r.ok} content={r.text!r}")

    print("\n=== 3. VQA submit.png (short query) ===")
    r = await vqa(submit, "transcribe the handwriting")
    print(f"ok={r.ok} content={r.text!r}")


if __name__ == "__main__":
    asyncio.run(main())