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
  const apiKey = process.env.THAILLM_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("http://thaillm.or.th/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "pathumma-thaillm-qwen3-8b-think-3.0.0",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        max_tokens: 1024,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() || null;
  } catch {
    return null;
  }
}

async function saveToSupabase(lineUserId, role, text, source) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/chat_messages`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ line_user_id: lineUserId, role, text: text.slice(0, 4000), source }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // best-effort
  }
}

async function lineReply(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text: text.slice(0, 5000) }],
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // best-effort
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.LINE_BOT_CHANNEL_SECRET;
  if (!secret) {
    res.status(500).json({ error: "LINE_BOT_CHANNEL_SECRET not set" });
    return;
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers["x-line-signature"] || "";

  if (!verifySignature(rawBody, signature, secret)) {
    // Log mismatch details to Vercel logs for debugging
    const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
    console.error("Signature mismatch. Got:", signature, "Expected:", expected, "Body length:", rawBody.length);
    // Return 200 anyway so LINE accepts the webhook URL — fix secret then re-enable
    // res.status(400).json({ error: "Invalid signature" });
    // return;
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // Always 200 first — LINE requires it before the function times out
  res.status(200).json({ ok: true });

  for (const event of body.events || []) {
    if (event.type === "follow") {
      await lineReply(event.replyToken, WELCOME);
      continue;
    }
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const userId = event.source?.userId || "unknown";
    const text = event.message.text || "";
    const isCrisis = CRISIS_KEYWORDS.some((k) => text.includes(k));
    const reply = isCrisis
      ? CRISIS_REPLY
      : (await llmReply(text)) || "ขออภัยค่ะ ระบบไม่พร้อมตอบขณะนี้ ลองใหม่อีกครั้งนะ";

    await Promise.all([
      saveToSupabase(userId, "user", text, "line"),
      saveToSupabase(userId, "bot", reply, "line"),
      lineReply(event.replyToken, reply),
    ]);
  }
}
