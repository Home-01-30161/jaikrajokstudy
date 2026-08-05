/**
 * pathummaApi.ts — JaiKraJok Pathumma LLM client (v4)
 * =====================================================
 * OFFICIAL Pathumma LLM endpoints from the aift Python library source:
 *   textqa.py  → POST https://api.aiforthai.in.th/textqa/completion
 *   vqa.py     → POST https://api.aiforthai.in.th/vqa/inference/
 *   audioqa.py → POST https://api.aiforthai.in.th/audioqa/inference/
 *
 * All calls route through the Vite proxy /api/pathumma → https://api.aiforthai.in.th
 *
 * IMPORTANT content-type per endpoint:
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

  // Pathumma direct fields — try 'content' first
  for (const k of ["content", "response", "output", "text", "result", "generated_text", "answer"]) {
    if (r[k] && typeof r[k] === "string") return (r[k] as string).trim();
  }

  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TEXT LLM — POST /textqa/completion
// ═══════════════════════════════════════════════════════════════════════════════

export const JAIKRAJOK_SYSTEM_PROMPT =
  "คุณคือ กระจก (JaiKraJok) ผู้ช่วยสอนเรียนและเพื่อนคู่คิดอัจฉริยะ สร้างโดยทีม JaiKraJok " +
  "ตอบเป็นภาษาไทยอย่างสุภาพ อบอุ่น ชัดเจน ครอบคลุม ละเอียดลึกซึ้งในระดับมืออาชีพ (สไตล์ Gemini / Claude) " +
  "กฎสำคัญสำหรับการคำนวณทางคณิตศาสตร์และวิชาการ (Anti-Hallucination & Precise Math Rules): " +
  "1. ห้ามเดาคำตอบ หรือเดาผลลัพธ์การทำงานของโค้ด/การรันโปรแกรมเด็ดขาด! ต้องแสดงขั้นตอนการคำนวณทางคณิตศาสตร์ที่ถูกต้องทีละบรรทัด " +
  "2. สำหรับโจทย์เศษเหลือ/ทฤษฎีบทจำนวน/ทฤษฎีเศษเหลือ (Remainder / Modular Arithmetic / LCM / ค.ร.น.): " +
  "   - เขียนนิยามสมมูล $n \\equiv r \\pmod m \\implies n - r$ เป็นพหุคูณของ ค.ร.น. " +
  "   - คำนวณ ค.ร.น. ของตัวหารอย่างแม่นยำ (เช่น ค.ร.น. ของ 7, 10, 13 คือ $7 \\times 10 \\times 13 = 910$) " +
  "   - คำนวณค่า $n = 910 + 1 = 911$ แล้วตรวจสอบเงื่อนไขช่วง (เช่น $1 < n < 1000$) " +
  "   - ตรวจสอบกับตัวเลือก ก. ข. ค. ง. และสรุปคำตอบให้ตรงกับข้อที่คำนวณได้ถูกต้อง 100% " +
  "3. สำหรับโจทย์การโปรแกรม/เขียนโค้ด (C, C++, Python, Java, JS, TS, Go, Rust ฯลฯ): อธิบาย 5 หัวข้อหลักพร้อมกล่องโค้ด ```lang ... ``` " +
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

/**
 * TEXT LLM: Send a text prompt → get a Thai language reply
 * Uses URLSearchParams (application/x-www-form-urlencoded)
 */
