/**
 * admin-db.js — read-only DB inspection endpoint
 *
 * GET /admin-db?secret=<ADMIN_SECRET>
 *
 * Returns a JSON snapshot of the database:
 *   - tables list
 *   - row count per table
 *   - last 10 rows of chat_messages
 *
 * Protected by ADMIN_SECRET env var (set in GitLab CI/CD Variables as APP_ADMIN_SECRET).
 * Read-only — no INSERT / UPDATE / DELETE allowed.
 */

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "GET only" });

  // Auth — must match APP_ADMIN_SECRET CI variable (injected as ADMIN_SECRET by index.js)
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.query.secret !== secret)
    return res.status(401).json({ error: "Unauthorized — provide ?secret=<ADMIN_SECRET>" });

  if (!process.env.DATABASE_URL)
    return res.status(500).json({ error: "DATABASE_URL not configured" });

  try {
    // 1. List all user tables
    const tablesRes = await pool.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const tables = tablesRes.rows.map(r => r.tablename);

    // 2. Row count for each table
    const counts = {};
    for (const table of tables) {
      // Safe: table names come from pg_catalog, not user input
      const r = await pool.query(`SELECT COUNT(*) AS n FROM "${table}"`);
      counts[table] = parseInt(r.rows[0].n, 10);
    }

    // 3. Last 10 chat_messages (if table exists)
    let recentMessages = [];
    if (tables.includes("chat_messages")) {
      const r = await pool.query(`
        SELECT id, line_user_id, role, source, session_id, session_title,
               created_at, LEFT(text, 120) AS preview
        FROM chat_messages
        ORDER BY created_at DESC
        LIMIT 10
      `);
      recentMessages = r.rows;
    }

    // 4. DB size
    const sizeRes = await pool.query(
      `SELECT pg_size_pretty(pg_database_size('app')) AS db_size`
    );

    return res.status(200).json({
      ok: true,
      db_size: sizeRes.rows[0].db_size,
      tables,
      row_counts: counts,
      recent_chat_messages: recentMessages,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
