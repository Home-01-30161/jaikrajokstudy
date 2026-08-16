# 🔍 IMAGE DETECTION ISSUE - SELFIE CLASSIFIED AS HOMEWORK

**Date:** 2026-08-16  
**Issue:** Clean selfie image (person's face, no text) being analyzed as homework  
**User Report:** Screenshot showing bot giving long AI explanation instead of emotion analysis  

---

## 📸 OBSERVED BEHAVIOR

**What User Sent:** Selfie image (clear face, no visible text)

**Expected Bot Response:**
```
เห็นความรู้สึกสงบและผ่อนคลายจากสีหน้า ดูมีสมาธิและพร้อมเรียน [อารมณ์: สงบ]
```

**Actual Bot Response:**
```
กรุณาไม่สามารถวิเคราะห์อารมณ์ได้โดยตรง เนื่องจากไม่มีเครื่องมือโดยตรง... 
[Long explanation about AI limitations]
```

**Diagnosis:** Bot is running in **"homework" mode** instead of **"selfie" mode**

---

## 🔬 ROOT CAUSE ANALYSIS

### **Detection Flow:**

```javascript
// Line 1106-1131: Detection prompt asks Typhoon OCR
{
  model: "typhoon-ocr",
  messages: [{
    role: "system",
    content: "Determine: (A) has_text? (B) has_face? Reply JSON"
  }, {
    role: "user", 
    content: [image, "Analyze this image."]
  }]
}

// Line 1150: Mode selection logic
mode = hasFace && !hasText ? "selfie" : "homework";
```

### **Why Selfie → Homework?**

For the logic to choose **"homework"** instead of **"selfie"**, one of these must be true:

| Scenario | hasText | hasFace | Logic Result | Cause |
|----------|---------|---------|--------------|-------|
| **A** | `true` | `true` | homework ✅ | Typhoon OCR detected text in selfie |
| **B** | `true` | `false` | homework ✅ | Typhoon OCR detected text, no face |
| **C** | `false` | `false` | homework ✅ | Typhoon OCR detected neither text nor face |

**Most Likely: Scenario A or C**

---

## 🐛 POSSIBLE CAUSES

### **1. Typhoon OCR False Positive (Text Detection)**

**Hypothesis:** The model sees **background text** or **screen reflections** in the image

**Evidence from Screenshot:**
- User is lying down with phone
- Possible reflections on screen
- Room lighting could create text-like patterns
- Phone UI elements might be partially visible

**What Typhoon might detect:**
- LINE app UI text visible in reflection
- Timestamp "22:34" visible in image
- Background posters/signs
- Phone screen glare patterns

### **2. Typhoon OCR Face Detection Failure**

**Hypothesis:** Model fails to detect face due to angle/lighting

**Evidence:**
- User lying down (unusual angle)
- Low-light environment (22:34 = night time)
- Face partially in shadow
- Unconventional selfie angle

### **3. JSON Parsing Failure**

**Hypothesis:** Typhoon returns malformed JSON → fallback to keyword heuristics

**Current Fallback Logic (Lines 1143-1146):**
```javascript
if (!jsonMatch) {
  hasText = /text|homework|document|handwriting|equation|question|exercise/i.test(detRaw);
  hasFace = /selfie|face|person/i.test(detRaw) && !hasText;
}
```

**Problem:** If Typhoon response contains word "text" anywhere (e.g., "no text visible"), `hasText = true` ❌

**Example Failure:**
```
Typhoon returns: "The image shows a person's face with no text content."
→ Regex detects "text" → hasText = true
→ mode = "homework" ❌
```

---

## 🔧 DIAGNOSTIC LOGGING ADDED

### **Changes Made:**

**1. Detection Result Logging (After Line 1146):**
```javascript
console.log("[Image Detection]", {
  raw: detRaw.slice(0, 200),
  hasText,
  hasFace,
  userId: userId.slice(0, 8),
});
```

**2. Mode Selection Logging (After Line 1150):**
```javascript
console.log(`[Image Mode] Selected: ${mode} (hasText=${hasText}, hasFace=${hasFace})`);
```

**3. Final Result Logging (After Line 1175):**
```javascript
console.log("[Image Result]", {
  finalMode: mode,
  resultLength: visionResult.length,
  hasEmotionTag: /\[อารมณ์:/i.test(visionResult),
  preview: visionResult.slice(0, 100),
});
```

---

## 📊 HOW TO INVESTIGATE

### **Step 1: Check Dozzle Logs**

After deploying the logging changes, send another selfie and check `/logs/` in Dozzle:

```bash
# Look for these log lines:
[Image Detection] { raw: '...', hasText: true/false, hasFace: true/false, userId: '...' }
[Image Mode] Selected: homework (hasText=true, hasFace=true)
[Image Result] { finalMode: 'homework', resultLength: 450, hasEmotionTag: false, preview: '...' }
```

### **Step 2: Analyze Detection Response**

**If you see:**
```json
[Image Detection] { 
  raw: '{"has_text": true, "has_face": true}', 
  hasText: true, 
  hasFace: true 
}
```

**→ Typhoon is detecting text where there is none**

**If you see:**
```json
[Image Detection] { 
  raw: 'The image shows a person lying down, no text visible', 
  hasText: true,  // ❌ WRONG - regex detected "text" keyword
  hasFace: true 
}
```

**→ JSON parsing failed, keyword fallback triggered incorrectly**

**If you see:**
```json
[Image Detection] { 
  raw: '{"has_text": false, "has_face": false}', 
  hasText: false, 
  hasFace: false 
}
```

**→ Typhoon failed to detect the face**

---

## 🛠️ RECOMMENDED FIXES

### **Fix #1: Improve Keyword Fallback (Immediate)**

**Problem:** Current regex is too broad

**Current Code (Line 1144):**
```javascript
hasText = /text|homework|document|handwriting|equation|question|exercise/i.test(detRaw);
```

**Fixed Code:**
```javascript
// Only detect positive assertions, not negations
hasText = /\b(contains?|has|visible|readable|detected).*(text|homework|document)/i.test(detRaw) ||
          /text.*visible|homework.*present/i.test(detRaw);
```

### **Fix #2: Improve Detection Prompt (Better)**

**Current Prompt (Lines 1110-1117):**
```javascript
content: "You are an image classifier... Reply with ONLY JSON: {\"has_text\": true/false, \"has_face\": true/false}"
```

**Problem:** Not strict enough - Typhoon might add explanation

**Improved Prompt:**
```javascript
content: 
  "You are an image classifier. Analyze the image and respond with EXACTLY this JSON format, nothing else:\n" +
  '{"has_text": true, "has_face": true}\n\n' +
  "Rules:\n" +
  "- has_text: true if ANY readable text (handwriting, printed, equations, screenshots, whiteboards)\n" +
  "- has_face: true if ANY human face is visible\n" +
  "- EVEN IF both are present, report both as true\n" +
  "- DO NOT add explanation, only output the JSON"
```

### **Fix #3: Add Confidence Score (Best)**

**Enhanced Detection Schema:**
```javascript
{
  "has_text": true/false,
  "has_face": true/false,
  "text_confidence": 0.0-1.0,
  "face_confidence": 0.0-1.0
}
```

**Updated Logic:**
```javascript
// Only trust high-confidence detections
const hasText = det.has_text && (det.text_confidence || 1.0) > 0.7;
const hasFace = det.has_face && (det.face_confidence || 1.0) > 0.7;
```

### **Fix #4: Add Visual Debugging (Development)**

**Save detection results to temp file for manual review:**
```javascript
if (process.env.NODE_ENV === 'development') {
  const debugPath = `./debug_detection_${Date.now()}.json`;
  fs.writeFileSync(debugPath, JSON.stringify({
    userId,
    timestamp: new Date().toISOString(),
    detectionRaw: detRaw,
    hasText,
    hasFace,
    mode,
    imageBase64Sample: base64.slice(0, 100) + "...",
  }, null, 2));
}
```

---

## 🎯 NEXT STEPS

### **Immediate Actions:**

1. ✅ **Deploy logging changes** (already done above)
2. ⏳ **Test with real selfie** → check Dozzle logs
3. ⏳ **Identify which scenario (A/B/C)** is happening
4. ⏳ **Apply appropriate fix** based on findings

### **If Detection Shows `hasText=true` on Clean Selfie:**

**→ Fix #1 or #2** (improve prompt or keyword fallback)

### **If Detection Shows `hasFace=false` on Clean Selfie:**

**→ Issue is Typhoon OCR face detection accuracy**
- May need to switch face detection to separate model
- Or add confidence threshold
- Or use different prompt phrasing

### **If Detection Shows Correct JSON but Wrong Mode:**

**→ Logic error in mode selection** (unlikely, but check Line 1150)

---

## 📋 TEST MATRIX

After fixes, test these scenarios:

| Image Type | Expected hasText | Expected hasFace | Expected Mode |
|------------|------------------|------------------|---------------|
| Clean selfie (current issue) | false | true | selfie ✅ |
| Person holding paper | true | true | homework ✅ |
| Homework screenshot | true | false | homework ✅ |
| Whiteboard with person | true | true | homework ✅ |
| Group selfie | false | true | selfie ✅ |
| Abstract image | false | false | homework (default) ✅ |
| Textbook page | true | false | homework ✅ |
| Selfie with caption text | true | true | homework ✅ |

---

## 🔍 TYPHOON OCR MODEL BEHAVIOR

### **Known Characteristics:**

**Model:** `typhoon-ocr` via OpenTyphoon API  
**Endpoint:** `https://api.opentyphoon.ai/v1/chat/completions`  
**Capabilities:** OCR + image understanding + chat completion

**Observed Behaviors:**
- ✅ Good at reading Thai/English text
- ✅ Can detect faces in normal lighting
- ⚠️ May add explanatory text beyond JSON
- ⚠️ Performance degrades in low light
- ⚠️ May confuse reflections/glare for text
- ⚠️ Detection accuracy varies by image quality

**API Limits:**
- Timeout: 30s (current setting)
- Retries: 2 attempts with backoff
- Rate limit: Unknown (429 errors possible)

---

## 💡 ALTERNATIVE DETECTION STRATEGIES

### **Option 1: Two-Stage Detection**

**Stage 1:** Face detection only (faster, simpler)
```javascript
"Is there a human face in this image? Reply: YES or NO"
```

**Stage 2:** Only if NO face, check for text
```javascript
"Is there readable text? Reply: YES or NO"
```

**Pros:** More accurate, fewer false positives  
**Cons:** 2× API calls (slower, costlier)

### **Option 2: Use Dedicated Face Detection API**

Instead of Typhoon OCR for faces, use specialized service:
- Google Vision API (Face Detection)
- AWS Rekognition (DetectFaces)
- Azure Face API

**Pros:** Higher accuracy  
**Cons:** Additional dependency, cost

### **Option 3: Hybrid Approach**

```javascript
// Quick heuristic check first
const imageData = await getImageMetadata(imageBuffer);
if (imageData.aspectRatio > 0.7 && imageData.aspectRatio < 1.3) {
  // Square-ish image → likely selfie
  mode = "selfie";
} else {
  // Wide/tall image → likely homework screenshot
  mode = "homework";
}
// Then use Typhoon OCR as confirmation
```

**Pros:** Fast, reduces API dependency  
**Cons:** Heuristic may fail on cropped images

---

## 📞 SUPPORT

**If issue persists after fixes:**

1. Check Typhoon OCR API status: https://api.opentyphoon.ai/status
2. Verify API key has image analysis permissions
3. Test with different image sizes (resize before detection)
4. Consider rate limit (429 errors) → may need backoff
5. Contact Typhoon support if model behavior is incorrect

---

## ✅ VERIFICATION CHECKLIST

After deploying fixes:

- [ ] Clean selfie → detects `hasFace=true, hasText=false` → mode="selfie"
- [ ] Selfie with explanation response → mode="selfie" (emotion shown)
- [ ] Person holding paper → detects both → mode="homework"
- [ ] Homework screenshot → detects text only → mode="homework"
- [ ] Low-light selfie → still detects face → mode="selfie"
- [ ] No more false "homework" responses on selfies

---

**Report Generated:** 2026-08-16  
**Changes Made:** Added 3 diagnostic console.log statements  
**Next Action:** Deploy → Test with selfie → Check Dozzle logs → Apply appropriate fix  
**Priority:** HIGH - Affects core emotion analysis feature
