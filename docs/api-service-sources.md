# API Service Sources

Where every module in `api/app/services/` gets its data from.

Compiled 2026-08-05 by reading the source and probing the live gateways.
Endpoint details come from the code and from observed responses, **not** from
vendor documentation: `aiforthai.in.th/user/api-service-list/*` is behind a
login wall and returns only an empty "AI FOR THAI" shell to an unauthenticated
fetch, and no third-party page found in search accurately describes these
routes. Treat the tables below as the working record until NECTEC publishes
something authoritative.

---

## 1. Providers at a glance

Two upstreams, two separate credentials.

| Provider | Base URL | Auth | Config key |
|---|---|---|---|
| **AI for Thai** (NECTEC) | `https://api.aiforthai.in.th` | `Apikey: <key>` header | `AIFORTHAI_API_KEY` |
| **Pathumma TokenMind** | `https://tokenmind.pathumma.in.th/v1` | `Authorization: Bearer <key>` | `TOKENMIND_API_KEY` |

TokenMind is OpenAI-compatible and serves the LLM and ASR. AI for Thai serves
everything else - sentiment, face, OCR, TTS - because the TokenMind gateway
does not offer those.

Both base URLs are overridable via env (`AIFORTHAI_BASE_URL`,
`TOKENMIND_BASE_URL`). Only `ocr.py`'s VQA URL is hardcoded.

---

## 2. Service map

| Module | Purpose | Primary source | Fallback | Status |
|---|---|---|---|---|
| `sentiment.py` | Thai sentiment | AI4Thai `/ssense` | none | Working |
| `mood.py` | 6-mood classification | **local, no network** | n/a | Working |
| `pathumma.py` | LLM replies | TokenMind `thaillm-8b` | AI4Thai `/textqa/completion` | Working |
| `stt.py` | Speech-to-text | TokenMind `ptm-asr-1` | AI4Thai `/partii-webapi` | Working |
| `tts.py` | Text-to-speech | AI4Thai `/vaja9/synth_audiovisual` | TokenMind `ptm-tts-1` (disabled) | Degraded |
| `face.py` | Face detection | AI4Thai `/facedetect-w-wo-mask` | none | Working |
| `ocr.py` | Image to text | Pathumma VQA | `/ocr` tiers then `/handwritten` | **Broken** |
| `base.py` | Shared result types | n/a | n/a | n/a |

---

## 3. Per-service detail

### `sentiment.py` - S-Sense

```
POST https://api.aiforthai.in.th/ssense
Apikey: <key>
Content-Type: application/x-www-form-urlencoded
text=<thai text>
```

Timeout 30s. Response:

```json
{"sentiment": {"score": "98.63", "polarity-neg": true,
               "polarity-pos": false, "polarity": "negative"},
 "alert": [], "comparative": [], "associative": [],
 "intention": {"request": "0", "sentiment": "0",
               "question": "0", "announcement": "0"},
 "preprocess": {"input": "...", "neg": [], "pos": [],
                "segmented": [], "keyword": []}}
```

`score` is a percentage string; `_normalize_score` divides by 100 and clamps
to [0,1]. Neutral text returns `polarity: ""` and `score: "0"` - a success, not
a failure, and `analyze_sentiment` now maps it to `"neutral"` rather than
leaving `sentiment=None`.

**Only working sentiment route on the platform.** Probed 2026-08-05 across 7
candidates: `/emonews` gave 404; `/cyberbully`, `/cyberbullying`, `/thaimoji`,
`/sentiment` gave 415 "Non-gRPC request matched gRPC route"; `/emoji` gave 405.

**Limitation, safety-relevant:** S-Sense does not detect self-harm language.
The Thai phrase for "I want to die, I don't want to be here anymore" returns
polarity `""`, score `0`, and `intention.request: 80` - it reads a plea for
help as a request. Crisis detection is handled entirely by `is_crisis()` in
`app/api/web_chat.py`, which runs *before* sentiment. Do not move sentiment
ahead of it.

