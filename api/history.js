export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Supabase not configured" });

  // POST /api/history — save a web chat message
  if (req.method === "POST") {
    const { line_user_id, role, text, source } = req.body ?? {};
    if (!line_user_id || !role || !text) return res.status(400).json({ error: "Missing fields" });
    const response = await fetch(`${supabaseUrl}/rest/v1/chat_messages`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ line_user_id, role, text: String(text).slice(0, 4000), source: source || "web" }),
    });
    if (!response.ok) {
      const err = await response.text().catch(() => "");
      return res.status(response.status).json({ error: err.slice(0, 200) });
    }
    return res.status(200).json({ ok: true });
  }

  // GET /api/history?line_user_id=U... — fetch chat history
  if (req.method === "GET") {
    const lineUserId = req.query.line_user_id;
    if (!lineUserId || lineUserId.length > 128) return res.status(400).json({ error: "Missing or invalid line_user_id" });
    const params = new URLSearchParams({
      line_user_id: `eq.${lineUserId}`,
      order: "created_at.desc",
      limit: "50",
      select: "role,text,source,created_at",
    });
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/chat_messages?${params}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (!response.ok) return res.status(502).json({ error: "Supabase error" });
      const rows = await response.json();
      rows.reverse(); // oldest-first for chat UI
      return res.status(200).json({ messages: rows });
    } catch (err) {
      return res.status(500).json({ error: err.message || String(err) });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
