/**
 * pathummaApi.ts — JaiKraJok Pathumma LLM client (v3)
 * =====================================================
 * OFFICIAL Pathumma LLM endpoints from the aift Python library source:
 *   textqa.py  → POST https://api.aiforthai.in.th/textqa/completion
 *   vqa.py     → POST https://api.aiforthai.in.th/vqa/inference/
 *   audioqa.py → POST https://api.aiforthai.in.th/audioqa/inference/
 *
 * All calls route through the Vite proxy /api/pathumma → https://api.aiforthai.in.th
 *
 * IMPORTANT content-type per endpoint (matches Python requests library behaviour):
 *   textqa  → application/x-www-form-urlencoded  (data={...}, no files)
 *   vqa     → multipart/form-data                (files=[('file',...)], data={'query':...})
 *   audioqa → multipart/form-data                (files=[('file',...)], data={'instruction':...})
 */

const API_KEY: string = (import.meta.env.VITE_PATHUMMA_API_KEY as string) ?? "";
const PROXY   = "/api/pathumma";

/** Returns true when a real key has been configured in .env */
export function hasApiKey(): boolean {
  return API_KEY.trim().length > 0 && !API_KEY.includes("YOUR_API_KEY");
}

/** Auth header required on every Pathumma API call */
function authHeaders(): Record<string, string> {
  return { Apikey: API_KEY, "X-lib": "jaikrajok-web" };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Strip <think>…</think> reasoning blocks the model sometimes emits */
function stripThink(text: string): string {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const idx = text.toLowerCase().indexOf("<think>");
  if (idx !== -1) text = text.slice(0, idx);
  return text.trim();
}

/**
 * Extract the bot reply string from every shape the API can return.
 * Pathumma primary format: { content: "..." }
 * Also handles OpenAI-compat and other field names as fallback.
 */
function extractText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (!raw || typeof raw !== "object") return "";
  const r = raw as Record<string, unknown>;

  // OpenAI-compatible: choices[0].message.content
  if (Array.isArray(r.choices) && r.choices.length > 0) {
    const c = r.choices[0] as Record<string, unknown>;
    const msg = c.message as Record<string, unknown> | undefined;
    if (msg?.content) return String(msg.content).trim();
    if (c.text) return String(c.text).trim();
  }

  // Pathumma direct fields — try 'content' first (confirmed from README)
  for (const k of ["content", "response", "output", "text", "result", "generated_text", "answer"]) {
    if (r[k] && typeof r[k] === "string") return (r[k] as string).trim();
  }

  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TEXT LLM — POST /textqa/completion
//    Content-Type: application/x-www-form-urlencoded  ← CRITICAL
//    Body: instruction, system_prompt, max_new_tokens, temperature
//    Response:  { instruction, system_prompt, content, temperature, max_new_tokens, ... }
// ═══════════════════════════════════════════════════════════════════════════════

export const JAIKRAJOK_SYSTEM_PROMPT =
  "คุณคือ กระจก (JaiKraJok) ผู้ช่วยสอนเรียนและเพื่อนคู่คิดอัจฉริยะ สร้างโดยทีม JaiKraJok " +
  "ตอบเป็นภาษาไทยอย่างสุภาพ อบอุ่น ชัดเจน ครอบคลุม ละเอียดลึกซึ้งในระดับมืออาชีพ (สไตล์ Gemini / Claude) " +
  "กติกาสำคัญสำหรับการตอบข้อซักถามแบบครบถ้วน (Comprehensive): " +
  "1. สำหรับโจทย์การโปรแกรม/เขียนโค้ด (C++, Python, Java, JS ฯลฯ): " +
  "   - ต้องเขียนโค้ดฉบับสมบูรณ์ในกล่องโค้ด ```cpp ... ``` หรือ ```python ... ``` เสมอ พร้อมมี Comment อธิบายในโค้ด " +
  "   - ตรวจสอบไวยากรณ์ภาษาให้ถูกต้อง 100% (เช่น C++ ให้ใช้ int/double/string/auto ห้ามใช้คำว่า var) " +
  "   - แบ่งหัวข้ออธิบายโครงสร้างและเนื้อหาเป็นข้อๆ อย่างชัดเจน (## หัวข้อหลัก, 1. 2. 3. หัวข้อย่อย) " +
  "2. สำหรับโจทย์คณิตศาสตร์และวิทยาศาสตร์: " +
  "   - ใช้ LaTeX เขียนสมการ: inline ใช้ $...$ และ block ใช้ $$...$$ " +
  "   - แสดงขั้นตอนการคิดทีละบรรทัด พร้อมเหตุผลประกอบ " +
  "3. ตอบคำถามอย่างละเอียด ครอบคลุม ไม่ตัดย่อสั้นจนขาดเนื้อหาสำคัญ " +
  "4. หากผู้ใช้มีความเสี่ยงทางอารมณ์หรือซึมเศร้ารุนแรง ให้คำปรึกษาด้วยความห่วงใยและแนะนำสายด่วน 1323";

export const MATH_SYSTEM_PROMPT =
  "คุณคือครูสอนพิเศษคณิตศาสตร์และวิทยาศาสตร์ผู้เชี่ยวชาญระดับสูง สร้างโดยทีม JaiKraJok " +
  "กฎการตอบ: " +
  "1. ตอบเป็นภาษาไทย อธิบายละเอียด ทุกขั้นตอน " +
  "2. แสดงสูตรและสมการด้วย LaTeX: inline ใช้ $...$ และ block ใช้ $$...$$ " +
  "3. อธิบายขั้นตอนการคำนวณทีละขั้นอย่างชัดเจน พร้อมสรุปคำตอบสุดท้ายในกรอบ $$...$$ " +
  "4. จัดรูปแบบด้วย Markdown: ใช้หัวข้อ ##, ลำดับข้อ 1. 2. 3. และกล่องโค้ด ``` เมื่อมีตัวอย่างโปรแกรม " +
  "5. ให้กำลังใจและแนะนำโจทย์ฝึกเพิ่มเติมที่ปลายคำตอบเสมอ";


/**
 * TEXT LLM: Send a text prompt → get a Thai language reply
 *
 * Uses URLSearchParams (application/x-www-form-urlencoded) — matching how
 * the Python requests library sends `data=payload` with no files.
 */
export async function callTextLLM(
  instruction: string,
  systemPrompt: string = JAIKRAJOK_SYSTEM_PROMPT,
  maxTokens: number = 512,
  temperature: number = 0.4,
  history?: { role: string; text: string }[]
): Promise<string> {
  // If there's history, we format it into the prompt since Pathumma TextQA doesn't take a messages array natively
  let fullInstruction = instruction;
  if (history && history.length > 0) {
    const historyText = history
      .slice(-6) // Keep last 6 messages for context to avoid token overflow
      .map((m) => `${m.role === "user" ? "ผู้ใช้" : "JaiKraJok"}: ${m.text}`)
      .join("\n\n");
    fullInstruction = `ประวัติการสนทนา:\n${historyText}\n\nข้อความปัจจุบันจากผู้ใช้:\n${instruction}`;
  }

  // Use URLSearchParams → sends as application/x-www-form-urlencoded

  // This matches the Python SDK: requests.post(url, data=payload, headers=headers)
  const body = new URLSearchParams({
    instruction: fullInstruction,
    system_prompt: systemPrompt,
    max_new_tokens: String(maxTokens),
    temperature: String(temperature),
  });

  const res = await fetch(`${PROXY}/textqa/completion`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[TextLLM] HTTP error", res.status, errBody.slice(0, 300));
    throw new Error(`Text LLM ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const raw = await res.json().catch(() => ({}));
  console.debug("[TextLLM] raw response:", raw);
  const text = stripThink(extractText(raw));
  if (!text) throw new Error("Text LLM returned empty response");
  return text;
}

/**
 * SENTIMENT ANALYSIS via Text LLM
 * Classifies the dominant emotion in text. Falls back to keyword classifier.
 */
export async function analyzeSentiment(text: string): Promise<string> {
  try {
    const instruction =
      `วิเคราะห์อารมณ์หลักจากข้อความต่อไปนี้: "${text}"\n` +
      `ตอบด้วยคำเดียวเท่านั้น (ห้ามมีคำอื่น): stressed, sad, tired, positive, calm, หรือ neutral`;

    const result = await callTextLLM(instruction, JAIKRAJOK_SYSTEM_PROMPT, 16, 0.1);
    const lower = result.toLowerCase().trim();
    for (const key of ["stressed", "sad", "tired", "positive", "calm", "neutral"]) {
      if (lower.includes(key)) return key;
    }
  } catch {
    // fall through to keyword classifier
  }
  return classifyMoodFromText(text);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. VISION LLM — POST /vqa/inference/
//    Content-Type: multipart/form-data
//    Body: query (text), file (image blob)
//    Response:  { content: "..." }
// ═══════════════════════════════════════════════════════════════════════════════

export interface VisionResult {
  answer: string;    // Vision model's direct description
  llmReply: string;  // Empathetic/instructional follow-up from Text LLM
}

/**
 * VISION LLM: Analyse an image with a text question.
 * Uses POST /vqa/inference/ with multipart/form-data.
 * Field confirmed from source: 'query' (text), 'file' (image).
 */
export async function callVisionLLM(
  imageBlob: Blob,
  query: string,
  filename = "image.jpg"
): Promise<string> {
  const form = new FormData();
  form.append("query", query);          // confirmed field name from vqa.py
  form.append("file", imageBlob, filename);

  const res = await fetch(`${PROXY}/vqa/inference/`, {
    method: "POST",
    headers: authHeaders(),             // Do NOT set Content-Type — browser sets boundary
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[VisionLLM] HTTP error", res.status, errBody.slice(0, 300));
    throw new Error(`Vision LLM ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const raw = await res.json().catch(() => ({}));
  console.debug("[VisionLLM] raw response:", raw);
  const text = stripThink(extractText(raw));
  if (!text) throw new Error("Vision LLM returned empty response");
  return text;
}

/**
 * Selfie emotion analysis:
 * 1. Vision LLM describes face/emotion in the photo
 * 2. Text LLM gives an empathetic follow-up response
 */
export async function analyzeSelfie(imageBlob: Blob): Promise<VisionResult> {
  const visionQuery =
    "ดูใบหน้าของคนในภาพนี้แล้วบรรยายอารมณ์และความรู้สึกที่สังเกตเห็นเป็นภาษาไทย " +
    "สังเกตจากแววตา สีหน้า และท่าทาง ตอบสั้น ๆ 1-2 ประโยค";

  let answer: string;
  try {
    answer = await callVisionLLM(imageBlob, visionQuery);
  } catch (e) {
    console.warn("Vision LLM selfie failed:", e);
    answer = "ไม่สามารถวิเคราะห์ภาพใบหน้าได้ในขณะนี้";
  }

  const instruction =
    `จากการวิเคราะห์ภาพใบหน้า: "${answer}" ` +
    `ตอบสนองด้วยความเห็นอกเห็นใจ สอบถามความรู้สึกของผู้ใช้ ไม่เกิน 2-3 ประโยค`;

  let llmReply: string;
  try {
    llmReply = await callTextLLM(instruction);
  } catch {
    llmReply = answer || "กระจกเห็นรูปคุณแล้วค่ะ วันนี้รู้สึกเป็นยังไงบ้าง?";
  }

  return { answer, llmReply };
}

/**
 * Homework/math photo analysis:
 * 1. Vision LLM reads the problem (including calculus equations)
 * 2. Text LLM solves it step-by-step with MATH_SYSTEM_PROMPT
 */
export async function analyzeHomework(imageBlob: Blob): Promise<VisionResult> {
  const visionQuery =
    "อ่านและถอดความโจทย์ทั้งหมดในภาพนี้เป็นภาษาไทย " +
    "ถ้ามีสมการ สูตร หรือโจทย์แคลคูลัส (อนุพันธ์/อินทีกรัล/ลิมิต) ให้ระบุให้ครบถ้วนและชัดเจน " +
    "บอกด้วยว่าเป็นโจทย์ประเภทอะไร";

  let answer: string;
  try {
    answer = await callVisionLLM(imageBlob, visionQuery);
  } catch (e) {
    console.warn("Vision LLM homework failed:", e);
    answer = "ไม่สามารถอ่านโจทย์จากภาพได้ในขณะนี้";
  }

  const instruction =
    `โจทย์จากภาพ: "${answer}"\n\n` +
    `อธิบายวิธีแก้โจทย์ทีละขั้นตอน ถ้าเป็นแคลคูลัสให้แสดงสูตรและการคำนวณชัดเจน ` +
    `ให้กำลังใจผู้เรียนด้วย`;

  let llmReply: string;
  try {
    llmReply = await callTextLLM(instruction, MATH_SYSTEM_PROMPT, 768, 0.3);
  } catch {
    llmReply = answer || "กระจกเห็นการบ้านแล้วค่ะ ติดขั้นตอนไหนบอกกระจกได้เลยนะ";
  }

  return { answer, llmReply };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AUDIO LLM — POST /audioqa/inference/
//    Content-Type: multipart/form-data
//    Body: instruction (text), file (audio blob)
//    Response:  { content: "..." }
//
//    Two-step pipeline: AudioQA (STT) → TextQA (sentiment + empathetic reply)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AudioResult {
  transcription: string;  // Speech-to-text result
  llmReply: string;       // Empathetic/supportive reply
  emotionKey: string;     // Mood key for UI
}

/**
 * Low-level AudioQA call.
 * Uses POST /audioqa/inference/ with multipart/form-data.
 * Supported audio: wav, mp3, ogg, mp4, webm.
 */
export async function callAudioLLM(audioBlob: Blob, instruction: string): Promise<string> {
  const form = new FormData();

  // Map MIME type → extension for the filename
  const mimeToExt: Record<string, string> = {
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/webm": "webm",
    "video/webm": "webm",
  };
  const ext = mimeToExt[audioBlob.type] ?? "webm";
  form.append("file", audioBlob, `recording.${ext}`);
  form.append("instruction", instruction);  // confirmed field from audioqa.py

  const res = await fetch(`${PROXY}/audioqa/inference/`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[AudioLLM] HTTP error", res.status, errBody.slice(0, 300));
    throw new Error(`Audio LLM ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const raw = await res.json().catch(() => ({}));
  console.debug("[AudioLLM] raw response:", raw);
  const text = stripThink(extractText(raw));
  if (!text) throw new Error("Audio LLM returned empty response");
  return text;
}

/**
 * Full audio pipeline:
 *   Step 1 — AudioQA: speech-to-text + basic response
 *   Step 2 — TextQA sentiment: classify emotion from transcription
 *   Step 3 — TextQA reply: warm empathetic response
 */
export async function analyzeAudio(audioBlob: Blob): Promise<AudioResult> {
  // Step 1: AudioQA — speech to text
  const audioInstruction =
    "ฟังเสียงนี้และแปลงเป็นข้อความภาษาไทยให้ครบถ้วน " +
    "ตอบในรูปแบบ: [ข้อความ: ...ข้อความที่ได้ยิน...] แล้วตามด้วยสรุปสั้น ๆ ว่าผู้พูดกำลังพูดถึงอะไร";

  let audioResponse = "";
  let transcription = "";

  try {
    audioResponse = await callAudioLLM(audioBlob, audioInstruction);
    // Extract transcription from "[ข้อความ: ...]" pattern
    const match = audioResponse.match(/\[ข้อความ[:\s]+([^\]]+)\]/i);
    transcription = match ? match[1].trim() : audioResponse;
  } catch (err) {
    console.warn("AudioQA failed:", err);
    return {
      transcription: "",
      llmReply: "ขอโทษนะคะ กระจกได้ยินเสียงไม่ชัด ลองพูดอีกครั้งหรือพิมพ์ข้อความแทนได้ค่ะ",
      emotionKey: "neutral",
    };
  }

  // Step 2: Classify emotion from transcription
  const textForAnalysis = transcription || audioResponse;
  const emotionKey = await analyzeSentiment(textForAnalysis);

  // Step 3: Empathetic reply via Text LLM
  let llmReply: string;
  try {
    const replyInstruction =
      `ผู้ใช้พูดว่า: "${textForAnalysis}"\n` +
      `ตอบสนองด้วยความเข้าใจและเห็นอกเห็นใจ ถ้ามีคำถามช่วยตอบด้วย ตอบไม่เกิน 3 ประโยค`;
    llmReply = await callTextLLM(replyInstruction);
  } catch {
    llmReply = audioResponse.replace(/\[ข้อความ[:\s]+[^\]]+\]/i, "").trim()
      || "กระจกได้ยินคุณแล้วค่ะ วันนี้รู้สึกเป็นยังไงบ้าง?";
  }

  return { transcription, llmReply, emotionKey };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mood Classifier — Thai keyword-based (local, no API needed)
// Used as fallback when API calls fail
// ═══════════════════════════════════════════════════════════════════════════════

const MOOD_CUES: [string, string[]][] = [
  ["stressed", ["เครียด", "กดดัน", "กังวล", "วิตก", "ประหม่า", "รับไม่ไหว", "stress", "สอบ", "ไม่ทัน", "หนักมาก"]],
  ["tired",    ["เหนื่อย", "ง่วง", "อ่อนเพลีย", "หมดแรง", "ไม่มีแรง", "เพลีย", "tired", "นอนไม่หลับ", "ล้า"]],
  ["sad",      ["เศร้า", "ร้องไห้", "เสียใจ", "ท้อ", "หมดกำลังใจ", "เหงา", "โดดเดี่ยว", "ผิดหวัง", "sad", "แย่"]],
  ["positive", ["ดีใจ", "สนุก", "เยี่ยม", "มีความสุข", "ภูมิใจ", "ชอบมาก", "happy", "สุขใจ", "สำเร็จ"]],
  ["calm",     ["สงบ", "ผ่อนคลาย", "สบายใจ", "โล่งใจ", "ปกติดี", "calm", "โอเค"]],
];

export function classifyMoodFromText(text: string): string {
  if (!text) return "neutral";
  const lower = text.toLowerCase();
  for (const [mood, cues] of MOOD_CUES) {
    if (cues.some((c) => lower.includes(c))) return mood;
  }
  return "neutral";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unified chat handler — Text LLM + parallel sentiment analysis
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatResult {
  reply: string;
  emotionKey: string;
}

/**
 * Main chat: sends user message to Text LLM, runs sentiment in parallel.
 * Uses 2048 tokens for comprehensive, structured, Gemini-quality responses.
 */
export async function chat(
  userMessage: string,
  history?: { role: string; text: string }[]
): Promise<ChatResult> {
  const [reply, emotionKey] = await Promise.all([
    callTextLLM(userMessage, JAIKRAJOK_SYSTEM_PROMPT, 2048, 0.5, history),
    analyzeSentiment(userMessage).catch(() => classifyMoodFromText(userMessage)),
  ]);
  return { reply, emotionKey };
}

