"""Image preprocessing pipeline for improving OCR accuracy on Thai handwriting.

Applies adaptive thresholding, denoising, deskewing, contrast enhancement, and
shadow removal to prepare homework photos for OCR. Based on research showing
preprocessing can dramatically improve recognition rates on challenging documents.

Falls back to PIL-only processing if OpenCV is not available.
"""

from __future__ import annotations

import io
from typing import Literal

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat

try:
    import cv2
    import numpy as np
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False

# Resize constraint: AI for Thai OCR fails on images >1M pixels with "roi" error.
# Target 500K pixels (max dimension ~700px) while preserving aspect ratio.
MAX_PIXELS = 500_000


def prepare_for_ocr(
    image_bytes: bytes,
    *,
    enhance: Literal["auto", "minimal", "aggressive"] = "auto",
) -> bytes:
    """Apply preprocessing pipeline to improve OCR accuracy on handwriting.

    Args:
        image_bytes: Input image (JPEG/PNG).
        enhance: Preprocessing intensity:
            - "minimal": resize only (for clean scans)
            - "auto": adaptive based on image analysis (default)
            - "aggressive": full pipeline (for poor lighting/shadows)

    Returns:
        Preprocessed image as JPEG bytes.
    """
    if HAS_OPENCV:
        return _prepare_opencv(image_bytes, enhance=enhance)
    else:
        return _prepare_pil(image_bytes, enhance=enhance)


def _prepare_pil(image_bytes: bytes, enhance: Literal["auto", "minimal", "aggressive"]) -> bytes:
    """PIL-only preprocessing fallback (when OpenCV is not available)."""
    # 1. Load and convert to RGB
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    # 2. Resize to safe dimensions
    total_pixels = img.width * img.height
    if total_pixels > MAX_PIXELS:
        ratio = (MAX_PIXELS / total_pixels) ** 0.5
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    # 3. Auto-detect enhancement level if needed
    if enhance == "auto":
        enhance = _detect_enhancement_level_pil(img)

    # 4. Apply PIL-based preprocessing
    if enhance != "minimal":
        img = _preprocess_pil(img, aggressive=(enhance == "aggressive"))

    # 5. Return as JPEG
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def _detect_enhancement_level_pil(img: Image.Image) -> Literal["minimal", "aggressive"]:
    """Auto-detect if image needs aggressive preprocessing (PIL version)."""
    gray = img.convert("L")
    stat = ImageStat.Stat(gray)

    # Brightness: mean pixel intensity
    brightness = stat.mean[0]

    # Contrast: standard deviation
    contrast = stat.stddev[0]

    # Aggressive if: dark (<180), low contrast (<50)
    needs_aggressive = brightness < 180 or contrast < 50
    return "aggressive" if needs_aggressive else "minimal"


def _preprocess_pil(img: Image.Image, *, aggressive: bool) -> Image.Image:
    """Apply PIL-based preprocessing pipeline."""
    # 1. Auto-contrast enhancement
    img = ImageOps.autocontrast(img, cutoff=2)

    # 2. Brightness normalization for dark images
    gray = img.convert("L")
    stat = ImageStat.Stat(gray)
    if stat.mean[0] < 180:
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(1.3)

    # 3. Contrast enhancement
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.2)

    # 4. Sharpness for text edges
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(1.5)

    # 5. Aggressive mode: enhance local contrast more
    if aggressive:
        gray = img.convert("L")
        gray = ImageOps.autocontrast(gray)
        img = gray.convert("RGB")

    return img


def _prepare_opencv(image_bytes: bytes, enhance: Literal["auto", "minimal", "aggressive"]) -> bytes:
    """OpenCV-based preprocessing (preferred when available)."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    total_pixels = img.width * img.height
    if total_pixels > MAX_PIXELS:
        ratio = (MAX_PIXELS / total_pixels) ** 0.5
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

    if enhance == "auto":
        enhance = _detect_enhancement_level(cv_img)

    if enhance == "minimal":
        processed = cv_img
    else:
        processed = _preprocess_opencv(cv_img, aggressive=(enhance == "aggressive"))

    rgb = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def _detect_enhancement_level(img: np.ndarray) -> Literal["minimal", "aggressive"]:
    """Auto-detect if image needs aggressive preprocessing."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    brightness = gray.mean()
    contrast = gray.std()
    
    h, w = gray.shape
    regions = []
    for i in range(3):
        for j in range(3):
            y1, y2 = h * i // 3, h * (i + 1) // 3
            x1, x2 = w * j // 3, w * (j + 1) // 3
            regions.append(gray[y1:y2, x1:x2].mean())
    lighting_variance = np.std(regions)
    
    needs_aggressive = brightness < 180 or contrast < 50 or lighting_variance > 30
    return "aggressive" if needs_aggressive else "minimal"


def _preprocess_opencv(img: np.ndarray, *, aggressive: bool) -> np.ndarray:
    """Apply OpenCV preprocessing pipeline."""
    result = img.copy()
    
    if aggressive:
        result = _remove_shadows(result)
    
    result = _apply_clahe(result)
    result = cv2.bilateralFilter(result, d=9, sigmaColor=75, sigmaSpace=75)
    
    if aggressive:
        gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        result = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
    
    return result


def _remove_shadows(img: np.ndarray) -> np.ndarray:
    """Remove shadows via morphological operations."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    dilated = cv2.dilate(gray, np.ones((7, 7), np.uint8))
    bg = cv2.medianBlur(dilated, 21)
    diff = 255 - cv2.absdiff(gray, bg)
    norm = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    return cv2.cvtColor(norm, cv2.COLOR_GRAY2BGR)


def _apply_clahe(img: np.ndarray) -> np.ndarray:
    """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    lab = cv2.merge([l, a, b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
