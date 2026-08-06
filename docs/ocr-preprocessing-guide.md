# OCR Image Preprocessing Implementation

**Status:** Implemented  
**Date:** 2026-08-06  
**Component:** `api/app/services/image_prep.py`

## Summary

Automatic image preprocessing pipeline to improve OCR accuracy on Thai handwritten homework photos. Implements research-backed techniques including adaptive contrast enhancement, brightness normalization, shadow removal, denoising, and adaptive binarization.

## Problem

AI for Thai OCR services fail on many real-world homework photos with:
- **"roi" error** from `/handwritten` endpoint on large/complex images
- **Empty VQA responses** on photos with poor lighting
- **502/429 errors** from document OCR endpoints under load
- Poor text extraction from images with shadows, low contrast, uneven lighting

Testing showed OCR.space (foreign service, violates proposal p.9 ☐) successfully extracted text from `submit.png` that all AI for Thai endpoints failed on, proving the image contains readable content — preprocessing can recover it.

## Solution

Three-tier preprocessing pipeline with automatic intensity detection:

### 1. **Minimal** (clean scans)
- Resize to ≤500K pixels (prevents "roi" error)
- Preserve aspect ratio using LANCZOS resampling

### 2. **Auto** (default)
- Analyzes brightness (mean), contrast (stddev), lighting uniformity
- Triggers aggressive mode if:
  - Brightness < 180 (dark images)
  - Contrast < 50 (low contrast)
  - Lighting variance > 30 (uneven illumination, OpenCV only)

### 3. **Aggressive** (poor lighting/shadows)
**PIL-only fallback (no OpenCV):**
- Auto-contrast enhancement (2% cutoff)
- Brightness boost (×1.3) for dark images
- Contrast enhancement (×1.2)
- Sharpness enhancement (×1.5) for text edges
- Grayscale conversion with enhanced local contrast

**OpenCV pipeline (preferred when available):**
- Shadow removal via morphological dilation + median blur
- CLAHE (Contrast Limited Adaptive Histogram Equalization) on LAB L-channel
- Bilateral filter denoising (preserves text edges)
- Adaptive Gaussian thresholding (binarization)

## Research References

- **Adaptive thresholding:** handles uneven lighting better than global methods (idp-software.com, handwriting.guru)
- **CLAHE:** localized contrast enhancement, prevents over-enhancement artifacts (idp-software.com)
- **Bilateral filter:** edge-preserving noise reduction, critical for handwriting (dev.to OCR guide)
- **Shadow removal:** morphological operations normalize background variations (dev.to, GitHub neonwatty/python-ocr-preprocessing)
- **Bicubic upscaling:** preserves text clarity better than bilinear (dev.to)

## Integration

`api/app/services/ocr.py` automatically applies preprocessing before all OCR API calls:

```python
async def transcribe_image(image_bytes: bytes) -> ServiceResult:
    # Preprocess image to improve OCR accuracy
    try:
        image_bytes = prepare_for_ocr(image_bytes, enhance="auto")
    except Exception as e:
        logger.warning("Image preprocessing failed: %s", e)
        # Continue with original image if preprocessing fails
    
    vqa = await extract_text_vqa(image_bytes)
    # ... fallback chain continues
```

## OpenCV Status

**Not currently installed** due to build dependencies failure on this Windows environment. Pipeline falls back to PIL-only processing, which provides:
- ✅ Resize (prevents "roi" error)
- ✅ Auto-contrast enhancement
- ✅ Brightness/contrast/sharpness adjustment
- ❌ CLAHE (LAB color space)
- ❌ Bilateral denoising
- ❌ Shadow removal
- ❌ Adaptive binarization

**For production deployment:** Install `opencv-python-headless` in the Docker container (`requirements.txt` or `Dockerfile`). The code automatically detects OpenCV availability and uses the full pipeline when present.

## Constraints

Per proposal p.9 ☐ "ใช้เทคโนโลยี AI ต่างประเทศร่วมด้วย" (UNCHECKED), foreign OCR services cannot be added as fallbacks. This preprocessing pipeline improves success rates with existing AI for Thai services while staying within proposal constraints.

## Next Steps

1. **Test live:** Upload `submit.png` through `/homework/ocr` endpoint to verify preprocessing improves extraction
2. **Install OpenCV in container:** Add `opencv-python-headless==4.8.1.78` to `requirements.txt`
3. **Monitor metrics:** Track VQA/document OCR success rates before/after preprocessing
4. **Consider openthaigpt/thai-trocr:** Local fallback model (Apache-2.0, Thai-origin, CER 0.190 on handwriting) if preprocessing alone insufficient

## Files Modified

- **Created:** `api/app/services/image_prep.py` (210 lines)
- **Modified:** `api/app/services/ocr.py` (added preprocessing call)
