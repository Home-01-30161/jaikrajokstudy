/**
 * pathummaApi.ts — JaiKraJok ThaiLLM client (v5)
 * =====================================================
 * Uses the NEW ThaiLLM API (OpenAI-compatible):
 *   Model:    pathumma-thaillm-qwen3-8b-think-3.0.0
 *   Endpoint: POST http://thaillm.or.th/api/v1/chat/completions
 *   Auth:     Authorization: Bearer <VITE_THAILLM_API_KEY>
 *
 * VQA + Audio: Still uses Pathumma API (aiforthai.in.th) since ThaiLLM is text-only.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const THAILLM_KEY: string = (import.meta.env.VITE_THAILLM_API_KEY as string) ?? "CkAPIGzjpSP7jgLmbrlD4P8yJ9SuOb4T";
const THAILLM_PROXY  = "/api/thaillm";
const THAILLM_MODEL  = "pathumma-thaillm-qwen3-8b-think-3.0.0";

const PATHUMMA_KEY: string = (import.meta.env.VITE_PATHUMMA_API_KEY as string) ?? "";
const PATHUMMA_PROXY = "/api/pathumma";

export function hasApiKey(): boolean {
  return THAILLM_KEY.trim().length > 0;
}

function thaiLLMHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${THAILLM_KEY}`,
  };
}

function pathummaHeaders(): Record<string, string> {
  return { Apikey: PATHUMMA_KEY, "X-lib": "jaikrajok-web" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip <think>...</think> reasoning blocks the Qwen3-Think model emits */
function stripThink(text: string): string {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const idx = text.toLowerCase().indexOf("<think>");
  if (idx !== -1) text = text.slice(0, idx);
  return text.trim();
}

/** Extract text from Pathumma (VQA/Audio) raw response shapes */
function extractPathummaText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (!raw || typeof raw !== "object") return "";
  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.choices) && r.choices.length > 0) {
    const c = r.choices[0] as Record<string, unknown>;
    const msg = c.message as Record<string, unknown> | undefined;
    if (msg?.content) return String(msg.content).trim();
    if (c.text) return String(c.text).trim();
  }

  for (const k of ["content", "response", "output", "text", "result", "generated_text", "answer"]) {
    if (r[k] && typeof r[k] === "string") return (r[k] as string).trim();
  }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TEXT LLM — ThaiLLM Chat Completions (OpenAI-compatible)
// ═══════════════════════════════════════════════════════════════════════════════

export const JAIKRAJOK_SYSTEM_PROMPT =
  "คุณคือ กระจก (JaiKraJok) ผู้ช่วยสอนเรียนและเพื่อนคู่คิดอัจฉริยะ สร้างโดยทีม JaiKraJok " +
  "ตอบเป็นภาษาไทยอย่างสุภาพ อบอุ่น ชัดเจน ครอบคลุม ละเอียดลึกซึ้งในระดับมืออาชีพ " +
  "กฎสำคัญสำหรับการคำนวณทางคณิตศาสตร์และวิชาการ (Anti-Hallucination & Precise Math Rules): " +
  "1. ห้ามเดาคำตอบ หรือเดาผลลัพธ์เด็ดขาด! ต้องแสดงขั้นตอนการคำนวณทางคณิตศาสตร์ที่ถูกต้องทีละบรรทัด " +
  "2. สำหรับโจทย์เศษเหลือ/ทฤษฎีบทจำนวน/ทฤษฎีเศษเหลือ (Remainder / Modular Arithmetic / LCM / ค.ร.น.): " +
  "   - คำนวณ ค.ร.น. ของตัวหารอย่างแม่นยำ " +
  "   - บวกเศษกลับเข้าไป ตรวจสอบเงื่อนไขช่วง " +
  "   - ตรวจสอบกับตัวเลือก ก. ข. ค. ง. ให้ตรงกับข้อที่คำนวณได้ถูกต้อง 100% " +
  "3. สำหรับโจทย์การโปรแกรม/เขียนโค้ด (C, C++, Python, Java, JS ฯลฯ): " +
  "   - สอน 5 หัวข้อหลักพร้อมกล่องโค้ด ```lang ... ``` แยกแต่ละหัวข้อ " +
  "   - โค้ดต้องถูกต้องตามไวยากรณ์ภาษา 100% " +
  "4. สำหรับโจทย์คณิตศาสตร์/วิทยาศาสตร์ ใช้ LaTeX $...$ และ $$...$$ แสดงสมการแบบละเอียดทุกขั้นตอน " +
  "5. หากผู้ใช้มีความเสี่ยงซึมเศร้ารุนแรง ให้แนะนำสายด่วน 1323 ด้วยความห่วงใย";

