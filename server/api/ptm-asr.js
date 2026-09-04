// ptm-asr.js — Typhoon ASR proxy endpoint (https://api.opentyphoon.ai/v1/audio/transcriptions)
// Model: typhoon-asr-realtime

export default async function handler(req, res) {
  const path = req.url.replace("/api/ptm-asr", "");
  const contentType = req.headers["content-type"] ?? "";

  try {
    // Buffer the full body first — piping req directly into fetch
    // causes connection resets on multipart form-data (binary WAV) payloads
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    const apiKey = process.env.TYPHOON_ASR_KEY || process.env.TYPHOON_API_KEY || process.env.TOKENMIND_API_KEY;

    const response = await fetch(`https://api.opentyphoon.ai/v1${path}`, {
      method: req.method,
      headers: {
        // Forward original Content-Type (preserves multipart boundary)
        "Content-Type": contentType || "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: req.method !== "GET" ? rawBody : undefined,
      signal: AbortSignal.timeout(90000),
    });

    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    console.error("[typhoon-asr] upstream error:", err?.message);
    res.status(504).json({ error: isTimeout ? "typhoon-asr upstream timeout" : String(err?.message) });
  }
}
