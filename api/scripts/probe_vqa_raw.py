"""Dump the raw VQA response to inspect its structure."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings

import httpx


async def main() -> None:
    settings = get_settings()
    image = Path(r"C:\Users\Admin\Downloads\submit.png").read_bytes()
    url = "https://api.aiforthai.in.th/vqa/inference/"
    headers = {"Apikey": settings.aiforthai_api_key, "X-lib": "ai4thai-lib"}
    files = {"file": ("image.jpg", image, "image/jpeg")}
    data = {
        "query": "อ่านข้อความลายมือในภาพนี้ให้หน่อย แปลงเป็นข้อความภาษาไทย "
        "ตอบเฉพาะข้อความที่อ่านได้เท่านั้น"
    }
    async with httpx.AsyncClient(timeout=90.0, verify=not settings.insecure_tls) as client:
        resp = await client.post(url, headers=headers, files=files, data=data)
        print(f"status: {resp.status_code}")
        raw = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text
        print(json.dumps(raw, ensure_ascii=False, indent=2)[:3000])
        print("content", raw.get("content") if isinstance(raw, dict) else None)


if __name__ == "__main__":
    asyncio.run(main())