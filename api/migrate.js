/**
 * migrate.js — run pending SQL migrations at startup
 *
 * Reads every *.sql file from ./migrations/ in filename order,
 * skips any already recorded in schema_migrations, then executes
 * the rest in a single transaction each.
 *
 * Usage: called automatically by index.js before the server starts.
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn("migrate: DATABASE_URL not set — skipping");
    return;
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Ensure the registry table exists before querying it
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT        NOT NULL PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Which migrations have already run?
    const { rows } = await client.query(
      "SELECT version FROM schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.version));

    // Read all .sql files sorted by name (001_, 002_, …)
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = file.replace(".sql", "");
      if (applied.has(version)) {
        console.log(`migrate: skip  ${version} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

      console.log(`migrate: apply ${version} …`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
          [version]
        );
        await client.query("COMMIT");
        console.log(`migrate: done  ${version}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`migrate: FAILED ${version}:`, err.message);
        throw err;   // abort startup — don't run the server with a broken schema
      }
    }
  } finally {
    await client.end();
  }
}
