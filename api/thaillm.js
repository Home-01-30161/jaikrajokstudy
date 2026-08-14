export default async function handler(req, res) {
  const path = req.url.replace(/^\/thaillm/, "");
  const upstream = `https://thaillm.or.th/api${path}`;
  console.log(`[thaillm] → ${req.method} ${upstream}`);
  try {
    const response = await fetch(upstream, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; jaikrajok/1.0)",
        Authorization: `Bearer ${process.env.THAILLM_API_KEY}`,
      },
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(110000),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    if (!response.ok) {
      console.error(`[thaillm] upstream ${response.status}:`, text.slice(0, 300));
    }
    res.status(response.status).json(data);
  } catch (err) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    res.status(504).json({ error: isTimeout ? "ThaiLLM timeout" : String(err?.message) });
  }
}
