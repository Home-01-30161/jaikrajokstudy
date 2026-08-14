// ─────────────────────────────────────────────────────────────────────────────
// webhook.js — JaiKrajok LINE Bot  (full-featured rewrite)
// Features: text chat + history, image analysis (selfie / homework),
//           voice ASR, mood-streak escalation, trend Flex view,
//           multi-session commands, 1323 support strip
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, randomUUID } from "crypto";
import pg from "pg";

export const config = { api: { bodyParser: false } };

// ── Constants ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "คุณคือ JaiKrajok (ใจกระจก) เพื่อนช่วยเรียนที่เข้าใจอารมณ์นักเรียน " +
  "ตอบเป็นภาษาไทย สั้นกระชับ สุภาพ อบอุ่น เหมาะกับการสนทนาทาง LINE " +
  "ห้ามวินิจฉัยโรคหรือแสดงตัวเป็นนักจิตวิทยา " +
  "หากผู้ใช้มีความเสี่ยงรุนแรง ให้แนะนำสายด่วน 1323 เสมอ";

const CRISIS_KEYWORDS = ["ฆ่าตัวตาย", "อยากตาย", "ทำร้ายตัวเอง", "ไม่อยากอยู่", "ไม่มีค่า"];

const CRISIS_REPLY =
  "เราห่วงใยคุณมากนะ ตอนนี้คุณไม่ได้อยู่คนเดียว\n\n" +
  "โปรดติดต่อสายด่วนสุขภาพจิต 1323 (ฟรี 24 ชั่วโมง) " +
  "หรือคนที่ไว้ใจได้ใกล้ตัวด้วยนะ 💙";

const WELCOME =
  "สวัสดี เราคือ JaiKrajok (ใจกระจก) เพื่อนช่วยเรียนที่ใส่ใจอารมณ์ 💙\n\n" +
  "📝 พิมพ์คำถามหรือบอกความรู้สึกได้เลย\n" +
  "📸 ส่งรูปภาพ → วิเคราะห์อารมณ์หรือเฉลยการบ้าน\n" +
  "🎙️ ส่งข้อความเสียง → แปลงเสียงและตอบโต้\n" +
  "📊 พิมพ์ แนวโน้ม → ดูกราฟอารมณ์ย้อนหลัง\n" +
  "🆕 พิมพ์ เซสชันใหม่ → เริ่มการสนทนาใหม่\n" +
  "❓ พิมพ์ ช่วยเหลือ → ดูคำสั่งทั้งหมด";

const FALLBACK = "ขออภัยค่ะ ระบบไม่พร้อมตอบขณะนี้ ลองใหม่อีกครั้งนะ";

// Regex for mood detection from free text
const CONCERN_RE =
  /เครียด|กังวล|เศร้า|ท้อ|เหนื่อย|หมดแรง|นอนไม่หลับ|ล้า|โกรธ|หดหู่|หงุดหงิด|เบื่อ|กลัว|วิตก|สิ้นหวัง|ผิดหวัง|เจ็บปวด|ทุกข์|ทรมาน/;
const POSITIVE_RE =
  /ยิ้ม|สดใส|ร่าเริง|มีความสุข|อารมณ์ดี|ดีใจ|สนุก|ผ่อนคลาย|สบาย|โล่งใจ|ปกติ|โอเค|ดีขึ้น/;

// Command matchers
const isNewSession = (t) => /^(เซสชันใหม่|\/new)$/i.test(t.trim());
const isTrend     = (t) => /^(แนวโน้ม|trend|ดูแนวโน้ม|ประวัติอารมณ์)$/i.test(t.trim());
const isHelp      = (t) => /^(ช่วยเหลือ|help|วิธีใช้|\?)$/i.test(t.trim());
const isSelfie    = (t) => /^(เซลฟี่|selfie)$/i.test(t.trim());
const isHomework  = (t) => /^(การบ้าน|homework|เฉลย)$/i.test(t.trim());

// ── Database ──────────────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let dbReady = false;

