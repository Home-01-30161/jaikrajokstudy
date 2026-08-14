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
               LEFT(text, 100) AS preview
        FROM chat_messages
        ORDER BY created_at DESC
        LIMIT 20
      `);
      rows = r.rows;
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
      background: #0f1117;
      color: #e2e8f0;
      padding: 24px;
      font-size: 14px;
    }
    h1 { font-size: 1.4rem; font-weight: 700; color: #fff; margin-bottom: 4px; }
    .sub { color: #64748b; font-size: 12px; margin-bottom: 24px; }
    .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
    .card {
      background: #1e2030;
      border: 1px solid #2d3250;
      border-radius: 10px;
      padding: 16px 24px;
      min-width: 160px;
    }
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
    .preview { color: #cbd5e1; max-width: 340px; word-break: break-word; font-size: 13px; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
    }
    .badge-user  { background: #1d4ed8; color: #bfdbfe; }
    .badge-bot   { background: #065f46; color: #6ee7b7; }
    .badge-web   { background: #713f12; color: #fde68a; }
    .badge-line  { background: #166534; color: #bbf7d0; }
    .refresh { font-size: 11px; color: #475569; margin-top: 20px; }
    a { color: #7dd3fc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>

<h1>🗄️ JaiKraJok — DB Admin</h1>
<p class="sub">team07 · PostgreSQL 16 · read-only · <a href="?secret=${req.query.secret}">↻ refresh</a></p>

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
    <div class="label">Total Messages</div>
    <div class="value">${(counts["chat_messages"] ?? 0).toLocaleString()}</div>
  </div>
</div>

<div class="section">
  <h2>Tables</h2>
  <table>
    <thead><tr><th>Table</th><th style="text-align:right">Rows</th></tr></thead>
    <tbody>${tableRows || '<tr><td colspan="2" style="color:#64748b">No tables found</td></tr>'}</tbody>
  </table>
</div>

<div class="section">
  <h2>Recent Messages (last 20)</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>User ID</th>
        <th>Role</th>
        <th>Source</th>
        <th>Session</th>
        <th>Time (BKK)</th>
        <th>Preview</th>
      </tr>
    </thead>
    <tbody>${msgRows || '<tr><td colspan="7" style="color:#64748b;padding:20px">No messages yet</td></tr>'}</tbody>
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
