export default async function handler(req, res) {
  const path = req.url.replace("/api/typhoon", "");
  const contentType = req.headers["content-type"] ?? "";
  const isForm = contentType.includes("multipart/form-data");

  try {
    const response = await fetch(`https://api.opentyphoon.ai${path}`, {
      method: req.method,
      headers: isForm
        // Forward the full content-type so the multipart boundary reaches the upstream
        ? { Authorization: `Bearer ${process.env.TYPHOON_ASR_KEY}`, "Content-Type": contentType }
        : { Authorization: `Bearer ${process.env.TYPHOON_ASR_KEY}`, "Content-Type": "application/json" },
      // For JSON use the parsed body; for form data stream req directly
      body: req.method !== "GET" ? (isForm ? req : JSON.stringify(req.body)) : undefined,
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
