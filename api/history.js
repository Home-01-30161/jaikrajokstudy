export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const lineUserId = req.query.line_user_id;
  if (!lineUserId || lineUserId.length > 128) {
    res.status(400).json({ error: "Missing or invalid line_user_id" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Supabase not configured" });
    return;
  }

  const params = new URLSearchParams({
    line_user_id: `eq.${lineUserId}`,
    order: "created_at.desc",
    limit: "50",
    select: "role,text,source,created_at",
  });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/chat_messages?${params}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: "Supabase error" });
      return;
    }

    const rows = await response.json();
    // Return oldest-first so the chat UI renders chronologically
    rows.reverse();
    res.status(200).json({ messages: rows });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
