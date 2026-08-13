export default async function handler(req, res) {
  const upstream = `http://thaillm.or.th/api${req.url.replace("/thaillm", "")}`;
  try {
    const response = await fetch(upstream, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.THAILLM_API_KEY}`,
      },
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(55000),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    res.status(504).json({ error: isTimeout ? "ThaiLLM timeout" : String(err?.message) });
  }
}
