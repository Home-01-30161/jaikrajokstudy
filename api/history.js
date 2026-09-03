// history.js — chat message store backed by Supabase REST API
//   POST /history  { line_user_id, role, text, source?, session_id?, session_title? }
//   GET  /history?line_user_id=...  → { sessions: [...] }

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Supabase not configured" });

  // ── POST: save a web chat message ─────────────────────────────────────────
  if (req.method === "POST") {
    const { line_user_id, role, text, source, session_id, session_title } = req.body ?? {};
    if (!line_user_id || !role || !text)
      return res.status(400).json({ error: "Missing fields" });

    const response = await fetch(`${supabaseUrl}/rest/v1/chat_messages`, {
      method: "POST",
      headers: {
        apikey:          serviceKey,
        Authorization:   `Bearer ${serviceKey}`,
        "Content-Type":  "application/json",
        Prefer:          "return=minimal",
      },
      body: JSON.stringify({
        line_user_id,
        role,
        text:          String(text).slice(0, 4000),
        source:        source       || "web",
        session_id:    session_id   || null,
        session_title: session_title || null,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      return res.status(response.status).json({ error: err.slice(0, 200) });
    }
    return res.status(200).json({ ok: true });
  }

  // ── GET: fetch chat history grouped by session ─────────────────────────────
  if (req.method === "GET") {
    const lineUserId = req.query.line_user_id;
    if (!lineUserId || lineUserId.length > 128)
      return res.status(400).json({ error: "Missing or invalid line_user_id" });

    const params = new URLSearchParams({
      line_user_id: `eq.${lineUserId}`,
      order:        "created_at.asc",
      limit:        "200",
      select:       "role,text,source,created_at,session_id,session_title",
    });

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/chat_messages?${params}`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      if (!response.ok) return res.status(502).json({ error: "Supabase error" });
      const rows = await response.json();

      // Group by session_id
      const sessionMap = new Map();
      for (const row of rows) {
        const sid = row.session_id || "__line__";
        if (!sessionMap.has(sid)) {
          sessionMap.set(sid, {
            session_id:    sid,
            session_title: row.session_title || (sid === "__line__" ? "LINE Bot History" : "สนทนา"),
            messages:      [],
          });
        }
        sessionMap.get(sid).messages.push(row);
      }

      return res.status(200).json({ sessions: Array.from(sessionMap.values()) });
    } catch (err) {
      return res.status(500).json({ error: err.message || String(err) });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}