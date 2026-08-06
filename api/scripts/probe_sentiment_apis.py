"""Probe AI for Thai language APIs that could drive mood detection.

Compares each candidate on realistic student utterances. Reads the key from
env via get_settings(); never prints it.
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import httpx
from app.config import get_settings

SAMPLES = [
    ("stressed", "การบ้านเยอะมาก ไม่ไหวแล้ว เครียดจนนอนไม่หลับ"),
    ("sad",      "รู้สึกเหงามาก ไม่มีใครเข้าใจเราเลย"),
    ("positive", "วันนี้สอบได้คะแนนดีมาก ดีใจสุด ๆ"),
    ("neutral",  "พรุ่งนี้มีเรียนคณิตศาสตร์ตอนเช้า"),
    ("slang",    "เหนื่อยว่ะ ชีวิตพังหมดแล้ว 555"),
]

CANDIDATES = [
    ("ssense",        "/ssense",             "text"),
    ("emonews",       "/emonews",            "text"),
    ("cyberbully",    "/cyberbully",         "text"),
    ("cyberbullying", "/cyberbullying",      "text"),
    ("thaimoji",      "/thaimoji",           "text"),
    ("emoji",         "/emoji",              "text"),
    ("sentiment",     "/sentiment",          "text"),
]

async def main():
    s = get_settings()
    if not s.aiforthai_api_key:
        print("NO API KEY"); return
    base = s.aiforthai_base_url.rstrip("/")
    headers = {"Apikey": s.aiforthai_api_key,
               "Content-Type": "application/x-www-form-urlencoded"}
    async with httpx.AsyncClient(timeout=45.0, verify=not s.insecure_tls) as c:
        for name, path, field in CANDIDATES:
            print(f"\n===== {name}  ({path}) =====")
            for expect, text in SAMPLES:
                await asyncio.sleep(3)
                try:
                    r = await c.post(base + path, headers=headers, data={field: text})
                    body = r.text[:220].replace("\n", " ")
                    print(f"  [{expect:<8}] {r.status_code} {body}")
                except Exception as e:
                    print(f"  [{expect:<8}] ERR {type(e).__name__}: {e}")
                    break

asyncio.run(main())
