// user-data.js — PDPA §33-34: right of access, portability, and erasure
//   backed by Supabase REST API
//
//   GET    /user-data/export?line_user_id=U...
//          → JSON with every stored record for this user
//   DELETE /user-data  body: { line_user_id: "U..." }
//          → permanently deletes every stored record for this user

function sbHeaders(key) {
  return {
    apikey:         key,
    Authorization:  `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer:         "return=minimal",
  };
}

/** GET /user-data/export?line_user_id=... — full data export (JSON) */
export async function exportUserData(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Supabase not configured" });

  const { line_user_id } = req.query;
  if (!line_user_id || line_user_id.length > 128)
    return res.status(400).json({ error: "line_user_id query param required" });

  try {
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // chat_messages
    const msgParams = new URLSearchParams({
      line_user_id: `eq.${line_user_id}`,
      order: "created_at.asc",
      select: "id,role,text,source,session_id,session_title,created_at",
    });
    const msgRes = await fetch(`${supabaseUrl}/rest/v1/chat_messages?${msgParams}`, { headers });
    const chat_messages = msgRes.ok ? await msgRes.json() : [];

    // line_user_state
    const stateParams = new URLSearchParams({
      line_user_id: `eq.${line_user_id}`,
      select: "session_id,session_num,concern_streak,trend_json,updated_at",
    });
    const stateRes = await fetch(`${supabaseUrl}/rest/v1/line_user_state?${stateParams}`, { headers });
    const line_user_state = stateRes.ok ? await stateRes.json() : [];

    // emotion_alerts
    const alertParams = new URLSearchParams({
      line_user_id: `eq.${line_user_id}`,
      order: "triggered_at.asc",
      select: "id,alert_type,consecutive_negative,message_shown_to_user,admin_notified,triggered_at",
    });
    const alertRes = await fetch(`${supabaseUrl}/rest/v1/emotion_alerts?${alertParams}`, { headers });
    const emotion_alerts = alertRes.ok ? await alertRes.json() : [];

    return res.status(200).json({
      exported_at: new Date().toISOString(),
      line_user_id,
      data: { chat_messages, line_user_state, emotion_alerts },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /user-data — permanent erasure (PDPA right to deletion) */
export async function deleteUserData(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Supabase not configured" });

  const { line_user_id } = req.body ?? {};
  if (!line_user_id || line_user_id.length > 128)
    return res.status(400).json({ error: "line_user_id required in body" });

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" };

  try {
    const deleted = {};

    // Delete chat_messages
    const msgRes = await fetch(
      `${supabaseUrl}/rest/v1/chat_messages?line_user_id=eq.${encodeURIComponent(line_user_id)}`,
      { method: "DELETE", headers }
    );
    const deletedMsgs = msgRes.ok ? await msgRes.json().catch(() => []) : [];
    deleted.chat_messages = Array.isArray(deletedMsgs) ? deletedMsgs.length : 0;

    // Delete line_user_state
    const stateRes = await fetch(
      `${supabaseUrl}/rest/v1/line_user_state?line_user_id=eq.${encodeURIComponent(line_user_id)}`,
      { method: "DELETE", headers }
    );
    const deletedState = stateRes.ok ? await stateRes.json().catch(() => []) : [];
    deleted.line_user_state = Array.isArray(deletedState) ? deletedState.length : 0;

    // Delete emotion_alerts
    const alertRes = await fetch(
      `${supabaseUrl}/rest/v1/emotion_alerts?line_user_id=eq.${encodeURIComponent(line_user_id)}`,
      { method: "DELETE", headers }
    ).catch(() => null);
    const deletedAlerts = alertRes?.ok ? await alertRes.json().catch(() => []) : [];
    deleted.emotion_alerts = Array.isArray(deletedAlerts) ? deletedAlerts.length : 0;

    return res.status(200).json({ ok: true, deleted });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}