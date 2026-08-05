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
const GEMINI_KEY: string = (import.meta.env.VITE_GEMINI_API_KEY as string) ?? "";
const GEMINI_PROXY = "/api/gemini";
const TYPHOON_ASR_KEY: string = (import.meta.env.VITE_TYPHOON_ASR_KEY as string) ?? "";
const TYPHOON_PROXY = "/api/typhoon";
const TAVILY_KEY: string = (import.meta.env.VITE_TAVILY_API_KEY as string) ?? "";
const TAVILY_PROXY = "/api/tavily";

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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = (reader.result as string) || "";
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert any browser audio blob (webm, ogg, etc.) to PCM WAV
 * using the Web Audio API. Needed because Chrome records in audio/webm
 * which Typhoon ASR rejects (415 Unsupported Media Type).
 */
async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit PCM

  const dataSize = numSamples * numChannels * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF header
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  // fmt chunk
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);          // bits per sample
  // data chunk
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  // Write interleaved PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = audioBuffer.getChannelData(ch)[i];
      const clamped = Math.max(-1, Math.min(1, s));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

/** Strip <think>...</think> reasoning blocks, or leaked English reasoning, from Qwen3-Think model */
function stripThink(text: string): string {
  if (!text) return "";

  // 1. Proper <think>...</think> tags — extract the final answer that follows </think>
  if (text.includes("</think>")) {
    const after = text.split("</think>").slice(1).join("</think>").trim();
    if (after) return after;
  }

  // 2. Unclosed <think> at start — find a Thai answer section after
  if (text.trimStart().startsWith("<think>")) {
    // Look for a section that starts with Thai characters or markdown headers after a long English block
    const thaiSection = text.replace(/^<think>[\s\S]*?(?=[\u0E00-\u0E7F]|#{1,3}\s|```|\*\*[^\n]+\*\*)/m, "").trim();
    if (thaiSection && thaiSection.length > 30) return thaiSection;
    // fallback: strip tag only
    return text.replace(/<think>/gi, "").trim();
  }

  // 3. Leaked / untagged reasoning — detect long English "thinking" preamble patterns
  //    These patterns appear when the model outputs its chain-of-thought without tags
  const leakedReasoningRE = /^(Okay[,.]|Alright[,.]|Let me|The user|Wait[,.]|First[,.]|So[,.]|I need|I'll|I will|I should|Hmm[,.]|Let's think|The question|Looking at|Looking for|To solve|To answer)/i;
  if (leakedReasoningRE.test(text.trimStart())) {
    // Try to find the real Thai/final answer by looking for a substantial Thai block or markdown header
    const lines = text.split("\n");
    let thaiStartIndex = -1;
    let consecutiveThaiLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const hasThaiChars = /[\u0E00-\u0E7F]/.test(lines[i]);
      const isMdHeader = /^#{1,3}\s/.test(lines[i].trim());
      const isCodeBlock = lines[i].trim().startsWith("```");

      if (hasThaiChars || isMdHeader || isCodeBlock) {
        consecutiveThaiLines++;
        if (thaiStartIndex === -1) thaiStartIndex = i;
        if (consecutiveThaiLines >= 2 && thaiStartIndex !== -1) {
          // Found a real Thai answer block — return from here onward
          return lines.slice(thaiStartIndex).join("\n").trim();
        }
      } else {
        // Non-Thai line — reset only if it's not a blank line between Thai content
        if (lines[i].trim().length > 0) {
          consecutiveThaiLines = 0;
          if (thaiStartIndex !== -1 && i - thaiStartIndex > 5) {
            // already found a Thai block; stop searching
            break;
          }
          thaiStartIndex = -1;
        }
      }
    }
    // Last resort: return from where the first Thai character appears
    const thaiMatch = text.match(/[\u0E00-\u0E7F]/);
    if (thaiMatch && thaiMatch.index !== undefined) {
      const lineStart = text.lastIndexOf("\n", thaiMatch.index) + 1;
      const trimmed = text.slice(lineStart).trim();
      if (trimmed.length > 20) return trimmed;
    }
  }

  return text.replace(/<think>/gi, "").trim();
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
  "📐 กฎการจัดรูปแบบคำตอบ (Output Formatting Rules) — **บังคับปฏิบัติตลอด**: " +
  "1. **LaTeX Math**: ใช้ `$...$` สำหรับ inline math และ `$$...$$` สำหรับ display math ทุกสูตรสมการ (หากใช้ `\\begin{aligned}` ให้หุ้มด้วย `$$...$$` เสมอ) " +
  "2. **Code Blocks**: ใช้ ```language\ncode\n``` พร้อมระบุภาษา (python, cpp, javascript, typescript, java, go, rust, sql, bash, json, yaml, markdown, html, css) " +
  "3. **Tables**: สร้างตาราง markdown เมื่อเปรียบเทียบข้อมูล หรือแสดงขั้นตอนคำนวณ `| Header1 | Header2 |\n|---|---|\n| A | B |` " +
  "4. **Task Lists**: ใช้ `- [ ]` และ `- [x]` สำหรับขั้นตอนหรือรายการตรวจสอบ " +
  "5. **Blockquotes**: ใช้ `> quote` สำหรับข้อความสำคัญ คำพูด หรือคำแนะนำ " +
  "6. **Headers**: ใช้ `##` `###` จัดโครงสร้างคำตอบเป็นหัวข้อย่อย " +
  "7. **Bold/Italic**: ใช้ `**bold**` และ `*italic*` เน้นจุดสำคัญ " +
  "8. **Links**: ใช้ `[text](url)` สำหรับอ้างอิงแหล่งข้อมูล " +
  "9. **Horizontal Rules**: ใช้ `---` แยกส่วนที่เกี่ยวข้อง " +
  "10. **Mermaid**: ใช้ ```mermaid\n...``` สำหรับแผนภาพ กราฟ หรือลำดับขั้นตอน " +
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
  "📐 กฎการจัดรูปแบบคำตอบ (Output Formatting Rules) — **บังคับปฏิบัติตลอด**: " +
  "1. **LaTeX Math**: ใช้ `$...$` สำหรับ inline math และ `$$...$$` สำหรับ display math **ทุกสูตรสมการ** " +
  "2. **Code Blocks**: ใช้ ```language\ncode\n``` พร้อมระบุภาษา " +
  "3. **Tables**: สร้างตาราง markdown แสดงขั้นตอนคำนวณ เปรียบเทียบตัวเลือก หรือสรุปผล " +
  "4. **Task Lists**: ใช้ `- [ ]` สำหรับขั้นตอนการแก้โจทย์ `- [x]` สำหรับขั้นตอนที่ทำเสร็จ " +
  "5. **Blockquotes**: ใช้ `> **คำแนะนำ**` เน้นเคล็ดลับ สูตรสำคัญ หรือข้อระวัง " +
  "6. **Headers**: ใช้ `##` `###` จัดโครงสร้าง: ## วิธีแก้, ## การคำนวณ, ## สรุปคำตอบ " +
  "7. **Bold**: ใช้ `**คำตอบสุดท้าย**` เน้นผลลัพธ์ " +
  "8. **Horizontal Rules**: ใช้ `---` แยกแต่ละขั้นตอนหลัก " +
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

  // Detect Math / Calculation / Explicit Math Homework Prompt
  // (Excludes simple range hyphens like "2-3 ประโยค" from false-triggering math mode)
  const isMathOrChoice = /(โจทย์คณิต|คำนวณ|สมการ|ค\.ร\.น\.|ห\.ร\.ม\.|เศษเหลือ|ข้อสอบ|lcm|gcd|\bmod\b|\$\d|\d+\s*[\+\*\/%]\s*\d+|\d+\s*=\s*\d+)/i.test(instruction);
  if (isMathOrChoice) {
    effectiveTemperature = 0.05;
    extraInstruction = "\n\n[หากมีโจทย์คณิตศาสตร์ในคำขอ: แสดงขั้นตอนการคำนวณอย่างแม่นยำทีละบรรทัด ห้ามเดาตัวเลข " +
      "จัดรูปแบบด้วย $$...$$ สำหรับทุกสูตรสมการ และ **Bold** เน้นคำตอบสุดท้าย]";
  }

  // Detect Programming Tutorial → Enforce 5-topic comprehensive lesson
  const isLearningOrTech = /(สอน|syntax|พื้นฐาน|basic|เรียน|เขียน|code|โปรแกรม|คืออะไร|อธิบาย|วิธี|guide|tutorial|overview|c\b|cpp|c\+\+|python|java|javascript|typescript|js|ts|html|css|c#|golang|go|rust|php|sql|ruby|swift|kotlin|dart|flutter)/i.test(instruction);
  if (isLearningOrTech && !isMathOrChoice) {
    extraInstruction = "\n\n[บังคับ: หากเป็นคำขอสอนโปรแกรมมิ่ง ให้เขียนบทเรียนฉบับสมบูรณ์ 5 หัวข้อในคำตอบเดียวเสมอ: " +
      "1. โครงสร้างหลัก & Hello World, 2. Variables & Data Types, 3. Input & Output, 4. Conditionals & Loops, 5. Functions " +
      "โดยมีกล่องโค้ด ```lang...``` และอธิบายทีละหัวข้ออย่างละเอียด " +
      "**จัดรูปแบบบังคับ**: ใช้ ## สำหรับหัวข้อหลัก ### สำหรับหัวข้อย่อย | ตาราง markdown สำหรับสรุป syntax | " +
      "Blockquote `> **เคล็ดลับ**` สำหรับ best practices | Task list `- [ ]` สำหรับแบบฝึกหัด | " +
      "Horizontal rule `---` แยกแต่ละหัวข้อ | Mermaid diagram ถ้ามี flow control]";
  }

  // General formatting boost for all responses — encourage rich markdown
  if (!extraInstruction) {
    extraInstruction = "\n\n[จัดรูปแบบ: ใช้ markdown ให้ครบถ้วน — **Bold** เน้นจุดสำคัญ | `code` inline | ```code blocks``` | " +
      "$$LaTeX$$ สูตร | ตาราง | `- [ ]` task list | `> quote` | `---` แยกส่วน | Mermaid ถ้าเหมาะสม]";
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

// ═══════════════════════════════════════════════════════════════════════════════
// 1b. WEB SEARCH — Tavily Search API
// ═══════════════════════════════════════════════════════════════════════════════

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilyResult[];
  answer?: string;
}

/**
 * Search the web using Tavily Search API.
 * Returns up to `maxResults` results with titles, URLs and content snippets.
 */
export async function searchWeb(
  query: string,
  maxResults = 5,
  searchDepth: "basic" | "advanced" = "basic"
): Promise<TavilySearchResponse> {
  if (!TAVILY_KEY.trim()) throw new Error("Tavily API key not configured");

  const res = await fetch(`${TAVILY_PROXY}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TAVILY_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: searchDepth,
      include_answer: true,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[Tavily] HTTP error", res.status, errBody.slice(0, 300));
    throw new Error(`Tavily ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const raw = await res.json() as TavilySearchResponse;
  console.debug("[Tavily] Search results for:", query, "| count:", raw.results?.length);
  return raw;
}

/**
 * Keywords/patterns that indicate the user needs current web information.
 * Questions about live data, news, prices, events, people, etc.
 */
const NEEDS_SEARCH_RE = new RegExp(
  [
    // Explicit search intent / info queries
    "ค้นหา|search|หาข้อมูล|ข้อมูล|ข้อมูลล่าสุด|latest|recent|ประวัติ|ใครคือ|คือใคร|คืออะไร|รู้จัก",
    // News / current events
    "ข่าว|news|วันนี้|today|ล่าสุด|ปัจจุบัน|current|now|ตอนนี้|เมื่อกี้",
    // Prices / market
    "ราคา|price|หุ้น|stock|บิทคอยน์|bitcoin|crypto|เงิน|dollar|baht|บาท",
    // Weather
    "อากาศ|weather|ฝน|rain|อุณหภูมิ|temperature|forecast|พยากรณ์",
    // People / places / events
    "นักการเมือง|politician|นายก|prime minister|รัฐบาล|government|ดร\\.|ศาสตราจารย์|อาจารย์|ผศ\\.|รศ\\.",
    "ผู้ชนะ|winner|แชมป์|champion|รางวัล|award",
    "กีฬา|sport|ฟุตบอล|football|บาสเกตบอล|basketball",
    "ภาพยนตร์|movie|ซีรีส์|series|เพลง|song",
    // Science / tech facts needing current info
    "ค้นพบ|discovery|งานวิจัย|research|ใหม่|new|เปิดตัว|launch|release",
  ].join("|"),
  "i"
);

export const SEARCH_SYSTEM_PROMPT =
  "คุณคือ กระจก (JaiKraJok) ผู้ช่วยตอบคำถามจากผลการค้นหาเว็บจริงอย่างแม่นยำ 100% " +
  "📐 กฎเหล็กป้องกันการหลอนและอ้างอิงผิดคน (Strict Grounding Rules): " +
  "1. ตอบคำถามเฉพาะข้อมูลบุคคลหรือหัวข้อที่ผู้ใช้ถาม โดยยึดตามข้อความจากผลการค้นหาจริงที่จัดสรรให้เท่านั้น " +
  "2. **ห้ามเอ่ยชื่อบุคคลอื่นที่ไม่ตรงกับคำถามเด็ดขาด** (เช่น ห้ามแต่งชื่อ ดร.ศราวุธ แรมจันทร์, ดร.ศราวุฒิ อารีย์ หรือคนอื่นที่ไม่มีในผลการค้นหามาปะปน) " +
  "3. **ห้ามแต่งประวัติการศึกษา ปริญญา หรือตำแหน่งงาน** ที่ไม่ได้ระบุไว้ในผลการค้นหาเด็ดขาด " +
  "4. **ห้ามสร้างส่วน 'ข้อควรระวัง' หรือสมมุติการสับสนชื่อขึ้นมาเอง** หากไม่มีระบุไว้ในผลการค้นหาจริง " +
  "5. อ้างอิงส่วนที่นำมาตอบด้วยเลข [1], [2], ... ให้ตรงกับแหล่งข้อมูลจริง " +
  "6. หากข้อมูลใดไม่มีระบุในผลการค้นหา ให้ระบุเพียงว่า 'ไม่มีระบุในผลการค้นหาที่พบ'";

/**
 * Smart wrapper around callTextLLM:
 * - Detects if the query needs web search (using NEEDS_SEARCH_RE)
 * - If yes: fetches Tavily results (with titles, URLs, snippets), injects them into prompt
 * - Appends verified clickable Markdown links [Title](URL) for every source used.
 */
export async function callTextLLMWithSearch(
  instruction: string,
  systemPrompt: string = JAIKRAJOK_SYSTEM_PROMPT,
  maxTokens: number = 3072,
  temperature: number = 0.3,
  history?: { role: string; text: string }[]
): Promise<{ reply: string; searchUsed: boolean; sources: { title: string; url: string }[] }> {
  const needsSearch = TAVILY_KEY.trim().length > 0 && NEEDS_SEARCH_RE.test(instruction);

  if (!needsSearch) {
    const reply = await callTextLLM(instruction, systemPrompt, maxTokens, temperature, history);
    return { reply, searchUsed: false, sources: [] };
  }

  // Perform web search with Tavily
  let searchCtx = "";
  let sources: { title: string; url: string }[] = [];
  try {
    const data = await searchWeb(instruction, 5, "advanced");
    sources = (data.results || []).map(r => ({ title: r.title || "เว็บอ้างอิง", url: r.url }));

    // Build context block for the prompt with explicit URLs
    const snippets = data.results
      .map((r, i) => `[${i + 1}] **ชื่อเว็บ:** [${r.title}](${r.url})\n**URL:** ${r.url}\n**เนื้อหา:** ${r.content.slice(0, 700)}`)
      .join("\n\n");

    searchCtx =
      `\n\n---\n**ผลการค้นหาจริงจากเว็บ (Tavily Web Search Results):**\n${snippets}\n` +
      (data.answer ? `\n**สรุปภาพรวมจากระบบค้นหา:** ${data.answer}\n` : "") +
      `---\n\n**คำสั่งบังคับ**: สรุปข้อมูลตอบคำถามผู้ใช้โดยใช้เฉพาะข้อมูลใน 5 ผลการค้นหาด้านบนเท่านั้น ห้ามเอ่ยถึงบุคคลอื่นที่ไม่ปรากฏในผลการค้นหา`;
  } catch (err) {
    console.warn("[Tavily] Search failed, answering without search context:", err);
  }

  // Use SEARCH_SYSTEM_PROMPT and ultra-low temperature (0.01) when web search is active
  const rawReply = await callTextLLM(
    instruction + searchCtx,
    SEARCH_SYSTEM_PROMPT,
    maxTokens,
    0.01,
    history
  );

  let reply = rawReply;

  // Guarantee clean verified Markdown source links appended at the bottom
  if (sources.length > 0) {
    // Remove any placeholder/generic "แหล่งอ้างอิง" text generated by LLM if it lacks real URLs
    if (reply.includes("แหล่งอ้างอิง")) {
      reply = reply.replace(/(###?\s*แหล่งอ้างอิง[\s\S]*$)/i, "").trim();
    }

    const sourcesBlock =
      `\n\n---\n### 🌐 แหล่งอ้างอิงข้อมูลจริงจากเว็บ (Verified Sources)\n` +
      sources.map((s, idx) => `[${idx + 1}] [${s.title}](${s.url})`).join("\n");

    reply += sourcesBlock;
  }

  return { reply, searchUsed: sources.length > 0, sources };
}

/**
 * SENTIMENT ANALYSIS via ThaiLLM / Tag Parsing / Regex
 */
export async function analyzeSentiment(text: string): Promise<string> {
  if (!text) return "neutral";

  // 1. Direct tag check from Vision LLM [อารมณ์: ...]
  const tagMatch = text.match(/\[อารมณ์[:\s]+([^\]]+)\]/i);
  if (tagMatch) {
    const tag = tagMatch[1].trim().toLowerCase();
    if (tag.includes("เครียด") || tag.includes("ตึง") || tag.includes("กังวล")) return "stressed";
    if (tag.includes("เศร้า") || tag.includes("ท้อ") || tag.includes("เสียใจ")) return "sad";
    if (tag.includes("เหนื่อย") || tag.includes("เพลีย") || tag.includes("ล้า")) return "tired";
    if (tag.includes("สดใส") || tag.includes("ยิ้ม") || tag.includes("สุข") || tag.includes("ดีใจ")) return "positive";
    if (tag.includes("สงบ") || tag.includes("ผ่อนคลาย") || tag.includes("สบายใจ")) return "calm";
  }

  const SENTIMENT_SYSTEM =
    "You are a strict emotion classifier. Given text in Thai or English, classify the overall emotion into EXACTLY ONE word from this list: stressed, sad, tired, positive, calm, neutral. Output ONLY that single word.";

  try {
    const result = await callTextLLM(
      `Classify overall emotion: "${text.slice(0, 300)}"`,
      SENTIMENT_SYSTEM,
      16,
      0.01
    );
    const lower = result.toLowerCase().trim();
    for (const key of ["stressed", "sad", "tired", "positive", "calm", "neutral"]) {
      if (lower.includes(key)) return key;
    }
  } catch {
    // fall through to regex classifier
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
  // If Gemini API key is configured, use Gemini Flash Vision for multimodal understanding
  if (GEMINI_KEY.trim().length > 0) {
    try {
      const base64Data = await blobToBase64(imageBlob);
      const mimeType = imageBlob.type || "image/jpeg";

      const payload = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
              {
                text: query,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.1,
        },
      };

      const res = await fetch(
        `${GEMINI_PROXY}/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const candidates = raw.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined;
        const text = candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          console.debug("[Gemini Vision] Response received:", text.slice(0, 100));
          return text.trim();
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.warn("[Gemini Vision] HTTP Error:", res.status, errText.slice(0, 200));
      }
    } catch (e) {
      console.warn("[Gemini Vision] Error, falling back to Pathumma VQA:", e);
    }
  }

  // Fallback: Pathumma VQA
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

export const SELFIE_SYSTEM_PROMPT =
  "คุณคือ กระจก (JaiKraJok) ผู้ช่วยตอบสนองอารมณ์จากใบหน้าอย่างอบอุ่นและเห็นอกเห็นใจ " +
  "ตอบเป็นข้อความสั้น ๆ 2-3 ประโยคอย่างเป็นธรรมชาติ สุภาพ และน่าฟัง " +
  "❌ ห้ามใส่ [Task List], ห้ามใส่รายการข้อ 1. 2. 3. ที่เป็นคำสั่งภายใน, ห้ามใส่ไดอะแกรม Mermaid หรือโค้ดใด ๆ เด็ดขาด " +
  "ตอบเฉพาะข้อความทักทาย ให้กำลังใจ และสอบถามความรู้สึกอย่างจริงใจเท่านั้น";

export async function analyzeSelfie(imageBlob: Blob): Promise<VisionResult & { emotionKey?: string }> {
  const visionQuery =
    "ดูใบหน้าของคนในภาพนี้แล้วบรรยายอารมณ์และความรู้สึกที่สังเกตเห็นเป็นภาษาไทย " +
    "สังเกตจากแววตา รอยยิ้ม สีหน้า และท่าทาง ตอบสั้น ๆ 1-2 ประโยค " +
    "แล้วลงท้ายด้วย: [อารมณ์: <คำเดียว เช่น ยิ้มแย้ม / สดใส / เศร้า / เครียด / เหนื่อย / สงบ>]";

  let answer: string;
  try {
    answer = await callVisionLLM(imageBlob, visionQuery);
  } catch (e) {
    console.warn("Vision LLM selfie failed:", e);
    answer = "ไม่สามารถวิเคราะห์ภาพใบหน้าได้ในขณะนี้";
  }

  // Derive emotionKey: use LLM sentiment first, fall back to keyword classifier
  let emotionKey = "neutral";
  try {
    emotionKey = await analyzeSentiment(answer);
  } catch {
    emotionKey = classifyMoodFromText(answer);
  }

  let llmReply: string;
  try {
    const rawReply = await callTextLLM(
      `จากการวิเคราะห์ภาพใบหน้า: "${answer}" ตอบสนองด้วยความเห็นอกเห็นใจ สอบถามความรู้สึกของผู้ใช้ 2-3 ประโยค (ห้ามใส่ Task List หรือ Mermaid เด็ดขาด)`,
      SELFIE_SYSTEM_PROMPT,
      1024,
      0.4
    );
    // Strip any stray internal Task List or Mermaid blocks specifically for selfie responses
    llmReply = rawReply
      .replace(/\[Task List\][\s\S]*?(?=\n\[|\n#|\n\n[A-Z]|$)/gi, "")
      .replace(/\[Mermaid\][\s\S]*?```[\s\S]*?```/gi, "")
      .replace(/```mermaid[\s\S]*?```/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    llmReply = answer || "กระจกเห็นรูปคุณแล้วค่ะ วันนี้รู้สึกเป็นยังไงบ้าง?";
  }

  return { answer, llmReply, emotionKey };
}

export async function analyzeHomework(imageBlob: Blob): Promise<VisionResult> {
  const visionQuery =
    "อ่านและคัดลอกโจทย์ ข้อความ ตัวเลือก (ก. ข. ค. ง.) และภาพประกอบ/สูตรโมเลกุลในภาพนี้ทั้งหมดให้ครบถ้วน 100% ห้ามตัดทอน " +
    "หากเป็นโจทย์เคมีหรือชีวเคมี ให้ระบุชื่อและลักษณะโครงสร้างทางเคมีของกรดอะมิโนหรือสารเคมีที่เห็นในภาพให้ชัดเจน";

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
      `โจทย์และรายละเอียดที่ถอดความจากภาพ:\n"${answer}"\n\n` +
      `คำสั่งในการวิเคราะห์และแสดงคำตอบอย่างสมบูรณ์:\n` +
      `1. **วิเคราะห์โครงสร้าง/ข้อมูลเคมี-คณิตศาสตร์**: อธิบายสมบัติของกรดอะมิโน/สาร/สมการแต่ละตัวในภาพอย่างชัดเจน\n` +
      `2. **วิเคราะห์ตัวเลือกทีละข้อ**: ตรวจสอบตัวเลือก ก., ข., ค., และ ง. ทีละข้อ แสดงเหตุผลว่าเหตุใดจึงถูกหรือผิด\n` +
      `3. **สรุปคำตอบสุดท้าย**: ระบุตัวเลือกที่ถูกต้องที่สุดอย่างชัดเจน ปิดท้ายด้วย **คำตอบที่ถูกต้องคือ: [ตัวเลือก]** (เขียนคำตอบให้สมบูรณ์ครบถ้วน ห้ามตัดจบกลางคัดเด็ดขาด!)`,
      MATH_SYSTEM_PROMPT,
      3576,
      0.05
    );
  } catch {
    llmReply = answer || "กระจกเห็นการบ้านแล้วค่ะ ติดขั้นตอนไหนบอกกระจกได้เลยนะ";
  }

  return { answer, llmReply };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AUDIO — Typhoon ASR (primary) + Pathumma AudioQA (fallback)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AudioResult {
  transcription: string;
  llmReply: string;
  emotionKey: string;
}

/** Typhoon ASR — OpenAI-compatible transcription endpoint */
export async function callTyphoonASR(audioBlob: Blob): Promise<string> {
  // Typhoon ASR supported formats: wav, mp3, flac, ogg, opus
  // Chrome MediaRecorder produces audio/webm which is rejected (415).
  // Convert any unsupported format to WAV via Web Audio API.
  const SUPPORTED = ["audio/wav", "audio/wave", "audio/x-wav", "audio/mp3", "audio/mpeg", "audio/flac", "audio/ogg", "audio/opus"];
  const isSupported = SUPPORTED.some(t => audioBlob.type.startsWith(t.split(";")[0]));

  let fileBlob = audioBlob;
  let fileName = "recording.wav";

  if (!isSupported) {
    console.debug("[TyphoonASR] Converting", audioBlob.type, "→ WAV for upload");
    fileBlob = await blobToWav(audioBlob);
    fileName = "recording.wav";
  } else {
    const mimeToExt: Record<string, string> = {
      "audio/wav": "wav", "audio/wave": "wav", "audio/x-wav": "wav",
      "audio/mp3": "mp3", "audio/mpeg": "mp3", "audio/flac": "flac",
      "audio/ogg": "ogg", "audio/opus": "opus",
    };
    const ext = Object.entries(mimeToExt).find(([k]) => audioBlob.type.startsWith(k))?.[1] ?? "wav";
    fileName = `recording.${ext}`;
  }

  const form = new FormData();
  form.append("file", fileBlob, fileName);
  form.append("model", "typhoon-asr-realtime");

  const res = await fetch(`${TYPHOON_PROXY}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${TYPHOON_ASR_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[TyphoonASR] HTTP error", res.status, errBody.slice(0, 300));
    throw new Error(`Typhoon ASR ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  console.debug("[TyphoonASR] raw response:", raw);
  const text = (raw.text as string) ?? "";
  if (!text.trim()) throw new Error("Typhoon ASR returned empty transcription");
  return text.trim();
}

/** Pathumma AudioQA fallback */
export async function callAudioLLM(audioBlob: Blob, instruction: string): Promise<string> {
  const mimeToExt: Record<string, string> = {
    "audio/wav": "wav", "audio/wave": "wav", "audio/x-wav": "wav",
    "audio/mp3": "mp3", "audio/mpeg": "mp3", "audio/ogg": "ogg",
    "audio/mp4": "mp4", "audio/webm": "webm", "video/webm": "webm",
  };
  const ext = mimeToExt[audioBlob.type] ?? "webm";
  const form = new FormData();
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
  let transcription = "";

  // Primary: Typhoon ASR (OpenAI-compatible, high-accuracy Thai ASR)
  if (TYPHOON_ASR_KEY.trim().length > 0) {
    try {
      transcription = await callTyphoonASR(audioBlob);
      console.debug("[TyphoonASR] Transcription:", transcription);
    } catch (err) {
      console.warn("[TyphoonASR] Failed, falling back to Pathumma AudioQA:", err);
    }
  }

  // Fallback: Pathumma AudioQA
  if (!transcription) {
    const audioInstruction =
      "ฟังเสียงนี้และแปลงเป็นข้อความภาษาไทยให้ครบถ้วน " +
      "ตอบในรูปแบบ: [ข้อความ: ...ข้อความที่ได้ยิน...] แล้วตามด้วยสรุปสั้น ๆ ว่าผู้พูดกำลังพูดถึงอะไร";
    try {
      const audioResponse = await callAudioLLM(audioBlob, audioInstruction);
      const match = audioResponse.match(/\[ข้อความ[:\s]+([^\]]+)\]/i);
      transcription = match ? match[1].trim() : audioResponse;
    } catch (err) {
      console.warn("Pathumma AudioQA also failed:", err);
      return {
        transcription: "",
        llmReply: "ขอโทษนะคะ กระจกได้ยินเสียงไม่ชัด ลองพูดอีกครั้งหรือพิมพ์ข้อความแทนได้ค่ะ",
        emotionKey: "neutral",
      };
    }
  }

  const textForAnalysis = transcription;
  const emotionKey = await analyzeSentiment(textForAnalysis);

  let llmReply: string;
  try {
    llmReply = await callTextLLM(
      `ผู้ใช้พูดว่า: "${textForAnalysis}"\nตอบสนองด้วยความเข้าใจและเห็นอกเห็นใจ ถ้ามีคำถามช่วยตอบด้วย ตอบไม่เกิน 3 ประโยค`
    );
  } catch {
    llmReply = transcription || "กระจกได้ยินคุณแล้วค่ะ วันนี้รู้สึกเป็นยังไงบ้าง?";
  }

  return { transcription, llmReply, emotionKey };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mood Classifier — Thai keyword-based (local fallback)
// ═══════════════════════════════════════════════════════════════════════════════

const MOOD_CUES: [string, string[]][] = [
  ["positive", ["ยิ้ม", "สดใส", "ร่าเริง", "มีความสุข", "อารมณ์ดี", "ดีใจ", "สนุก", "เยี่ยม", "ภูมิใจ", "ชอบมาก", "happy", "สุขใจ", "สำเร็จ", "เบิกบาน", "เป็นมิตร", "หัวเราะ"]],
  ["calm",     ["ผ่อนคลาย", "สบายใจ", "สงบ", "โล่งใจ", "ปกติดี", "calm", "โอเค"]],
  ["stressed", ["เครียด", "กดดัน", "กังวล", "วิตก", "ประหม่า", "รับไม่ไหว", "stress", "สอบไม่ทัน", "หนักมาก"]],
  ["tired",    ["เหนื่อย", "ง่วง", "อ่อนเพลีย", "หมดแรง", "ไม่มีแรง", "เพลีย", "tired", "นอนไม่หลับ", "ล้า"]],
  ["sad",      ["เศร้า", "ร้องไห้", "เสียใจ", "ท้อแท้", "ท้อใจ", "สิ้นหวัง", "หมดกำลังใจ", "เหงา", "โดดเดี่ยว", "ผิดหวัง", "sad"]],
];

export function classifyMoodFromText(text: string): string {
  if (!text) return "neutral";

  // 1. Direct tag check from Vision LLM [อารมณ์: ...]
  const tagMatch = text.match(/\[อารมณ์[:\s]+([^\]]+)\]/i);
  if (tagMatch) {
    const tag = tagMatch[1].trim().toLowerCase();
    if (tag.includes("เครียด") || tag.includes("ตึง") || tag.includes("กังวล")) return "stressed";
    if (tag.includes("เศร้า") || tag.includes("ท้อ") || tag.includes("เสียใจ")) return "sad";
    if (tag.includes("เหนื่อย") || tag.includes("เพลีย") || tag.includes("ล้า")) return "tired";
    if (tag.includes("สดใส") || tag.includes("ยิ้ม") || tag.includes("สุข") || tag.includes("ดีใจ")) return "positive";
    if (tag.includes("สงบ") || tag.includes("ผ่อนคลาย") || tag.includes("สบายใจ")) return "calm";
  }

  const lower = text.toLowerCase();

  // 2. Remove negated positive phrases (e.g. "ไม่มีรอยยิ้ม", "ไม่ยิ้ม", "ไร้ความสุข") so "ไม่มีรอยยิ้ม" won't match "ยิ้ม"
  const cleaned = lower.replace(/(ไม่มี|ไม่|ไร้|ปราศจาก)\s*(รอยยิ้ม|ยิ้ม|ความสุข|ความสดใส|อารมณ์ดี|ความผ่อนคลาย)/g, "");

  // 3. Priority order: check negative emotions first on cleaned text
  if (/(เครียด|ปวดศีรษะ|หมอง|ตึง|กดดัน|กังวล|กลุ้ม|รับไม่ไหว|stress)/.test(cleaned)) return "stressed";
  if (/(เหนื่อย|อ่อนเพลีย|หมดแรง|ไม่มีแรง|เพลีย|นอนไม่หลับ|ล้า|tired)/.test(cleaned)) return "tired";
  if (/(เศร้า|เสียใจ|ท้อแท้|ท้อใจ|สิ้นหวัง|หมดกำลังใจ|เหงา|โดดเดี่ยว|ผิดหวัง|sad)/.test(cleaned)) return "sad";
  if (/(ยิ้ม|สดใส|ร่าเริง|มีความสุข|อารมณ์ดี|ดีใจ|สนุก|เยี่ยม|ภูมิใจ|สุขใจ|สำเร็จ|เบิกบาน|เป็นมิตร|หัวเราะ|happy)/.test(cleaned)) return "positive";
  if (/(ผ่อนคลาย|สบายใจ|สงบ|โล่งใจ|ปกติดี|calm|โอเค)/.test(cleaned)) return "calm";

  return "neutral";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unified chat handler — ThaiLLM + parallel sentiment analysis
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatResult {
  reply: string;
  emotionKey: string;
  searchUsed?: boolean;
  sources?: { title: string; url: string }[];
}

export async function chat(
  userMessage: string,
  history?: { role: string; text: string }[]
): Promise<ChatResult> {
  const [searchResult, emotionKey] = await Promise.all([
    callTextLLMWithSearch(userMessage, JAIKRAJOK_SYSTEM_PROMPT, 3072, 0.4, history),
    analyzeSentiment(userMessage).catch(() => classifyMoodFromText(userMessage)),
  ]);
  return {
    reply: searchResult.reply,
    emotionKey,
    searchUsed: searchResult.searchUsed,
    sources: searchResult.sources,
  };
}
