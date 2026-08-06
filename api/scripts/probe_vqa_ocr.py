"""Manual probe: test the new VQA OCR path against the live AI for Thai API."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import ocr


async def main() -> None:
    image = Path(r"C:\Users\Admin\Downloads\submit.png").read_bytes()
    print(f"image bytes: {len(image)}")

    print("=== VQA first ===")
    vqa = await ocr.extract_text_vqa(image)
    print(f"ok={vqa.ok} error={vqa.error}")
    if vqa.text:
        print("--- text ---")
        print(vqa.text)

    print()
    print("=== /handwritten (fallback) ===")
    hw = await ocr.extract_text(image)
    print(f"ok={hw.ok} error={hw.error}")
    if hw.text:
        print("--- text ---")
        print(hw.text)

    print()
    print("=== transcribe_image chain ===")
    result = await ocr.transcribe_image(image)
    print(f"ok={result.ok} error={result.error}")
    if result.text:
        print("--- text ---")
        print(result.text)


if __name__ == "__main__":
    asyncio.run(main())
