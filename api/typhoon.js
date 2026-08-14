export default async function handler(req, res) {
  const path = req.url.replace("/api/typhoon", "");
  const contentType = req.headers["content-type"] ?? "";

  try {
    const response = await fetch(`https://api.opentyphoon.ai${path}`, {
      method: req.method,
      headers: {
        // Always forward the original Content-Type (preserves multipart boundary)
        "Content-Type": contentType || "application/json",
        Authorization: `Bearer ${process.env.TYPHOON_ASR_KEY}`,
      },
      // Stream the raw request body through (routes registered before express.json so req.body is undefined)
      body: req.method !== "GET" ? req : undefined,
      duplex: "half",
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    console.error("[typhoon] upstream error:", err?.message);
    res.status(504).json({ error: isTimeout ? "Typhoon upstream timeout" : String(err?.message) });
  }
}
