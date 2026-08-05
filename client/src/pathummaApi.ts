/**
 * pathummaApi.ts — JaiKraJok Pathumma LLM client
 * ================================================
 * Uses the OFFICIAL Pathumma LLM endpoints from the aift Python library source:
 *   textqa.py  → POST https://api.aiforthai.in.th/textqa/completion
 *   vqa.py     → POST https://api.aiforthai.in.th/vqa/inference/
 *   audioqa.py → POST https://api.aiforthai.in.th/audioqa/inference/
 *
 * All calls route through the Vite proxy /api/pathumma → https://api.aiforthai.in.th
 * to bypass CORS restrictions in the browser.
 *
 * Auth: Apikey header on every request.
 * Format: ALL three endpoints use multipart/form-data.
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
 * Extract the bot reply string from every shape the API can return:
 *   { content: "..." }          ← textqa common
 *   { choices:[{message:{content}}] }  ← OpenAI-compat
 *   { response/output/text/result: "..." }
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

  // Direct field names (textqa returns { content, instruction, ... })
  for (const k of ["content", "response", "output", "text", "result", "generated_text", "answer"]) {
    if (r[k] && typeof r[k] === "string") return (r[k] as string).trim();
  }

  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TEXT LLM — POST /textqa/completion
//    multipart/form-data: instruction, system_prompt, max_new_tokens, temperature
// ═══════════════════════════════════════════════════════════════════════════════

export const JAIKRAJOK_SYSTEM_PROMPT =
  "คุณคือ กระจก (JaiKraJok) เพื่อนช่วยเรียนที่เข้าใจอารมณ์ สร้างโดยทีม JaiKraJok " +
  "ตอบเป็นภาษาไทยเสมอ ชัดเจน สุภาพ อบอุ่น สนับสนุนผู้เรียน " +
  "ตอบสั้นกระชับไม่เกิน 3-4 ประโยค ไม่วินิจฉัยโรค ไม่เป็นนักจิตวิทยา " +
  "หากผู้ใช้มีความเสี่ยงรุนแรง แนะนำสายด่วน 1323";

/**
 * TEXT LLM: Send a text prompt → get a Thai language reply
 * Uses POST /textqa/completion with multipart/form-data
 */
export async function callTextLLM(
  instruction: string,
  systemPrompt: string = JAIKRAJOK_SYSTEM_PROMPT
): Promise<string> {
  const form = new FormData();
  form.append("instruction", instruction);
  form.append("system_prompt", systemPrompt);
  form.append("max_new_tokens", "512");
  form.append("temperature", "0.4");

  const res = await fetch(`${PROXY}/textqa/completion`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Text LLM ${res.status}: ${body.slice(0, 200)}`);
  }

  const raw = await res.json().catch(() => ({}));
  const text = stripThink(extractText(raw));
  if (!text) throw new Error("Text LLM returned empty response");
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. VISION LLM — POST /vqa/inference/
//    multipart/form-data: file (image blob), query (text question)
// ═══════════════════════════════════════════════════════════════════════════════

export interface VisionResult {
  answer: string;       // The VQA model's direct answer
  llmReply: string;     // Empathetic/instructional follow-up from Text LLM
}

/**
 * VISION LLM: Analyse an image with a text question
 * Uses POST /vqa/inference/ with multipart/form-data
 */
export async function callVisionLLM(
  imageBlob: Blob,
  query: string,
  filename = "image.jpg"
): Promise<string> {
  const form = new FormData();
  form.append("file", imageBlob, filename);
  form.append("query", query);

  const res = await fetch(`${PROXY}/vqa/inference/`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vision LLM ${res.status}: ${body.slice(0, 200)}`);
  }

  const raw = await res.json().catch(() => ({}));
  const text = stripThink(extractText(raw));
  if (!text) throw new Error("Vision LLM returned empty response");
  return text;
}

/**
 * Selfie emotion analysis:
 * 1. Ask Vision LLM to describe the person's emotion in the photo
 * 2. Then ask Text LLM to give an empathetic response
 */
export async function analyzeSelfie(imageBlob: Blob): Promise<VisionResult> {
  const visionQuery =
    "บรรยายอารมณ์และความรู้สึกของบุคคลในภาพนี้เป็นภาษาไทย " +
    "สังเกตจากใบหน้าและท่าทาง ตอบสั้นๆ 1-2 ประโยค";

  let answer: string;
  try {
    answer = await callVisionLLM(imageBlob, visionQuery);
  } catch (e) {
    answer = "ไม่สามารถวิเคราะห์ภาพได้";
  }

  // Use Text LLM to give an empathetic follow-up
  const instruction =
    `จากการวิเคราะห์ภาพเซลฟี่: "${answer}" ` +
    `กรุณาตอบสนองด้วยความเห็นอกเห็นใจ สอบถามความรู้สึกของผู้ใช้ ` +
    `ไม่เกิน 2-3 ประโยค`;

  let llmReply: string;
  try {
    llmReply = await callTextLLM(instruction);
  } catch (e) {
    llmReply = answer || "กระจกเห็นรูปคุณแล้ว วันนี้รู้สึกเป็นยังไงบ้างคะ?";
  }

  return { answer, llmReply };
}

/**
 * Homework photo analysis:
 * 1. Ask Vision LLM to read/describe the homework image
 * 2. Then ask Text LLM to explain how to solve it
 */
