/**
 * admin-db.js — read-only DB inspection endpoint (HTML dashboard)
 *
 * GET /admin-db?secret=<ADMIN_SECRET>
 *
 * Returns a styled HTML page showing:
 *   - DB size
 *   - Tables + row counts
 *   - Last 20 rows of chat_messages
 *
 * Protected by ADMIN_SECRET env var (set in GitLab CI/CD Variables as APP_ADMIN_SECRET).
 * Read-only — no INSERT / UPDATE / DELETE allowed.
 */

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).send("GET only");

  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.query.secret !== secret)
    return res.status(401).send("<h2>401 Unauthorized</h2>");

  if (!process.env.DATABASE_URL)
    return res.status(500).send("<h2>DATABASE_URL not configured</h2>");

  try {
    // 1. Tables
    const tablesRes = await pool.query(`
      SELECT tablename FROM pg_catalog.pg_tables
      WHERE schemaname = 'public' ORDER BY tablename
    `);
    const tables = tablesRes.rows.map(r => r.tablename);

    // 2. Row counts
    const counts = {};
    for (const table of tables) {
      const r = await pool.query(`SELECT COUNT(*) AS n FROM "${table}"`);
      counts[table] = parseInt(r.rows[0].n, 10);
    }

    // 3. DB size
    const sizeRes = await pool.query(
      `SELECT pg_size_pretty(pg_database_size('app')) AS db_size`
    );
    const dbSize = sizeRes.rows[0].db_size;

    // 4. Recent messages
    let rows = [];
    if (tables.includes("chat_messages")) {
      const r = await pool.query(`
        SELECT id, line_user_id, role, source, session_title,
               to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'DD Mon HH24:MI:SS') AS time,
               LEFT(text, 200) AS preview
        FROM chat_messages
        ORDER BY created_at DESC
        LIMIT 50
      `);
      rows = r.rows;
    }

    // 5. Recent emotion events
    let emotionRows = [];
    if (tables.includes("emotion_events")) {
      const r = await pool.query(`
        SELECT id, source_type, face_emotion, sentiment_label,
               ROUND(sentiment_score::numeric, 2) AS sentiment_score,
               combined_emotion, LEFT(combined_summary, 120) AS summary,
               to_char(detected_at AT TIME ZONE 'Asia/Bangkok', 'DD Mon HH24:MI:SS') AS time
        FROM emotion_events
        ORDER BY detected_at DESC
        LIMIT 20
      `);
      emotionRows = r.rows;
    }

    // 6. Recent homework events
    let hwRows = [];
    if (tables.includes("homework_events")) {
      const r = await pool.query(`
        SELECT id, subject_detected, LEFT(ocr_text, 80) AS ocr_text,
               LEFT(ai_response, 120) AS ai_response, emotion_at_time,
               to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'DD Mon HH24:MI:SS') AS time
        FROM homework_events
        ORDER BY created_at DESC
        LIMIT 20
      `);
      hwRows = r.rows;
    }

    // 7. Recent emotion alerts
    let alertRows = [];
    if (tables.includes("emotion_alerts")) {
      const r = await pool.query(`
        SELECT id, alert_type, consecutive_negative, admin_notified,
               LEFT(message_shown_to_user, 100) AS msg,
               to_char(triggered_at AT TIME ZONE 'Asia/Bangkok', 'DD Mon HH24:MI:SS') AS time,
               resolved_at
        FROM emotion_alerts
        ORDER BY triggered_at DESC
        LIMIT 20
      `);
      alertRows = r.rows;
    }

    // ── HTML ──────────────────────────────────────────────────────────────────
    const tableRows = tables.map(t => `
      <tr>
        <td>${t}</td>
        <td class="num">${counts[t].toLocaleString()}</td>
      </tr>`).join("");

    const msgRows = rows.map((r, i) => `
      <tr class="${i % 2 === 0 ? "even" : "odd"}">
        <td class="num">${r.id}</td>
        <td class="mono">${esc(r.line_user_id)}</td>
        <td><span class="badge badge-${r.role}">${r.role}</span></td>
        <td><span class="badge badge-${r.source}">${r.source}</span></td>
        <td>${esc(r.session_title ?? "—")}</td>
        <td class="mono time">${r.time}</td>
        <td class="preview">${esc(r.preview)}</td>
      </tr>`).join("");

    const emotionTableRows = emotionRows.map((r, i) => `
      <tr class="${i % 2 === 0 ? "even" : "odd"}">
        <td class="num">${r.id}</td>
        <td><span class="badge badge-src-${r.source_type}">${r.source_type}</span></td>
        <td>${esc(r.face_emotion ?? "—")}</td>
        <td>${r.sentiment_label ? `<span class="badge badge-${r.sentiment_label}">${r.sentiment_label} ${r.sentiment_score ?? ""}</span>` : "—"}</td>
        <td>${esc(r.combined_emotion ?? "—")}</td>
        <td class="preview">${esc(r.summary ?? "—")}</td>
        <td class="mono time">${r.time}</td>
      </tr>`).join("");

    const hwTableRows = hwRows.map((r, i) => `
      <tr class="${i % 2 === 0 ? "even" : "odd"}">
        <td class="num">${r.id}</td>
        <td>${esc(r.subject_detected ?? "—")}</td>
        <td class="preview">${esc(r.ocr_text ?? "—")}</td>
        <td class="preview">${esc(r.ai_response ?? "—")}</td>
        <td>${esc(r.emotion_at_time ?? "—")}</td>
        <td class="mono time">${r.time}</td>
      </tr>`).join("");

    const alertTableRows = alertRows.map((r, i) => `
      <tr class="${i % 2 === 0 ? "even" : "odd"}">
        <td class="num">${r.id}</td>
        <td><span class="badge badge-alert">${esc(r.alert_type)}</span></td>
        <td class="num">${r.consecutive_negative ?? "—"}</td>
        <td class="preview">${esc(r.msg ?? "—")}</td>
        <td>${r.admin_notified ? "✅" : "—"}</td>
        <td class="mono time">${r.time}</td>
        <td style="color:${r.resolved_at ? "#6ee7b7" : "#f87171"}">${r.resolved_at ? "resolved" : "open"}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DB Admin — team07</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', 'Noto Sans Thai', sans-serif;
      background: #0f1117; color: #e2e8f0; padding: 24px; font-size: 14px;
    }
    h1 { font-size: 1.4rem; font-weight: 700; color: #fff; margin-bottom: 4px; }
    .sub { color: #64748b; font-size: 12px; margin-bottom: 24px; }
    .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
    .card { background: #1e2030; border: 1px solid #2d3250; border-radius: 10px; padding: 16px 24px; min-width: 160px; }
    .card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
    .card .value { font-size: 1.6rem; font-weight: 700; color: #7dd3fc; }
    h2 { font-size: 1rem; font-weight: 600; color: #94a3b8; margin-bottom: 10px; letter-spacing: .04em; text-transform: uppercase; }
    .section { margin-bottom: 32px; }
    table { width: 100%; border-collapse: collapse; background: #1e2030; border-radius: 10px; overflow: hidden; }
    thead tr { background: #2d3250; }
    th { padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; font-weight: 600; }
    td { padding: 9px 14px; border-bottom: 1px solid #252840; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr.odd { background: #222440; }
    .num { text-align: right; font-variant-numeric: tabular-nums; color: #7dd3fc; }
    .mono { font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 12px; color: #a5b4fc; }
    .time { color: #64748b; font-size: 12px; white-space: nowrap; }
    .preview { color: #cbd5e1; max-width: 300px; word-break: break-word; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .badge-user     { background: #1d4ed8; color: #bfdbfe; }
    .badge-bot      { background: #065f46; color: #6ee7b7; }
    .badge-web      { background: #713f12; color: #fde68a; }
    .badge-line     { background: #166534; color: #bbf7d0; }
    .badge-positive { background: #065f46; color: #6ee7b7; }
    .badge-negative { background: #7f1d1d; color: #fca5a5; }
    .badge-neutral  { background: #1e3a5f; color: #93c5fd; }
    .badge-alert    { background: #78350f; color: #fde68a; }
    .badge-src-face    { background: #4c1d95; color: #c4b5fd; }
    .badge-src-text    { background: #1e3a5f; color: #93c5fd; }
    .badge-src-voice   { background: #064e3b; color: #6ee7b7; }
    .badge-src-combined { background: #1e293b; color: #e2e8f0; }
    .refresh { font-size: 11px; color: #475569; margin-top: 20px; }
    a { color: #7dd3fc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    nav { display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap; }
    nav a { background: #1e2030; border: 1px solid #2d3250; border-radius: 6px; padding: 6px 14px; font-size: 12px; color: #94a3b8; }
    nav a:hover { border-color: #7dd3fc; color: #7dd3fc; text-decoration: none; }
  </style>
</head>
<body>

<h1>🗄️ JaiKraJok — DB Admin</h1>
<p class="sub">team07 · PostgreSQL 16 · read-only · <a href="?secret=${req.query.secret}">↻ refresh</a></p>

<nav>
  <a href="#tables">Tables</a>
  <a href="#messages">Chat Messages</a>
  <a href="#emotions">Emotion Events</a>
  <a href="#homework">Homework</a>
  <a href="#alerts">Alerts</a>
</nav>

<div class="cards">
  <div class="card">
    <div class="label">Database Size</div>
    <div class="value">${dbSize}</div>
  </div>
  <div class="card">
    <div class="label">Tables</div>
    <div class="value">${tables.length}</div>
  </div>
  <div class="card">
    <div class="label">Chat Messages</div>
    <div class="value">${(counts["chat_messages"] ?? 0).toLocaleString()}</div>
  </div>
  <div class="card">
    <div class="label">Emotion Events</div>
    <div class="value">${(counts["emotion_events"] ?? 0).toLocaleString()}</div>
  </div>
  <div class="card">
    <div class="label">Alerts</div>
    <div class="value">${(counts["emotion_alerts"] ?? 0).toLocaleString()}</div>
  </div>
</div>

<div class="section" id="tables">
  <h2>All Tables</h2>
  <table>
    <thead><tr><th>Table</th><th style="text-align:right">Rows</th></tr></thead>
    <tbody>${tableRows || '<tr><td colspan="2" style="color:#64748b">No tables</td></tr>'}</tbody>
  </table>
</div>

<div class="section" id="messages">
  <h2>Recent Chat Messages (last 50)</h2>
  <table>
    <thead>
      <tr><th>ID</th><th>User ID</th><th>Role</th><th>Source</th><th>Session</th><th>Time (BKK)</th><th>Preview</th></tr>
    </thead>
    <tbody>${msgRows || '<tr><td colspan="7" style="color:#64748b;padding:20px">No messages yet</td></tr>'}</tbody>
  </table>
</div>

<div class="section" id="emotions">
  <h2>Recent Emotion Events (last 20)</h2>
  <table>
    <thead>
      <tr><th>ID</th><th>Source</th><th>Face</th><th>Sentiment</th><th>Combined</th><th>Summary</th><th>Time (BKK)</th></tr>
    </thead>
    <tbody>${emotionTableRows || '<tr><td colspan="7" style="color:#64748b;padding:20px">No emotion events yet</td></tr>'}</tbody>
  </table>
</div>

<div class="section" id="homework">
  <h2>Recent Homework Events (last 20)</h2>
  <table>
    <thead>
      <tr><th>ID</th><th>Subject</th><th>OCR Text</th><th>AI Response</th><th>Emotion</th><th>Time (BKK)</th></tr>
    </thead>
    <tbody>${hwTableRows || '<tr><td colspan="6" style="color:#64748b;padding:20px">No homework events yet</td></tr>'}</tbody>
  </table>
</div>

<div class="section" id="alerts">
  <h2>Emotion Alerts (last 20)</h2>
  <table>
    <thead>
      <tr><th>ID</th><th>Type</th><th>Streak</th><th>Message Shown</th><th>Admin Notified</th><th>Time (BKK)</th><th>Status</th></tr>
    </thead>
    <tbody>${alertTableRows || '<tr><td colspan="7" style="color:#64748b;padding:20px">No alerts yet</td></tr>'}</tbody>
  </table>
</div>

<p class="refresh">Generated at ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>

</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);

  } catch (err) {
    return res.status(500).send(`<pre style="color:red">Error: ${esc(err.message)}</pre>`);
  }
}

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