export async function callTextLLM(
  instruction: string,
  systemPrompt: string = JAIKRAJOK_SYSTEM_PROMPT,
  maxTokens: number = 512,
  temperature: number = 0.4,
  history?: { role: string; text: string }[]
): Promise<string> {
  let fullInstruction = instruction;
  let effectiveTemperature = temperature;

  // Detect Math / Remainder / Multiple Choice queries → Force Low Temp (0.05) & Chain-of-Thought
  const isMathOrChoice = /(เศษ|หาร|ผลบวก|ค\.ร\.น\.|ห\.ร\.ม\.|lcm|gcd|mod|ก\.|ข\.|ค\.|ง\.|โจทย์|จำนวนเต็ม|สมการ|\$\d|\d+\s*[\+\-\*\/%]\s*\d+|1\s*<\s*n\s*<\s*\d+)/i.test(instruction);
  if (isMathOrChoice) {
    effectiveTemperature = 0.05; // Force deterministic precision for math
    fullInstruction += "\n\n[ข้อบังคับสำหรับการคำนวณคณิตศาสตร์: คำนวณด้วยหลักคณิตศาสตร์จริงทีละขั้นตอน ห้ามเดาผลลัพธ์หรือเดาตัวเลขเด็ดขาด! หากเป็นโจทย์เศษเหลือ (Remainder) ให้คำนวณ ค.ร.น. แล้วบวกเศษ จากนั้นตรวจกับตัวเลือก ก, ข, ค, ง ให้ตรงกับผลคำนวณจริง 100%]";
  }

  // Enhance tutorial & learning requests to GUARANTEE comprehensive coverage in ALL chats
  const isLearningOrTech = /(สอน|syntax|พื้นฐาน|basic|เรียน|เขียน|code|โปรแกรม|คืออะไร|อธิบาย|วิธี|guide|tutorial|overview|c\b|cpp|c\+\+|python|java|javascript|typescript|js|ts|html|css|c#|golang|go|rust|php|sql|ruby|swift|kotlin|dart|flutter)/i.test(instruction);
  
  if (isLearningOrTech && !isMathOrChoice) {
    fullInstruction += "\n\n[ข้อบังคับสำคัญสำหรับการตอบ: หากเป็นคำขอสอนโปรแกรมมิ่งหรือเรื่องเทคโนโลยี ให้เขียนบทเรียนฉบับสมบูรณ์ที่ครอบคลุมครบถ้วนทั้ง 5 หัวข้อหลักในคำตอบเดียวเสมอ: 1. โครงสร้างหลัก & Hello World, 2. ตัวแปรและชนิดข้อมูล (Variables & Data Types), 3. การรับส่งข้อมูล (Input & Output), 4. เงื่อนไขทางเลือกและการวนลูป (Conditionals & Loops), 5. ฟังก์ชัน (Functions) โดยต้องมีกล่องโค้ด ```...``` ตัวอย่างและอธิบายทีละหัวข้ออย่างละเอียดสมบูรณ์แบบ]";
  }

  if (history && history.length > 0) {
    const historyText = history
      .slice(-6) // Keep last 6 messages for context to avoid token overflow
      .map((m) => `${m.role === "user" ? "ผู้ใช้" : "JaiKraJok"}: ${m.text}`)
      .join("\n\n");
    fullInstruction = `ประวัติการสนทนา:\n${historyText}\n\nข้อความปัจจุบันจากผู้ใช้:\n${fullInstruction}`;
  }

  const body = new URLSearchParams({
    instruction: fullInstruction,
    system_prompt: systemPrompt,
    max_new_tokens: String(maxTokens),
    temperature: String(effectiveTemperature),
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
// ═══════════════════════════════════════════════════════════════════════════════

export interface VisionResult {
  answer: string;    // Vision model's direct description
  llmReply: string;  // Empathetic/instructional follow-up from Text LLM
}

export async function callVisionLLM(
  imageBlob: Blob,
  query: string,
  filename = "image.jpg"
): Promise<string> {
  const form = new FormData();
  form.append("query", query);
  form.append("file", imageBlob, filename);

  const res = await fetch(`${PROXY}/vqa/inference/`, {
    method: "POST",
    headers: authHeaders(),
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
    `อธิบายวิธีแก้โจทย์ทีละขั้นตอน ถ้าเป็นแคลคูลัสหรือคณิตศาสตร์ให้แสดงสูตรและการคำนวณชัดเจน ` +
    `หากมีตัวเลือก ก. ข. ค. ง. ให้คำนวณจริงทีละขั้นตอน ห้ามเดาเด็ดขาด`;

  let llmReply: string;
  try {
    llmReply = await callTextLLM(instruction, MATH_SYSTEM_PROMPT, 1024, 0.05);
  } catch {
    llmReply = answer || "กระจกเห็นการบ้านแล้วค่ะ ติดขั้นตอนไหนบอกกระจกได้เลยนะ";
  }

  return { answer, llmReply };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AUDIO LLM — POST /audioqa/inference/
// ═══════════════════════════════════════════════════════════════════════════════

export interface AudioResult {
  transcription: string;  // Speech-to-text result
  llmReply: string;       // Empathetic/supportive reply
  emotionKey: string;     // Mood key for UI
}

export async function callAudioLLM(audioBlob: Blob, instruction: string): Promise<string> {
  const form = new FormData();

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
  form.append("instruction", instruction);

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
// Unified chat handler — Text LLM + parallel sentiment analysis
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatResult {
  reply: string;
  emotionKey: string;
}

export async function chat(
  userMessage: string,
  history?: { role: string; text: string }[]
): Promise<ChatResult> {
  // If math query, use lower temp automatically in callTextLLM
  const [reply, emotionKey] = await Promise.all([
    callTextLLM(userMessage, JAIKRAJOK_SYSTEM_PROMPT, 2048, 0.4, history),
    analyzeSentiment(userMessage).catch(() => classifyMoodFromText(userMessage)),
  ]);
  return { reply, emotionKey };
}
