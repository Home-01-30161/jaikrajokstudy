"""
test_image_routing.py - Race all services against testproblem.jpg AND smile.jpg simultaneously.

Tests:
  testproblem.jpg  → physics homework (no faces) → should route to OCR
  smile.jpg        → selfie with happy face → should route to face/emotion path

For each image, fires 3 async calls in parallel:
  1. face.analyze_image()                (typhoon-ocr emotion primary → AI for Thai fallback)
  2. ocr.transcribe_image()              (full chain: Typhoon OCR → doc OCR → VQA)
  3. typhoon_ocr.extract_text_typhoon()  (direct, no fallback, no preprocessing)

NOTE: typhoon-ocr handles BOTH text extraction (OCR system prompt) AND face/emotion
analysis (emotion system prompt). They use different system prompts — see
typhoon_ocr.py vs face.py for the two separate prompts.

Usage:
  cd E:/pathummalesgo/api
  python scripts/test_image_routing.py
"""

import asyncio
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Load .env manually (no dotenv dependency)
env_path = ROOT.parent / ".env"
if env_path.exists():
    for _ln in env_path.read_text(encoding="utf-8").splitlines():
        _ln = _ln.strip()
        if not _ln or _ln.startswith("#") or "=" not in _ln:
            continue
        _k, _, _v = _ln.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())
    print("[env] loaded", env_path)
else:
    print("[env] WARNING: .env not found at", env_path)

from app.config import get_settings                          # noqa: E402
from app.services import face, ocr                           # noqa: E402
from app.services.typhoon_ocr import extract_text_typhoon   # noqa: E402

# ANSI colours
G = "\033[92m"
R = "\033[91m"
C = "\033[96m"
B = "\033[1m"
Z = "\033[0m"


def _ok(m):  return G + "OK  " + str(m) + Z
def _bad(m): return R + "ERR " + str(m) + Z
def _nfo(m): return C + "    " + str(m) + Z


# ---------------------------------------------------------------------------
# Async runners
# ---------------------------------------------------------------------------

async def run_face(image_bytes: bytes):
    t0 = time.perf_counter()
    r = await face.analyze_image(image_bytes)
    return ("face.analyze_image  [full chain]", time.perf_counter() - t0, r)


async def run_ocr(image_bytes: bytes):
    t0 = time.perf_counter()
    r = await ocr.transcribe_image(image_bytes)
    return ("ocr.transcribe_image  [full chain]", time.perf_counter() - t0, r)


async def run_typhoon_direct(image_bytes: bytes):
    t0 = time.perf_counter()
    r = await extract_text_typhoon(image_bytes, filename="testproblem.jpg")
    return ("typhoon_ocr  [direct, isolated]", time.perf_counter() - t0, r)


async def run_aiforthai_face(image_bytes: bytes):
    settings = get_settings()
    t0 = time.perf_counter()
    r = await face._analyze_aiforthai(image_bytes, settings)
    return ("face._analyze_aiforthai  [direct, isolated]", time.perf_counter() - t0, r)


# ---------------------------------------------------------------------------
# Printer
# ---------------------------------------------------------------------------

SEP = "=" * 70


def show(label: str, elapsed: float, r) -> None:
    print()
    print(B + SEP + Z)
    print(B + "  " + label + Z)
    print("  time    : " + str(round(elapsed, 2)) + "s")
    print("  ok      : " + (_ok("True") if r.ok else _bad("False")))
    print("  service : " + str(r.service))
    if r.error:
        print("  error   : " + R + str(r.error) + Z)
    if r.text:
        preview = r.text[:500].replace("\n", " | ")
        dots = "..." if len(r.text) > 500 else ""
        print("  text    : " + G + preview + dots + Z)
    if r.label is not None:
        print("  label   : " + str(r.label))
    if r.score is not None:
        print("  score   : " + str(round(r.score, 2)))
    if r.raw:
        keys = ("face_count", "emotion", "emotion_th", "confidence", "description")
        sub = {k: v for k, v in r.raw.items() if k in keys}
        if sub:
            print("  raw     : " + str(sub))
    print(SEP)


# ---------------------------------------------------------------------------
# LINE bot routing simulation
# ---------------------------------------------------------------------------

