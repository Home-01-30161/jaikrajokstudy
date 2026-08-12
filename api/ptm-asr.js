export default async function handler(req, res) {
  const path = req.url.replace("/api/ptm-asr", "");
  const contentType = req.headers["content-type"] ?? "";
  const isForm = contentType.includes("multipart/form-data");

  const response = await fetch(`https://tokenmind.pathumma.in.th/v1${path}`, {
    method: req.method,
    headers: isForm
      ? { Authorization: `Bearer ${process.env.TOKENMIND_API_KEY}` }
      : { Authorization: `Bearer ${process.env.TOKENMIND_API_KEY}`, "Content-Type": "application/json" },
    body: req.method !== "GET" ? req : undefined,
    duplex: "half",
  });

  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
}