export const MATH_SYSTEM_PROMPT =
  "คุณคือครูสอนพิเศษคณิตศาสตร์และวิทยาศาสตร์ผู้เชี่ยวชาญระดับสูง สร้างโดยทีม JaiKraJok " +
  "กฎการตอบ (ห้ามเดาตัวเลข คำนวณจริงทีละขั้น): " +
  "1. ตอบเป็นภาษาไทย อธิบายละเอียด ทุกขั้นตอน ห้ามสุ่มหรือเดาคำตอบเด็ดขาด " +
  "2. สำหรับโจทย์เศษเหลือและการหาร: คำนวณ ค.ร.น. (LCM) ให้แม่นยำ บวกเศษกลับเข้าไป แล้วตรวจสอบเงื่อนไขขอบเขต " +
  "3. หากมีตัวเลือก ก. ข. ค. ง. ให้ตรวจทานคำตอบที่คำนวณได้กับตัวเลือกอย่างระมัดระวัง แล้วระบุข้อที่ถูกต้อง " +
  "4. แสดงสูตรและสมการด้วย LaTeX: inline ใช้ $...$ และ block ใช้ $$...$$ " +
  "5. สรุปคำตอบสุดท้ายในกรอบ $$...$$ และให้กำลังใจผู้เรียนเสมอ";

/** OpenAI-compatible message type */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * TEXT LLM: Call ThaiLLM pathumma-thaillm-qwen3-8b-think-3.0.0
 * Uses proper OpenAI messages[] array format — no need to inject history into prompt strings.
 */
