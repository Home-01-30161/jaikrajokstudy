export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text } = req.body ?? {};
  if (!text) return res.status(400).json({ error: "Missing text" });

  const params = new URLSearchParams({ text });
  const response = await fetch("https://api.aiforthai.in.th/ssense", {
    method: "POST",
    headers: {
      "Apikey": process.env.PATHUMMA_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
}
