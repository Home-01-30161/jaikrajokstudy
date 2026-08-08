export default async function handler(req, res) {
  // Gemini puts the key in the query string — strip any client-sent key and inject ours
  const base = req.url.replace("/api/gemini", "").replace(/[?&]key=[^&]*/g, "");
  const sep = base.includes("?") ? "&" : "?";
  const upstream = `https://generativelanguage.googleapis.com${base}${sep}key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(upstream, {
    method: req.method,
    headers: { "Content-Type": "application/json" },
    body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
}