export async function callTextLLM(
  instruction: string,
  systemPrompt: string = JAIKRAJOK_SYSTEM_PROMPT,
  maxTokens: number = 2048,
  temperature: number = 0.4,
  history?: { role: string; text: string }[]
): Promise<string> {
  let effectiveTemperature = temperature;
  let extraInstruction = "";

  // Detect Math / Remainder / Multiple Choice → Force Low Temp (0.05) + CoT
  const isMathOrChoice = /(เศษ|หาร|ผลบวก|ค\.ร\.น\.|ห\.ร\.ม\.|lcm|gcd|mod|ก\.|ข\.|ค\.|ง\.|โจทย์|จำนวนเต็ม|สมการ|\$\d|\d+\s*[\+\-\*\/%]\s*\d+|1\s*<\s*n\s*<\s*\d+)/i.test(instruction);
  if (isMathOrChoice) {
    effectiveTemperature = 0.05;
    extraInstruction = "\n\n[บังคับ: คำนวณด้วยหลักคณิตศาสตร์จริงทีละขั้นตอน ห้ามเดาตัวเลขเด็ดขาด หากเป็นโจทย์เศษเหลือ ให้คำนวณ ค.ร.น. แล้วบวกเศษ แล้วตรวจกับตัวเลือก ก/ข/ค/ง ให้ตรงกับผลคำนวณจริง 100%]";
  }

  // Detect Programming Tutorial → Enforce 5-topic comprehensive lesson
  const isLearningOrTech = /(สอน|syntax|พื้นฐาน|basic|เรียน|เขียน|code|โปรแกรม|คืออะไร|อธิบาย|วิธี|guide|tutorial|overview|c\b|cpp|c\+\+|python|java|javascript|typescript|js|ts|html|css|c#|golang|go|rust|php|sql|ruby|swift|kotlin|dart|flutter)/i.test(instruction);
  if (isLearningOrTech && !isMathOrChoice) {
    extraInstruction = "\n\n[บังคับ: หากเป็นคำขอสอนโปรแกรมมิ่ง ให้เขียนบทเรียนฉบับสมบูรณ์ 5 หัวข้อในคำตอบเดียวเสมอ: 1. โครงสร้างหลัก & Hello World, 2. Variables & Data Types, 3. Input & Output, 4. Conditionals & Loops, 5. Functions โดยมีกล่องโค้ด ```lang...``` และอธิบายทีละหัวข้ออย่างละเอียด]";
  }

  // Build messages array
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  // Add conversation history as proper assistant/user messages
  if (history && history.length > 0) {
    for (const m of history.slice(-10)) { // Keep last 10 messages
      messages.push({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      });
    }
  }

  // Add current user message (with any extra instruction appended)
  messages.push({ role: "user", content: instruction + extraInstruction });

  const body = JSON.stringify({
    model: THAILLM_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: effectiveTemperature,
  });

  const res = await fetch(`${THAILLM_PROXY}/api/v1/chat/completions`, {
    method: "POST",
    headers: thaiLLMHeaders(),
    body,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[ThaiLLM] HTTP error", res.status, errBody.slice(0, 300));
    throw new Error(`ThaiLLM ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
  console.debug("[ThaiLLM] raw response:", raw);

  // OpenAI-compatible extraction
  const choices = raw.choices as { message?: { content?: string } }[] | undefined;
  const content = choices?.[0]?.message?.content ?? "";

  const text = stripThink(content);
  if (!text) throw new Error("ThaiLLM returned empty response");
  return text;
}

/**
 * SENTIMENT ANALYSIS via ThaiLLM
 */
export async function analyzeSentiment(text: string): Promise<string> {
  try {
    const result = await callTextLLM(
      `วิเคราะห์อารมณ์หลักจากข้อความต่อไปนี้: "${text}"\nตอบด้วยคำเดียวเท่านั้น (ห้ามมีคำอื่น): stressed, sad, tired, positive, calm, หรือ neutral`,
      JAIKRAJOK_SYSTEM_PROMPT,
      16,
      0.1
    );
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
// 2. VISION LLM — Pathumma VQA (still uses aiforthai API — ThaiLLM is text-only)
// ═══════════════════════════════════════════════════════════════════════════════

export interface VisionResult {
  answer: string;
  llmReply: string;
}

export async function callVisionLLM(
  imageBlob: Blob,
  query: string,
  filename = "image.jpg"
): Promise<string> {
  const form = new FormData();
  form.append("query", query);
  form.append("file", imageBlob, filename);

  const res = await fetch(`${PATHUMMA_PROXY}/vqa/inference/`, {
    method: "POST",
    headers: pathummaHeaders(),
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[VisionLLM] HTTP error", res.status, errBody.slice(0, 300));
    throw new Error(`Vision LLM ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const raw = await res.json().catch(() => ({}));
  console.debug("[VisionLLM] raw response:", raw);
  const text = stripThink(extractPathummaText(raw));
  if (!text) throw new Error("Vision LLM returned empty response");
  return text;
}

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

  let llmReply: string;
  try {
    llmReply = await callTextLLM(
      `จากการวิเคราะห์ภาพใบหน้า: "${answer}" ตอบสนองด้วยความเห็นอกเห็นใจ สอบถามความรู้สึกของผู้ใช้ ไม่เกิน 2-3 ประโยค`
    );
  } catch {
    llmReply = answer || "กระจกเห็นรูปคุณแล้วค่ะ วันนี้รู้สึกเป็นยังไงบ้าง?";
  }

  return { answer, llmReply };
}

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

  let llmReply: string;
  try {
    llmReply = await callTextLLM(
      `โจทย์จากภาพ: "${answer}"\n\nอธิบายวิธีแก้โจทย์ทีละขั้นตอน ถ้าเป็นแคลคูลัสหรือคณิตศาสตร์ให้แสดงสูตรและการคำนวณชัดเจน หากมีตัวเลือก ก. ข. ค. ง. ให้คำนวณจริงทีละขั้นตอน ห้ามเดาเด็ดขาด`,
      MATH_SYSTEM_PROMPT,
      1024,
      0.05
    );
  } catch {
    llmReply = answer || "กระจกเห็นการบ้านแล้วค่ะ ติดขั้นตอนไหนบอกกระจกได้เลยนะ";
  }

  return { answer, llmReply };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AUDIO LLM — Pathumma AudioQA (ThaiLLM is text-only)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AudioResult {
  transcription: string;
  llmReply: string;
  emotionKey: string;
}

export async function callAudioLLM(audioBlob: Blob, instruction: string): Promise<string> {
  const form = new FormData();

  const mimeToExt: Record<string, string> = {
    "audio/wav": "wav", "audio/wave": "wav", "audio/x-wav": "wav",
    "audio/mp3": "mp3", "audio/mpeg": "mp3", "audio/ogg": "ogg",
    "audio/mp4": "mp4", "audio/webm": "webm", "video/webm": "webm",
  };
  const ext = mimeToExt[audioBlob.type] ?? "webm";
  form.append("file", audioBlob, `recording.${ext}`);
  form.append("instruction", instruction);

  const res = await fetch(`${PATHUMMA_PROXY}/audioqa/inference/`, {
    method: "POST",
    headers: pathummaHeaders(),
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[AudioLLM] HTTP error", res.status, errBody.slice(0, 300));
    throw new Error(`Audio LLM ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const raw = await res.json().catch(() => ({}));
  console.debug("[AudioLLM] raw response:", raw);
  const text = stripThink(extractPathummaText(raw));
  if (!text) throw new Error("Audio LLM returned empty response");
  return text;
}

export async function analyzeAudio(audioBlob: Blob): Promise<AudioResult> {
  const audioInstruction =
    "ฟังเสียงนี้และแปลงเป็นข้อความภาษาไทยให้ครบถ้วน " +
    "ตอบในรูปแบบ: [ข้อความ: ...ข้อความที่ได้ยิน...] แล้วตามด้วยสรุปสั้น ๆ ว่าผู้พูดกำลังพูดถึงอะไร";

  let audioResponse = "";
  let transcription = "";

  try {
    audioResponse = await callAudioLLM(audioBlob, audioInstruction);
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

  const textForAnalysis = transcription || audioResponse;
  const emotionKey = await analyzeSentiment(textForAnalysis);

  let llmReply: string;
  try {
    llmReply = await callTextLLM(
      `ผู้ใช้พูดว่า: "${textForAnalysis}"\nตอบสนองด้วยความเข้าใจและเห็นอกเห็นใจ ถ้ามีคำถามช่วยตอบด้วย ตอบไม่เกิน 3 ประโยค`
    );
  } catch {
    llmReply = audioResponse.replace(/\[ข้อความ[:\s]+[^\]]+\]/i, "").trim()
      || "กระจกได้ยินคุณแล้วค่ะ วันนี้รู้สึกเป็นยังไงบ้าง?";
  }

  return { transcription, llmReply, emotionKey };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mood Classifier — Thai keyword-based (local fallback)
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
// Unified chat handler — ThaiLLM + parallel sentiment analysis
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatResult {
  reply: string;
  emotionKey: string;
}

export async function chat(
  userMessage: string,
  history?: { role: string; text: string }[]
): Promise<ChatResult> {
  const [reply, emotionKey] = await Promise.all([
    callTextLLM(userMessage, JAIKRAJOK_SYSTEM_PROMPT, 2048, 0.4, history),
    analyzeSentiment(userMessage).catch(() => classifyMoodFromText(userMessage)),
  ]);
  return { reply, emotionKey };
}
