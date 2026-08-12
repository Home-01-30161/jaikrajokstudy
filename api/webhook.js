import { createHmac } from "crypto";

export const config = { api: { bodyParser: false } };

const SYSTEM_PROMPT =
  "คุณคือ JaiKrajok (ใจกระจก) เพื่อนช่วยเรียนที่เข้าใจอารมณ์ " +
  "ตอบเป็นภาษาไทย ชัดเจน สุภาพ สนับสนุนผู้เรียน " +
  "อย่าวินิจฉัยโรคหรือเป็นนักจิตวิทยา " +
  "หากผู้ใช้มีความเสี่ยงรุนแรง ให้แนะนำติดต่อสายด่วน 1323";

const CRISIS_KEYWORDS = ["ฆ่าตัวตาย", "อยากตาย", "ทำร้ายตัวเอง", "ไม่อยากอยู่", "ไม่มีค่า"];
const CRISIS_REPLY =
  "เราห่วงใยคุณมากนะ ตอนนี้คุณไม่ได้อยู่คนเดียว " +
  "โปรดติดต่อสายด่วนสุขภาพจิต 1323 (ฟรี 24 ชั่วโมง) " +
  "หรือคนที่ไว้ใจใกล้ตัวด้วยนะ";

const WELCOME =
  "สวัสดี เราคือ JaiKrajok (ใจกระจก) เพื่อนช่วยเรียนที่ใส่ใจอารมณ์\n\n" +
  "พิมพ์คำถามเรื่องเรียนหรือบอกความรู้สึกมาได้เลยนะ";

const FALLBACK = "ขออภัยค่ะ ระบบไม่พร้อมตอบขณะนี้ ลองใหม่อีกครั้งนะ";

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifySignature(rawBody, signature, secret) {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  return signature === expected;
}

async function llmReply(text) {
  const apiKey = process.env.TYPHOON_API_KEY || process.env.TYPHOON_ASR_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.opentyphoon.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "typhoon-v2.5-30b-a3b-instruct",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        max_tokens: 512,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("LLM error:", e?.message);
    return null;
  }
}

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id           SERIAL PRIMARY KEY,
      line_user_id TEXT        NOT NULL,
      role         TEXT        NOT NULL,
      text         TEXT        NOT NULL,
      source       TEXT        NOT NULL DEFAULT 'web',
      session_id   TEXT,
      session_title TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages (line_user_id, created_at ASC);
  `);
  tableReady = true;
}

async function saveToDB(lineUserId, role, text, source) {
  if (!process.env.DATABASE_URL) return;
  try {
    await ensureTable();
    await pool.query(
      `INSERT INTO chat_messages (line_user_id, role, text, source)
       VALUES ($1, $2, $3, $4)`,
      [lineUserId, role, text.slice(0, 4000), source]
    );
  } catch (err) {
    console.error("DB save error:", err?.message);
  }
}

async function lineReply(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN not set");
    return;
  }
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: text.slice(0, 5000) }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("LINE reply failed:", res.status, err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawBody = await getRawBody(req);

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // Process all events BEFORE sending 200 — after res.end() Vercel kills the function
  for (const event of body.events || []) {
    if (event.type === "follow") {
      await lineReply(event.replyToken, WELCOME);
      continue;
    }
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const userId = event.source?.userId || "unknown";
    const text = event.message.text || "";

    const isCrisis = CRISIS_KEYWORDS.some((k) => text.includes(k));
    const reply = isCrisis ? CRISIS_REPLY : (await llmReply(text)) || FALLBACK;

    // Save and reply in parallel
    await Promise.all([
      saveToDB(userId, "user", text, "line"),
      saveToDB(userId, "bot", reply, "line"),
      lineReply(event.replyToken, reply),
    ]);
  }

  // Send 200 AFTER all processing is done
  res.status(200).json({ ok: true });
}
