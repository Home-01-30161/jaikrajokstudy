"""Image preprocessing pipeline for improving OCR accuracy on Thai handwriting.

Applies contrast enhancement, brightness normalization, and sharpening to
prepare homework photos for OCR. Uses Pillow (PIL) only — OpenCV has been
intentionally removed because:

  1. opencv-python-headless pulls in heavy native libs that bloat the Docker
     image and can conflict with python:3.12-slim's glibc version.
  2. The preprocessing quality difference between PIL and OpenCV is negligible
     for the Typhoon OCR model, which does its own internal image normalisation.
  3. Removing the dependency eliminates the HAS_OPENCV conditional branch and
     any risk of a silent import-error fallback degrading OCR at runtime.

Resize constraint: Typhoon OCR processes images up to ~5MB. We cap at 1 MP
(≈1000×1000) to keep base64 payload sizes reasonable while preserving detail.
"""

from __future__ import annotations

import io
from typing import Literal

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat

# Hard cap: keep images ≤ 1 MP so the base64 payload stays under ~1.4 MB.
# Typhoon OCR handles full-resolution fine, but larger images add latency
# and risk hitting the API's request-body limit.
MAX_PIXELS = 1_000_000


def prepare_for_ocr(
    image_bytes: bytes,
    *,
    enhance: Literal["auto", "minimal", "aggressive"] = "auto",
) -> bytes:
    """Apply preprocessing pipeline to improve OCR accuracy on handwriting.

    Args:
        image_bytes: Input image bytes (JPEG, PNG, or WebP).
        enhance: Preprocessing intensity:
            - ``"minimal"``: resize only — best for clean, high-contrast scans.
            - ``"auto"``: detect brightness/contrast and choose the right level.
            - ``"aggressive"``: full pipeline — best for photos with shadows or
              uneven lighting.

    Returns:
        Preprocessed image as JPEG bytes (quality 92).
    """
    return _prepare_pil(image_bytes, enhance=enhance)


# ─── PIL-only pipeline ────────────────────────────────────────────────────────

def _prepare_pil(
    image_bytes: bytes,
    enhance: Literal["auto", "minimal", "aggressive"],
) -> bytes:
    """Full PIL preprocessing pipeline."""
    # 1. Load image and normalise colour mode
    img = Image.open(io.BytesIO(image_bytes))
    # Convert palette / RGBA / CMYK to RGB for consistent processing
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    # 2. Downscale if above the pixel cap (preserve aspect ratio)
    total_pixels = img.width * img.height
    if total_pixels > MAX_PIXELS:
        ratio = (MAX_PIXELS / total_pixels) ** 0.5
        new_w = max(1, int(img.width * ratio))
        new_h = max(1, int(img.height * ratio))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # 3. Auto-detect the right enhancement level when not specified
    if enhance == "auto":
        enhance = _detect_level(img)

    # 4. Apply the chosen pipeline
    if enhance != "minimal":
        img = _preprocess(img, aggressive=(enhance == "aggressive"))

    # 5. Encode to JPEG and return
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def _detect_level(img: Image.Image) -> Literal["minimal", "aggressive"]:
    """Choose enhancement level based on brightness and contrast statistics."""
    gray = img.convert("L")
    stat = ImageStat.Stat(gray)
    brightness: float = stat.mean[0]   # 0 = black, 255 = white
    contrast: float = stat.stddev[0]   # higher = more contrast

    # Dark images (mean < 180) or flat images (stddev < 50) need more work.
    needs_aggressive = brightness < 180 or contrast < 50
    return "aggressive" if needs_aggressive else "minimal"


def _preprocess(img: Image.Image, *, aggressive: bool) -> Image.Image:
    """Apply PIL enhancement steps tailored to document / handwriting photos."""
    # ── Step 1: global auto-contrast (clips the darkest/lightest 2 % of pixels) ──
    img = ImageOps.autocontrast(img, cutoff=2)

    # ── Step 2: brightness lift for dark photos ──
    gray = img.convert("L")
    stat = ImageStat.Stat(gray)
    if stat.mean[0] < 160:
        img = ImageEnhance.Brightness(img).enhance(1.4)
    elif stat.mean[0] < 180:
        img = ImageEnhance.Brightness(img).enhance(1.2)

    # ── Step 3: contrast boost ──
    img = ImageEnhance.Contrast(img).enhance(1.3)

    # ── Step 4: sharpness — improves character edge definition ──
    img = ImageEnhance.Sharpness(img).enhance(1.6)

    # ── Step 5: aggressive-only — unsharp mask + local contrast expansion ──
    if aggressive:
        # Unsharp mask via filter — enhances fine text strokes
        img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=3))
        # Convert to grayscale and stretch the histogram to full range
        gray = img.convert("L")
        gray = ImageOps.autocontrast(gray, cutoff=1)
        img = gray.convert("RGB")

    return img