export async function analyzeHomework(imageBlob: Blob): Promise<VisionResult> {
  const visionQuery =
    "อ่านและอธิบายโจทย์หรือเนื้อหาในภาพการบ้านนี้เป็นภาษาไทย " +
    "ถ้ามีสมการหรือตัวเลข ให้ระบุให้ชัดเจน";

  let answer: string;
  try {
    answer = await callVisionLLM(imageBlob, visionQuery);
  } catch (e) {
    answer = "ไม่สามารถอ่านการบ้านได้";
  }

  // Use Text LLM to explain how to solve it
  const instruction =
    `โจทย์การบ้านจากภาพ: "${answer}" ` +
    `อธิบายวิธีคิดและขั้นตอนการแก้โจทย์นี้เป็นภาษาไทย ` +
    `ให้กำลังใจผู้เรียนด้วย`;

  let llmReply: string;
  try {
    llmReply = await callTextLLM(instruction);
  } catch (e) {
    llmReply = answer || "กระจกเห็นการบ้านแล้ว บอกกระจกว่าติดขั้นตอนไหนอยู่?";
  }

  return { answer, llmReply };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AUDIO LLM — POST /audioqa/inference/
//    multipart/form-data: file (audio blob), instruction (text prompt)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AudioResult {
  transcription: string;   // What the user said (extracted from LLM response)
  llmReply: string;        // Emotional/supportive reply
  emotionKey: string;      // Detected mood for UI
}

/**
 * AUDIO LLM: Transcribe Thai speech AND get empathetic response
 * Uses POST /audioqa/inference/ with multipart/form-data
 * The Audio LLM both transcribes AND understands context — single call
 */
export async function analyzeAudio(audioBlob: Blob): Promise<AudioResult> {
  const instruction =
    "ฟังเสียงและ: 1) แปลงเสียงเป็นข้อความ (transcription) " +
    "2) วิเคราะห์อารมณ์ที่ได้ยิน " +
    "3) ตอบด้วยความเห็นอกเห็นใจเป็นภาษาไทย " +
    "ตอบในรูปแบบ: [ข้อความ: ...] แล้วตามด้วยคำตอบ";

  const form = new FormData();
  // Detect content type from blob
  const ext = audioBlob.type.includes("mp3") ? "mp3"
    : audioBlob.type.includes("ogg") ? "ogg"
    : audioBlob.type.includes("mp4") ? "mp4"
    : "webm";
  form.append("file", audioBlob, `audio.${ext}`);
  form.append("instruction", instruction);

  const res = await fetch(`${PROXY}/audioqa/inference/`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Audio LLM ${res.status}: ${body.slice(0, 200)}`);
  }

  const raw = await res.json().catch(() => ({}));
  const fullResponse = stripThink(extractText(raw));

  // Try to extract transcription from "[ข้อความ: ...]" pattern
  const transcriptionMatch = fullResponse.match(/\[ข้อความ[:\s]+([^\]]+)\]/i);
  const transcription = transcriptionMatch
    ? transcriptionMatch[1].trim()
    : "";

  // The rest is the reply, or the whole thing if no pattern found
  const llmReply = transcriptionMatch
    ? fullResponse.replace(transcriptionMatch[0], "").trim()
    : fullResponse || "กระจกได้ยินคุณแล้วค่ะ วันนี้รู้สึกเป็นยังไงบ้าง?";

  // Classify mood from transcription text
  const emotionKey = classifyMoodFromText(transcription || llmReply);

  return { transcription, llmReply, emotionKey };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mood Classifier — Thai keyword-based (mirrors the Python mood.py in example)
// Used for all three modalities to update the UI mood state
// ═══════════════════════════════════════════════════════════════════════════════

const MOOD_CUES: [string, string[]][] = [
  ["stressed", ["เครียด", "กดดัน", "กังวล", "วิตก", "ประหม่า", "หนักมาก", "รับไม่ไหว", "stress"]],
  ["tired",    ["เหนื่อย", "ง่วง", "อ่อนเพลีย", "หมดแรง", "ไม่มีแรง", "เพลีย", "tired"]],
  ["sad",      ["เศร้า", "ร้องไห้", "เสียใจ", "ท้อ", "หมดกำลังใจ", "เหงา", "โดดเดี่ยว", "ผิดหวัง", "sad"]],
  ["positive", ["ดีใจ", "สนุก", "เยี่ยม", "มีความสุข", "ภูมิใจ", "ชอบมาก", "happy", "สุขใจ"]],
  ["calm",     ["สงบ", "ผ่อนคลาย", "สบายใจ", "โล่งใจ", "ปกติดี", "calm"]],
];

export function classifyMoodFromText(text: string): string {
  if (!text) return "neutral";
  const lower = text.toLowerCase();
  for (const [mood, cues] of MOOD_CUES) {
    if (cues.some(c => lower.includes(c))) return mood;
  }
  return "neutral";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unified chat handler — Text LLM with sentiment-aware prompt
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatResult {
  reply: string;
  emotionKey: string;
}

/**
 * Main chat function: sends user text through Text LLM, classifies mood
 */
export async function chat(userMessage: string): Promise<ChatResult> {
  const reply = await callTextLLM(userMessage);
  const emotionKey = classifyMoodFromText(userMessage);
  return { reply, emotionKey };
}