async function ensureDB() {
  if (dbReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id            SERIAL PRIMARY KEY,
      line_user_id  TEXT        NOT NULL,
      role          TEXT        NOT NULL,
      text          TEXT        NOT NULL,
      source        TEXT        NOT NULL DEFAULT 'line',
      session_id    TEXT,
      session_title TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user
      ON chat_messages (line_user_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS line_user_state (
      line_user_id        TEXT PRIMARY KEY,
      session_id          TEXT        NOT NULL,
      session_num         INT         NOT NULL DEFAULT 1,
      concern_streak      INT         NOT NULL DEFAULT 0,
      pending_image_msgid TEXT,
      trend_json          JSONB       NOT NULL DEFAULT '[]'::jsonb,
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  dbReady = true;
}

/** Get or create a user-state row, return it. */
async function getUserState(userId) {
  await ensureDB();
  // INSERT … ON CONFLICT DO NOTHING ensures idempotency
  await pool.query(
    `INSERT INTO line_user_state (line_user_id, session_id)
     VALUES ($1, $2)
     ON CONFLICT (line_user_id) DO NOTHING`,
    [userId, randomUUID()]
  );
  const { rows } = await pool.query(
    `SELECT * FROM line_user_state WHERE line_user_id = $1`,
    [userId]
  );
  return rows[0];
}

/** Partially update user-state columns. */
async function updateUserState(userId, updates) {
  const ALLOWED = [
    "session_id", "session_num", "concern_streak",
    "pending_image_msgid", "trend_json",
  ];
  const fields = [];
  const vals   = [];
  let idx = 1;
  for (const key of ALLOWED) {
    if (key in updates) {
      fields.push(`${key} = $${idx++}`);
      vals.push(updates[key] ?? null);
    }
  }
  if (fields.length === 0) return;
  fields.push(`updated_at = NOW()`);
  vals.push(userId);
  await pool.query(
    `UPDATE line_user_state SET ${fields.join(", ")} WHERE line_user_id = $${idx}`,
    vals
  );
}

async function saveToDB(userId, role, text, sessionId, sessionTitle) {
  if (!process.env.DATABASE_URL) return;
  try {
    await pool.query(
      `INSERT INTO chat_messages
         (line_user_id, role, text, source, session_id, session_title)
       VALUES ($1, $2, $3, 'line', $4, $5)`,
      [userId, role, String(text).slice(0, 4000), sessionId || null, sessionTitle || null]
    );
  } catch (err) {
    console.error("DB save error:", err?.message);
  }
}

// ── LINE API helpers ──────────────────────────────────────────────────────────

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifySignature(rawBody, sig, secret) {
  // LINE sends x-line-signature as base64(HMAC-SHA256(body, channel_secret))
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  return sig === expected;
}

/** Send one or more messages via LINE Reply API (max 5 messages). */
async function lineReply(replyToken, messages) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) { console.error("LINE_CHANNEL_ACCESS_TOKEN not set"); return; }
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("LINE reply failed:", res.status, err);
  }
}

/** Download binary content from LINE Content API, return { buf, contentType }. */
async function downloadLineContent(messageId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const res = await fetch(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) }
  );
  if (!res.ok) throw new Error(`LINE content download failed: ${res.status}`);
  const buf         = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { buf, contentType };
}

// ── Upstream API calls ────────────────────────────────────────────────────────

/** ThaiLLM text completion (with optional conversation history). */
async function llmReply(text, history = []) {
  const apiKey = process.env.TOKENMIND_API_KEY;
  if (!apiKey) return null;
  try {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-8).map((m) => ({ role: m.role, content: m.text })),
      { role: "user", content: text },
    ];
    const res = await fetch("https://tokenmind.pathumma.in.th/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "thaillm-8b", messages, max_tokens: 512, temperature: 0.4 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    // Strip <think>...</think> reasoning blocks (ThaiLLM chain-of-thought)
    return raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() || null;
  } catch (e) {
    console.error("LLM error:", e?.message);
    return null;
  }
}

/**
 * Typhoon OCR — analyze a JPEG/PNG Buffer.
 * mode: "selfie" → brief emotion description  |  "homework" → full OCR + solve
 */
