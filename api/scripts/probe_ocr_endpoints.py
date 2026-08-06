"""Probe AI for Thai OCR endpoint variants to find which accept our key + image."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import httpx
from app.config import get_settings

CANDIDATES = [
    "/tocr", "/ocr", "/deepocr", "/deep_ocr", "/thai-ocr",
    "/ocr/tocr", "/ocr/deepocr", "/char-recog/tocr", "/tocr/inference",
    "/handwritten",
]

async def main(img_path):
    s = get_settings()
    if not s.aiforthai_api_key:
        print("NO API KEY"); return
    data = open(img_path, "rb").read()
    print(f"image: {img_path} ({len(data)} bytes)\n")
    headers = {"Apikey": s.aiforthai_api_key, "X-lib": "ai4thai-lib"}
    base = s.aiforthai_base_url.rstrip("/")
    async with httpx.AsyncClient(timeout=60.0, verify=not s.insecure_tls) as c:
        for path in CANDIDATES:
            url = base + path
            for field in ("file", "image", "uploadfile"):
                try:
                    r = await c.post(url, headers=headers,
                                     files={field: ("img.jpg", data, "image/jpeg")})
                    body = r.text[:200].replace("\n", " ")
                    print(f"{r.status_code:>3} {path:<20} field={field:<11} {body}")
                    if r.status_code < 400:
                        break
                except Exception as e:
                    print(f"ERR {path:<20} field={field:<11} {type(e).__name__}: {e}")
                    break

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Admin\Downloads\submit.png"))
