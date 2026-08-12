export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { line_user_id, role, text, source } = req.body ?? {};
  if (!line_user_id || !role || !text) return res.status(400).json({ error: "Missing fields" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Supabase not configured" });

  const response = await fetch(`${supabaseUrl}/rest/v1/chat_messages`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      line_user_id,
      role,
      text: String(text).slice(0, 4000),
      source: source || "web",
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    return res.status(response.status).json({ error: err.slice(0, 200) });
  }
  res.status(200).json({ ok: true });
}
