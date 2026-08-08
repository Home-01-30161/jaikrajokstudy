export default async function handler(req, res) {
  const path = req.url.replace("/api/pathumma", "");

  // FormData endpoints (VQA, AudioQA) — stream the body through as-is
  const contentType = req.headers["content-type"] ?? "";
  const isForm = contentType.includes("multipart/form-data");

  const upstream = await fetch(`https://api.aiforthai.in.th${path}`, {
    method: req.method,
    headers: isForm
      ? { Apikey: process.env.PATHUMMA_API_KEY, "X-lib": "jaikrajok-web" }
      : { "Content-Type": "application/json", Apikey: process.env.PATHUMMA_API_KEY, "X-lib": "jaikrajok-web" },
    body: req.method !== "GET" ? req : undefined,
    // ponytail: duplex needed for streaming request body in Node 18+
    duplex: "half",
  });

  const data = await upstream.json().catch(() => ({}));
  res.status(upstream.status).json(data);
}
