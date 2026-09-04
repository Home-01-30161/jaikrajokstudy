export default async function handler(req, res) {
  const path = req.url.replace("/api/gemini", "");
  const contentType = req.headers["content-type"] ?? "";
  const apiKey = process.env.GEMINI_API_KEY || process.env.APP_GEMINI_API_KEY || "";

  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    const separator = path.includes("?") ? "&" : "?";
    const targetUrl = `https://generativelanguage.googleapis.com${path}${separator}key=${apiKey}`;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
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
    console.error("[gemini] upstream error:", err?.message);
    res.status(504).json({ error: isTimeout ? "Gemini upstream timeout" : String(err?.message) });
  }
}
