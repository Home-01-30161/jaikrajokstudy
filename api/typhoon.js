export default async function handler(req, res) {
  const path = req.url.replace("/api/typhoon", "");
  const contentType = req.headers["content-type"] ?? "";
  const isForm = contentType.includes("multipart/form-data");

  const response = await fetch(`https://api.opentyphoon.ai${path}`, {
    method: req.method,
    headers: isForm
      ? { Authorization: `Bearer ${process.env.TYPHOON_ASR_KEY}` }
      : { Authorization: `Bearer ${process.env.TYPHOON_ASR_KEY}`, "Content-Type": "application/json" },
    body: req.method !== "GET" ? req : undefined,
    duplex: "half",
  });
  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
}