async function visionAnalyze(imageBuffer, contentType, mode) {
  const apiKey = process.env.TYPHOON_ASR_KEY;
  if (!apiKey) throw new Error("TYPHOON_ASR_KEY not set");

  const base64   = imageBuffer.toString("base64");
  const mimeType = (contentType || "image/jpeg").split(";")[0];

  const systemPrompt = mode === "selfie"
    ? "คุณคือ JaiKrajok ผู้ช่วยวิเคราะห์อารมณ์จากใบหน้า ตอบเป็นภาษาไทยสั้น ๆ 1-2 ประโยค"
    : "You are an OCR and homework-solving engine. " +
      "Extract ALL text from the image, then solve the problem step by step in Thai. " +
      "For math/physics use LaTeX $...$ inline and $$...$$ for display equations.";

  const userQuery = mode === "selfie"
    ? "ดูใบหน้าในภาพแล้วบรรยายอารมณ์ที่สังเกตเห็นเป็นภาษาไทย 1-2 ประโยค " +
      "แล้วลงท้ายด้วย [อารมณ์:<คำเดียว เช่น สดใส/เศร้า/เครียด/สงบ/กังวล>]"
    : "อ่านข้อความทั้งหมดในภาพ แล้วแสดงการแก้โจทย์ทีละขั้นตอนเป็นภาษาไทย";

  const payload = {
    model: "typhoon-ocr",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: "text",      text: userQuery },
        ],
      },
    ],
    max_tokens:  mode === "selfie" ? 256 : 2048,
    temperature: 0.1,
  };

  const res = await fetch("https://api.opentyphoon.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Typhoon OCR ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

/** ptm-asr-1 — transcribe audio Buffer from LINE (audio/m4a). */
async function asrTranscribe(audioBuffer, contentType) {
  const apiKey = process.env.TOKENMIND_API_KEY;
  if (!apiKey) throw new Error("TOKENMIND_API_KEY not set");

  const mimeType = contentType || "audio/m4a";
  const ext      = mimeType.includes("mp4") ? "mp4" : "m4a";
  const blob     = new Blob([audioBuffer], { type: mimeType });

  const form = new FormData();
  form.append("file",  blob, `recording.${ext}`);
  form.append("model", "ptm-asr-1");

  const res = await fetch("https://tokenmind.pathumma.in.th/v1/audio/transcriptions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body:    form,
    signal:  AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ptm-asr-1 ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.text || "").trim();
  if (!text) throw new Error("ASR returned empty transcription");
  return text;
}

// ── Flex Message builders ─────────────────────────────────────────────────────

/** Escalation Flex — shown after streak ≥ 3 or crisis. */
function buildEscalationFlex() {
  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#C8382A",
      paddingAll: "14px",
      contents: [
        { type: "text", text: "⚠️ กระจกเป็นห่วงคุณ", weight: "bold", color: "#FFFFFF", size: "md" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "14px",
      contents: [
        {
          type: "text",
          text: "กระจกสังเกตว่าคุณรู้สึกหนักใจมาหลายครั้งแล้ว อยากให้รู้ว่าไม่ได้อยู่คนเดียวนะ 💙",
          wrap: true,
          size: "sm",
          color: "#1A1208",
        },
        {
          type: "text",
          text: "มีคนพร้อมรับฟังคุณตลอด 24 ชั่วโมง ฟรี ไม่ต้องกลัวหรือเกรงใจนะ",
          wrap: true,
          size: "sm",
          color: "#3A3530",
          margin: "sm",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "14px",
      contents: [
        {
          type: "button",
          action: { type: "uri", label: "📞 โทรสายด่วนสุขภาพจิต 1323", uri: "tel:1323" },
          style: "primary",
          color: "#C8382A",
          height: "sm",
        },
        {
          type: "button",
          action: { type: "message", label: "💬 คุยกับกระจกต่อ", text: "อยากคุยต่อ" },
          style: "secondary",
          height: "sm",
        },
      ],
    },
  };
}

/**
 * Trend Flex — visualise the last ≤ 10 mood data points as an emoji chart.
 * Returns null when there is no data.
 */
function buildTrendFlex(trendPoints) {
  if (!Array.isArray(trendPoints) || trendPoints.length === 0) return null;

  const recent = trendPoints.slice(-10);
  const moodEmoji = { positive: "🟢", negative: "🔴", neutral: "🟡" };

  const chartLine = recent.map((p) => moodEmoji[p.mood] || "⚪").join(" ");
  const neg = recent.filter((p) => p.mood === "negative").length;
  const pos = recent.filter((p) => p.mood === "positive").length;
  const neu = recent.length - neg - pos;

  const summaryText = neg >= Math.ceil(recent.length / 2)
    ? "⚠️ ช่วงนี้คุณรู้สึกหนักใจบ่อย ลองโทร 1323 หรือคุยกับกระจกนะ"
    : pos >= Math.ceil(recent.length / 2)
    ? "✨ ช่วงนี้อารมณ์ดีมาก ยอดเยี่ยมเลย!"
    : "แนวโน้มอารมณ์โดยรวมปกติดีค่ะ";

  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1A1208",
      paddingAll: "14px",
      contents: [
        { type: "text", text: "📊 แนวโน้มอารมณ์ของคุณ", weight: "bold", color: "#FFFFFF", size: "md" },
        { type: "text", text: `${recent.length} ครั้งล่าสุด`, color: "#FFFFFF88", size: "xs" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "14px",
      contents: [
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F5F0E8",
          paddingAll: "12px",
          cornerRadius: "4px",
          contents: [
            { type: "text", text: chartLine, size: "xl", align: "center", wrap: true },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            { type: "text", text: "🔴 เครียด/กังวล", size: "xs", flex: 3, color: "#3A3530" },
            { type: "text", text: `${neg} ครั้ง (${Math.round((neg / recent.length) * 100)}%)`, size: "xs", flex: 2, align: "end", color: "#6B6156" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "🟡 ปกติ", size: "xs", flex: 3, color: "#3A3530" },
            { type: "text", text: `${neu} ครั้ง (${Math.round((neu / recent.length) * 100)}%)`, size: "xs", flex: 2, align: "end", color: "#6B6156" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "🟢 ผ่อนคลาย/ดี", size: "xs", flex: 3, color: "#3A3530" },
            { type: "text", text: `${pos} ครั้ง (${Math.round((pos / recent.length) * 100)}%)`, size: "xs", flex: 2, align: "end", color: "#6B6156" },
          ],
        },
        { type: "separator", margin: "md" },
        {
          type: "text",
          text: summaryText,
          wrap: true,
          size: "xs",
          color: neg >= Math.ceil(recent.length / 2) ? "#C8382A" : "#2D6A6F",
          margin: "sm",
        },
      ],
    },
  };
}

// ── Mood / trend helpers ──────────────────────────────────────────────────────

function detectMood(text) {
  if (CONCERN_RE.test(text))  return "negative";
  if (POSITIVE_RE.test(text)) return "positive";
  return "neutral";
}

/** Append mood point to trend array (cap at 20). */
function pushTrend(existing, mood) {
  const arr = Array.isArray(existing) ? [...existing] : [];
  arr.push({ ts: Date.now(), mood });
  if (arr.length > 20) arr.splice(0, arr.length - 20);
  return arr;
}

/** Split long text into chunks of maxLen characters. */
function splitText(text, maxLen = 4900) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLen) chunks.push(text.slice(i, i + maxLen));
  return chunks;
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleFollow(event) {
  await lineReply(event.replyToken, [{ type: "text", text: WELCOME }]);
}

async function handleTextMessage(event) {
  const userId = event.source?.userId || "unknown";
  const text   = (event.message?.text || "").trim();

  // Load user state — if DB is unavailable fall back to stateless mode
  let state;
  try {
    state = await getUserState(userId);
  } catch (err) {
    console.error("getUserState error:", err?.message);
    const reply = CRISIS_KEYWORDS.some((k) => text.includes(k))
      ? CRISIS_REPLY
      : (await llmReply(text)) || FALLBACK;
    await lineReply(event.replyToken, [{ type: "text", text: reply.slice(0, 5000) }]);
    return;
  }

  const sessionTitle = `เซสชัน #${state.session_num}`;

  // ── COMMAND: help ───────────────────────────────────────────────────────────
  if (isHelp(text)) {
    await lineReply(event.replyToken, [{
      type: "text",
      text:
        "📖 คำสั่งที่ใช้ได้\n\n" +
        "• พิมพ์คำถามหรือความรู้สึก → กระจกตอบโต้\n" +
        "• ส่งรูปภาพ → เลือกวิเคราะห์เซลฟี่หรือเฉลยการบ้าน\n" +
        "• ส่งข้อความเสียง → แปลงเป็นข้อความและตอบโต้\n" +
        "• แนวโน้ม → ดูกราฟอารมณ์ย้อนหลัง\n" +
        "• เซสชันใหม่ → เริ่มการสนทนาใหม่\n" +
        "• ช่วยเหลือ → แสดงคำสั่งนี้\n\n" +
        "🆘 สายด่วนสุขภาพจิต: 1323 (ฟรี 24 ชม.)",
    }]);
    return;
  }

  // ── COMMAND: new session ────────────────────────────────────────────────────
  if (isNewSession(text)) {
    const newSid = randomUUID();
    const newNum = (state.session_num || 1) + 1;
    await updateUserState(userId, {
      session_id:          newSid,
      session_num:         newNum,
      concern_streak:      0,
      pending_image_msgid: null,
    });
    await lineReply(event.replyToken, [{
      type: "text",
      text: `✅ เริ่มการสนทนาใหม่แล้วนะ (เซสชัน #${newNum})\n\nพูดคุยได้เลยค่ะ 💙`,
    }]);
    return;
  }

  // ── COMMAND: trend view ─────────────────────────────────────────────────────
  if (isTrend(text)) {
    const trendData = state.trend_json || [];
    if (!trendData.length) {
      await lineReply(event.replyToken, [{
        type: "text",
        text: "ยังไม่มีข้อมูลแนวโน้มอารมณ์นะคะ ลองพูดคุยกับกระจกสักพักก่อนค่ะ 😊",
      }]);
      return;
    }
    const flex = buildTrendFlex(trendData);
    await lineReply(event.replyToken, [
      { type: "flex", altText: "แนวโน้มอารมณ์ของคุณ", contents: flex },
    ]);
    return;
  }

  // ── COMMAND: selfie / homework (after pending image) ───────────────────────
  if ((isSelfie(text) || isHomework(text)) && state.pending_image_msgid) {
    const mode  = isSelfie(text) ? "selfie" : "homework";
    const msgId = state.pending_image_msgid;
    await updateUserState(userId, { pending_image_msgid: null });

    try {
      const { buf, contentType } = await downloadLineContent(msgId);
      const visionResult         = await visionAnalyze(buf, contentType, mode);

      if (mode === "selfie") {
        const mood      = detectMood(visionResult);
        const newTrend  = pushTrend(state.trend_json, mood);
        const newStreak = mood === "negative"
          ? (state.concern_streak || 0) + 1
          : mood === "positive" ? 0 : (state.concern_streak || 0);

        await Promise.all([
          updateUserState(userId, {
            trend_json:     JSON.stringify(newTrend),
            concern_streak: newStreak,
          }),
          saveToDB(userId, "bot", `[เซลฟี่] ${visionResult}`, state.session_id, sessionTitle),
        ]);

        const messages = [{ type: "text", text: `📸 ผลวิเคราะห์อารมณ์:\n\n${visionResult}`.slice(0, 5000) }];
        if (newStreak >= 3) {
          messages.push({ type: "flex", altText: "กระจกเป็นห่วงคุณ", contents: buildEscalationFlex() });
        } else if (mood === "negative") {
          messages.push({ type: "text", text: "💙 หากรู้สึกหนักใจมาก สายด่วน 1323 พร้อมรับฟังตลอด 24 ชม. นะคะ" });
        }
        await lineReply(event.replyToken, messages);

      } else {
        // homework — may be long, split into ≤5 messages
        await saveToDB(userId, "bot", `[เฉลยการบ้าน] ${visionResult.slice(0, 200)}`, state.session_id, sessionTitle);
        const chunks   = splitText(visionResult, 4900);
        const messages = chunks.map((chunk, i) => ({
          type: "text",
          text: i === 0 ? `📚 เฉลยการบ้าน:\n\n${chunk}` : chunk,
        }));
        await lineReply(event.replyToken, messages.slice(0, 5));
      }

    } catch (err) {
      console.error("Vision error:", err?.message);
      await lineReply(event.replyToken, [{
        type: "text",
        text: "ขออภัยค่ะ วิเคราะห์ภาพไม่ได้ในขณะนี้ ลองส่งภาพใหม่อีกครั้งนะ",
      }]);
    }
    return;
  }

  // ── NORMAL CHAT ─────────────────────────────────────────────────────────────
  const isCrisis = CRISIS_KEYWORDS.some((k) => text.includes(k));
  let reply;

  if (isCrisis) {
    reply = CRISIS_REPLY;
  } else {
    reply = (await llmReply(text)) || FALLBACK;
  }

  // Mood tracking
  const mood      = detectMood(text + " " + reply);
  const newTrend  = pushTrend(state.trend_json, mood);
  const newStreak = isCrisis
    ? 99
    : mood === "negative"
    ? (state.concern_streak || 0) + 1
    : mood === "positive"
    ? 0
    : (state.concern_streak || 0);

  await Promise.all([
    saveToDB(userId, "user", text,  state.session_id, sessionTitle),
    saveToDB(userId, "bot",  reply, state.session_id, sessionTitle),
    updateUserState(userId, {
      trend_json:     JSON.stringify(newTrend),
      concern_streak: newStreak,
    }),
  ]);

  // Build reply messages
  const messages = [{ type: "text", text: reply.slice(0, 5000) }];

  if (isCrisis) {
    messages.push({ type: "flex", altText: "กระจกเป็นห่วงคุณ — โทร 1323", contents: buildEscalationFlex() });
  } else if (mood === "negative") {
    if (newStreak >= 3) {
      messages.push({ type: "flex", altText: "กระจกเป็นห่วงคุณ", contents: buildEscalationFlex() });
    } else {
      messages.push({ type: "text", text: "💙 หากรู้สึกหนักใจมาก สายด่วน 1323 พร้อมรับฟังตลอด 24 ชม. นะคะ" });
    }
  }

  await lineReply(event.replyToken, messages);
}

async function handleImageMessage(event) {
  const userId = event.source?.userId || "unknown";
  const msgId  = event.message?.id;
  if (!msgId) return;

  try {
    await getUserState(userId); // ensure row exists
    await updateUserState(userId, { pending_image_msgid: msgId });
  } catch (err) {
    console.error("State update error:", err?.message);
  }

  await lineReply(event.replyToken, [{
    type: "text",
    text: "ได้รับรูปภาพแล้วค่ะ 📷 ต้องการให้กระจกทำอะไรกับรูปนี้?",
    quickReply: {
      items: [
        { type: "action", action: { type: "message", label: "📸 เซลฟี่วิเคราะห์อารมณ์", text: "เซลฟี่" } },
        { type: "action", action: { type: "message", label: "📚 เฉลยการบ้าน",             text: "การบ้าน" } },
      ],
    },
  }]);
}

async function handleAudioMessage(event) {
  const userId = event.source?.userId || "unknown";
  const msgId  = event.message?.id;
  if (!msgId) return;

  let state;
  try { state = await getUserState(userId); } catch { state = null; }
  const sessionTitle = state ? `เซสชัน #${state.session_num}` : null;

  let transcription = "";
  try {
    const { buf, contentType } = await downloadLineContent(msgId);
    transcription              = await asrTranscribe(buf, contentType);
  } catch (err) {
    console.error("ASR error:", err?.message);
    await lineReply(event.replyToken, [{
      type: "text",
      text: "ขออภัยค่ะ กระจกได้ยินเสียงไม่ชัด ลองพูดอีกครั้งหรือพิมพ์ข้อความแทนได้ค่ะ",
    }]);
    return;
  }

  // Reply with transcription and LLM response
  const llmResponse = (await llmReply(transcription)) || FALLBACK;

  // Mood tracking
  const mood      = detectMood(transcription + " " + llmResponse);
  const newTrend  = pushTrend(state?.trend_json, mood);
  const newStreak = mood === "negative"
    ? (state?.concern_streak || 0) + 1
    : mood === "positive" ? 0 : (state?.concern_streak || 0);

  if (state) {
    await Promise.all([
      saveToDB(userId, "user", `[เสียง] ${transcription}`, state.session_id, sessionTitle),
      saveToDB(userId, "bot",  llmResponse,                 state.session_id, sessionTitle),
      updateUserState(userId, {
        trend_json:     JSON.stringify(newTrend),
        concern_streak: newStreak,
      }),
    ]);
  }

  const messages = [
    { type: "text", text: `🎙️ กระจกได้ยินว่า:\n"${transcription}"` },
    { type: "text", text: llmResponse.slice(0, 5000) },
  ];

  if (mood === "negative") {
    if (newStreak >= 3) {
      messages.push({ type: "flex", altText: "กระจกเป็นห่วงคุณ", contents: buildEscalationFlex() });
    } else {
      messages.push({ type: "text", text: "💙 หากรู้สึกหนักใจมาก สายด่วน 1323 พร้อมรับฟังตลอด 24 ชม. นะคะ" });
    }
  }

  await lineReply(event.replyToken, messages.slice(0, 5));
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = await getRawBody(req);

  // Signature verification
  const secret    = process.env.LINE_CHANNEL_SECRET;
  const signature = req.headers["x-line-signature"] || "";
  if (secret && !verifySignature(rawBody, signature, secret)) {
    console.warn("LINE signature mismatch — rejecting");
    return res.status(401).json({ error: "Invalid signature" });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // Process all events before responding — Express keeps the process alive
  for (const event of body.events || []) {
    try {
      if (event.type === "follow") {
        await handleFollow(event);
        continue;
      }
      if (event.type !== "message") continue;

      const msgType = event.message?.type;
      if (msgType === "text")  { await handleTextMessage(event);  continue; }
      if (msgType === "image") { await handleImageMessage(event); continue; }
      if (msgType === "audio") { await handleAudioMessage(event); continue; }
    } catch (err) {
      console.error(`Error handling event ${event.type}:`, err?.message);
    }
  }

  res.status(200).json({ ok: true });
}