`polarity-neg` / `polarity-pos` are currently discarded. Both can be true at
once (observed at score 66.67) - a mixed signal the single label flattens.

### `mood.py` - local, no API

No network call and no import of `sentiment.py`. Pure function:

```python
classify(text: str, polarity: str | None, score: float | None) -> str
```

Maps S-Sense's 3 polarities onto the 6 moods the UI renders
(`stressed / sad / tired / neutral / calm / positive`) using Thai lexical cues.
Both arguments are optional - with `(None, None)` it falls back to
keyword-only classification, so mood detection survives an S-Sense outage or
rate-limit.

`_STRONG` cues outrank sentiment polarity; `_WEAK` cues (topics such as exams)
only apply when polarity agrees. `_STRONG` is ordered by care needed:
stressed, sad, tired, positive, calm.

Wired to `sentiment.py` only through `_mood_and_reply()` in `web_chat.py`.

### `pathumma.py` - LLM

Primary:
```
POST https://tokenmind.pathumma.in.th/v1/chat/completions
Authorization: Bearer <tokenmind key>
{"model": "thaillm-8b", ...}
```
Timeout 90s.

Fallback:
```
POST https://api.aiforthai.in.th/textqa/completion
Apikey: <key>
```
Timeout 60s. Model `pathumma-llm-text-1.0.0`.

`thaillm-8b` is a reasoning model that emits `<think>...</think>` scratchpad
before its answer; `_strip_reasoning()` removes it. An *unclosed* `<think>`
means the token budget ran out mid-thought and nothing usable follows, so the
whole response is dropped. `_strip_emoji()` also filters emoji, since the
system prompt forbids them but the model complies only intermittently.

System prompt pins the persona: Thai only, no diagnosis, no psychology
role-play, escalate severe risk to hotline **1323**.

### `stt.py` - speech-to-text

Primary:
```
POST https://tokenmind.pathumma.in.th/v1/audio/transcriptions
Authorization: Bearer <tokenmind key>
files: file=<audio>   data: model=ptm-asr-1
```
Timeout 120s.

Fallback:
```
POST https://api.aiforthai.in.th/partii-webapi
Apikey: <key>
files: wavfile=<audio>
data: outputlevel=--uttlevel, outputformat=--txt
```
Timeout 60s. Quota may be zero on some keys.

**Security note:** Partii echoes the API key back inside `inputfilename`.
`_scrub()` strips it before logging, because container logs are exposed at
`/logs/`. Never log a raw Partii response body.

### `tts.py` - text-to-speech

Primary (Vaja9):
```
POST https://api.aiforthai.in.th/vaja9/synth_audiovisual
Apikey: <key>
{"input_text": "...", "speaker": 0, "phrase_break": 0, "audiovisual": 0}
```
Timeout 30s. `speaker`: 0 = male, 1 = female. Max 300 chars. Returns JSON with
a `wav_url` that must then be fetched to get the audio.

Fallback (`ptm-tts-1`) is **disabled by default**: it returns HTTP 500 for
every request, including ones omitting the required `input` field, so the fault
is upstream of request validation. Enabling it would add a guaranteed-failing
round-trip to every reply. Set `TOKENMIND_TTS_ENABLED=1` once fixed.
`TOKENMIND_TTS_VOICE` is empty because the gateway exposes no `/v1/voices`
route, so no valid voice id is known.

**Open issue:** Vaja9 has been returning HTTP 401 on some keys. Unresolved.

### `face.py` - face detection

```
POST https://api.aiforthai.in.th/facedetect-w-wo-mask
Apikey: <key>
files: file=<image/jpeg>
```
Timeout 30s. Returns `objects[]` with bounding boxes, mask status, and a
confidence `score` per face.

**Reports presence only - not emotion.** The API has no expression output, so
`/selfie/analyze` says how many faces it sees and explicitly tells the student
it cannot read feelings from a photo. Mood always comes from what the student
writes or says. Per the proposal, face images are processed in real time and
never stored.

