/**
 * db-seed-test.js — insert 1 test row into every new table, then read back counts
 *
 * GET /db-seed-test?secret=<ADMIN_SECRET>
 *
 * Steps:
 *   1. Insert 1 row into: schools, users, sessions, emotion_events,
 *      emotion_alerts, homework_events, daily_emotion_summary
 *   2. Return a JSON/HTML report showing row counts before and after
 *
 * DELETE this file after confirming tables work.
 */

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("GET only");

  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.query.secret !== secret)
    return res.status(401).send("401 Unauthorized");

  const client = await pool.connect();
  const results = [];

  try {
    await client.query("BEGIN");

    // ── 1. schools ───────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO schools (school_code, name, province, subscription_plan)
      VALUES ('TEST01', 'โรงเรียนทดสอบ', 'กรุงเทพมหานคร', 'free')
      ON CONFLICT (school_code) DO NOTHING
    `);
    results.push({ table: "schools", action: "INSERT 1 test school" });

    // ── 2. users ─────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO users (line_user_id_hash, age_group, school_code, consent_given_at)
      VALUES ('sha256_test_user_001', 'M5', 'TEST01', NOW())
      ON CONFLICT (line_user_id_hash) DO NOTHING
    `);
    const { rows: [testUser] } = await client.query(
      "SELECT id FROM users WHERE line_user_id_hash = 'sha256_test_user_001'"
    );
    results.push({ table: "users", action: "INSERT 1 test user", id: testUser?.id });

    const uid = testUser?.id ?? null;

    // ── 3. sessions ──────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO sessions (session_id, anon_user_id, title, session_type)
      VALUES ('test-session-001', $1, 'ทดสอบระบบ', 'chat')
      ON CONFLICT (session_id) DO NOTHING
    `, [uid]);
    results.push({ table: "sessions", action: "INSERT 1 test session" });

    // ── 4. emotion_events ────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO emotion_events
        (anon_user_id, session_id, source_type, sentiment_label, sentiment_score, combined_emotion, combined_summary)
      VALUES
        ($1, 'test-session-001', 'text', 'positive', 0.85, 'happy', 'ผู้ใช้รู้สึกดี ทดสอบระบบสำเร็จ')
    `, [uid]);
    results.push({ table: "emotion_events", action: "INSERT 1 positive emotion event" });

    // ── 5. emotion_alerts ────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO emotion_alerts
        (anon_user_id, alert_type, consecutive_negative, message_shown_to_user, admin_notified)
      VALUES
        ($1, 'continuous_negative', 3, 'แนะนำให้ปรึกษาครูที่ปรึกษา หรือโทร 1323', false)
    `, [uid]);
    results.push({ table: "emotion_alerts", action: "INSERT 1 test alert" });

    // ── 6. homework_events ───────────────────────────────────────────────────
    await client.query(`
      INSERT INTO homework_events
        (anon_user_id, session_id, subject_detected, ocr_text, ai_response, emotion_at_time, image_stored)
      VALUES
        ($1, 'test-session-001', 'math', 'โจทย์: 2+2=?', 'คำตอบคือ 4 ครับ', 'neutral', false)
    `, [uid]);
    results.push({ table: "homework_events", action: "INSERT 1 test homework event" });

    // ── 7. daily_emotion_summary ─────────────────────────────────────────────
    await client.query(`
      INSERT INTO daily_emotion_summary
        (anon_user_id, summary_date, positive_count, negative_count, neutral_count, total_events, dominant_emotion)
      VALUES
        ($1, CURRENT_DATE, 5, 1, 2, 8, 'positive')
      ON CONFLICT (anon_user_id, summary_date) DO NOTHING
    `, [uid]);
    results.push({ table: "daily_emotion_summary", action: "INSERT 1 test daily summary" });

    await client.query("COMMIT");

    // ── Read back counts ─────────────────────────────────────────────────────
    const tables = [
      "schools", "users", "sessions",
      "emotion_events", "emotion_alerts",
      "homework_events", "daily_emotion_summary",
      "chat_messages", "schema_migrations"
    ];

    const counts = {};
    for (const t of tables) {
      const r = await client.query(`SELECT COUNT(*) AS n FROM "${t}"`);
      counts[t] = parseInt(r.rows[0].n, 10);
    }

    // ── HTML response ────────────────────────────────────────────────────────
    const actionRows = results.map(r => `
      <tr>
        <td><code>${r.table}</code></td>
        <td style="color:#6ee7b7">${r.action}</td>
        <td style="color:#7dd3fc;text-align:right">${counts[r.table] ?? "?"}</td>
      </tr>`).join("");

    const extraRows = ["chat_messages","schema_migrations"].map(t => `
      <tr>
        <td><code>${t}</code></td>
        <td style="color:#94a3b8">existing (not seeded)</td>
        <td style="color:#7dd3fc;text-align:right">${counts[t] ?? "?"}</td>
      </tr>`).join("");

    return res.status(200).send(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>DB Seed Test — team07</title>
  <style>
    body { background:#0f1117; color:#e2e8f0; font-family:'Segoe UI',sans-serif; padding:32px; font-size:14px; }
    h1 { color:#fff; margin-bottom:4px; }
    .sub { color:#64748b; font-size:12px; margin-bottom:24px; }
    table { border-collapse:collapse; background:#1e2030; border-radius:10px; overflow:hidden; width:100%; max-width:700px; }
    th { background:#2d3250; padding:10px 14px; text-align:left; font-size:11px; text-transform:uppercase; color:#94a3b8; }
    td { padding:9px 14px; border-bottom:1px solid #252840; }
    tr:last-child td { border-bottom:none; }
    code { font-family:monospace; color:#a5b4fc; }
    .ok { display:inline-block; background:#065f46; color:#6ee7b7; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:600; }
    .warn { color:#fde68a; }
  </style>
</head>
<body>
  <h1>✅ DB Seed Test — team07</h1>
  <p class="sub">1 test row inserted into every new table · read counts below</p>

  <p>Status: <span class="ok">ALL INSERTS SUCCEEDED</span></p><br>

  <table>
    <thead><tr><th>Table</th><th>Action</th><th style="text-align:right">Total Rows</th></tr></thead>
    <tbody>
      ${actionRows}
      ${extraRows}
    </tbody>
  </table>

  <br>
  <p class="warn">⚠️ This is a test endpoint. Remove <code>api/db-seed-test.js</code> after confirming.</p>
  <p style="color:#475569;font-size:12px;margin-top:8px">
    Generated ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
  </p>
</body>
</html>`);

  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(500).send(`
      <pre style="color:red;background:#1e2030;padding:20px;border-radius:8px">
INSERT FAILED: ${err.message}
      </pre>`);
  } finally {
    client.release();
  }
}