def routing(face_r, ocr_r) -> None:
    print()
    print(B + SEP + Z)
    print(B + "  LINE BOT ROUTING DECISION for this image" + Z)
    print(B + SEP + Z)

    went_selfie = False

    if face_r.ok:
        # Primary path: typhoon-ocr with emotion-analysis prompt
        if face_r.service == "face-typhoon":
            fc = int(face_r.raw.get("face_count", 0)) if face_r.raw else 0
            if fc > 0:
                emo = str(face_r.raw.get("emotion_th", "?"))
                desc = str(face_r.raw.get("description", ""))
                conf = face_r.score or 0.0
                print(_ok("SELFIE PATH (typhoon-ocr) -- " + str(fc) + " face(s), emotion=" + emo
                          + " (" + str(round(conf * 100)) + "%)"))
                if desc:
                    print(_nfo("description: " + desc))
                went_selfie = True
            else:
                print(_nfo("typhoon-ocr: face_count=0 (no human faces) -> fall through to OCR"))

        # Fallback path: AI for Thai face detection (presence only)
        elif face_r.service == "face":
            objs = face_r.raw.get("objects") or [] if face_r.raw else []
            fc = len(objs) if isinstance(objs, list) else 0
            if fc > 0:
                print(_ok("SELFIE PATH (AI for Thai fallback) -- " + str(fc) + " face(s) [no emotion data]"))
                went_selfie = True
            else:
                print(_nfo("AI for Thai: 0 faces -> fall through to OCR"))
    else:
        print(_nfo("Face service failed (" + str(face_r.error) + ") -> fall through to OCR"))

    if not went_selfie:
        if ocr_r.ok and (ocr_r.text or "").strip():
            print(_ok("HOMEWORK/OCR PATH -- text extracted via " + str(ocr_r.service)))
            print(_nfo("Text passed to LLM to explain the problem step-by-step"))
        else:
            print(_bad("OCR also failed (" + str(ocr_r.error) + ") -> bot shows generic error"))
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main() -> None:
    s = get_settings()

    images = [
        ("testproblem.jpg", ROOT.parent / "docs" / "testproblem.jpg", "physics homework — expect OCR path"),
        ("smile.jpg",       ROOT.parent / "docs" / "smile.jpg",       "selfie — expect face/emotion path"),
    ]

    for img_name, img_path, description in images:
        print()
        print(B + "=" * 70 + Z)
        print(B + "  IMAGE: " + img_name + Z)
        print(B + "  (" + description + ")" + Z)
        print(B + "=" * 70 + Z)

        if not img_path.exists():
            print(R + "  NOT FOUND: " + str(img_path) + Z)
            continue

        image_bytes = img_path.read_bytes()
        print(B + "  Size  : " + Z + str(round(len(image_bytes) / 1024, 1)) + " KB")
        print(B + "  Keys  : " + Z
              + "TYPHOON=" + ("SET" if s.typhoon_api_key else "MISSING")
              + "  AIFORTHAI=" + ("SET" if s.aiforthai_api_key else "MISSING"))
        print()
        print(B + "  Firing all 3 calls in parallel..." + Z)
        print()

        t_wall = time.perf_counter()
        results = await asyncio.gather(
            run_face(image_bytes),
            run_ocr(image_bytes),
            run_typhoon_direct(image_bytes),
            return_exceptions=True,
        )
        wall = time.perf_counter() - t_wall

        valid  = [r for r in results if isinstance(r, tuple)]
        errors = [r for r in results if isinstance(r, Exception)]
        valid.sort(key=lambda x: x[1])

        face_r = ocr_r = None
        for label, elapsed, r in valid:
            show(label, elapsed, r)
            if "face.analyze_image" in label:
                face_r = r
            elif "ocr.transcribe_image" in label:
                ocr_r = r

        print()
        print(B + "  Total wall-clock (all 3 ran in parallel): "
              + str(round(wall, 2)) + "s" + Z)

        if face_r and ocr_r:
            routing(face_r, ocr_r)

        if errors:
            print(R + "  Python exceptions:" + Z)
            for e in errors:
                print("    " + type(e).__name__ + ": " + str(e))


if __name__ == "__main__":
    asyncio.run(main())