### `ocr.py` - image to text

Three tiers, tried in order by `transcribe_image()`:

**Tier 1 - Pathumma VQA** (hardcoded URL)
```
POST https://api.aiforthai.in.th/vqa/inference/
Apikey: <key>
files: file=<image>   data: query=<thai prompt>
```
Timeout 90s. Whole-image transcription.

**Tier 2 - document OCR**, first success wins across
`/ocr`, `/ocr/tocr`, `/ocr/deepocr`. Timeout 60s. Max **900 KB**
(`_OCR_MAX_BYTES`) - larger payloads get 413.

**Tier 3 - `/handwritten`** (T-DHW). Timeout 30s. A *per-character glyph
detector*: returns `objects[]` of bboxes and classes, no text field.
`_extract_text()` rebuilds reading order by sorting left-to-right within
top-to-bottom lines (tolerance 12px). Suitable only for short handwritten
digits, not printed documents.

**All three are currently broken upstream.**

- VQA returns HTTP 200 with `"content": ""` for every image. Proven
  server-side, not our images or params: a trivial 400x120 synthetic PNG
  reading "Hello 123 test" in black on white returned empty across 3 different
  query phrasings.
- `/handwritten` returns `{"errmsg": "local variable 'roi' referenced before
  assignment"}` - an upstream Python traceback - at every image size.
- `/ocr/tocr` and `/ocr/deepocr` sometimes answer **HTTP 200 with the bare body
  `404`**. A naive client would pass the string "404" through as OCR'd text;
  `extract_text_document()` guards with `if body.isdigit(): continue`.

Callers never see the raw `roi` traceback - the chain returns one aggregated
honest error. Recommend contacting AI for Thai support with the
synthetic-image evidence.

---

## 4. Gateway status codes

Learned by probing; useful for diagnosing new routes.

| Code | Meaning |
|---|---|
| 200 + bare digit body | Gateway up, backing service unavailable |
| 200 + `errmsg` | Upstream model crashed |
| 401 | Key rejected / not provisioned for that service |
| 404 | Route does not exist |
| 405 | Wrong HTTP method |
| 413 | Route exists, payload too large |
| 415 "Non-gRPC request matched gRPC route" | Path routes to gRPC, rejects multipart |
| 429 | Free-tier rate limit |
| 502 | Upstream broken |

A 413 or 415 confirms a route **exists**; a 404 means it does not.

---

## 5. Constraints

**Licensing.** The AI for Thai free tier is stated as free for education or
testing only, with commercial use prohibited and call volume limited
("Free limited services"). This conflicts with the paid school-subscription
model in the proposal and must be resolved with NECTEC before monetizing.

**Rate limits.** The free tier limits aggressively - probe scripts need 3-35s
between calls. A live demo with a room full of simultaneous users may hit 429.
Every service degrades to a Thai-language message rather than an error page.

**Keys.** Always from env, never hardcoded or logged. All probe scripts read
via `get_settings()` and never echo the key. Remember Partii echoes the key in
its response body - scrub before logging.

**TLS.** `INSECURE_TLS` disables certificate verification. Local shells with a
broken CA bundle only (e.g. MSYS2 Python) - **never in the deployed
container**, where certs verify fine.

---

## 6. Known open issues

| Issue | Service | Impact |
|---|---|---|
| VQA returns empty content | `ocr.py` | Homework OCR unusable |
| `/handwritten` `roi` crash | `ocr.py` | No OCR fallback |
| Vaja9 HTTP 401 | `tts.py` | Voice replies may fail |
| `ptm-tts-1` HTTP 500 | `tts.py` | No TTS fallback |
| No `/v1/voices` route | `tts.py` | Voice id unknown |
| Free tier bans commercial use | all AI4Thai | Blocks proposal business model |
| `polarity-neg`/`pos` discarded | `sentiment.py` | Mixed signals flattened |
| `/emotion/analyze` reports `confidence=0.5` on failure | `web_chat.py` | Misleading; cosmetic today |