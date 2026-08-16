-- ============================================================
--  004_anonymize_existing.sql
--  JaiKraJok — PDPA: anonymize existing rows + alert identity
--
--  Converts raw LINE / web User IDs already stored in chat_messages and
--  line_user_state into their SHA-256 hex hashes (pgcrypto), so no raw
--  identifier remains in the database. Idempotent — values that already
--  look like a 64-char hex hash are left untouched.
--
--  Also adds the anonymized user column to emotion_alerts (used by the
--  human-in-the-loop alert flow in api/notify.js).
-- ============================================================

-- ── 1. Anonymize chat_messages ───────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    UPDATE chat_messages
       SET line_user_id = encode(digest(line_user_id, 'sha256'), 'hex')
     WHERE line_user_id !~ '^[0-9a-f]{64}$';
  END IF;
END $$;

-- ── 2. Anonymize line_user_state ──────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.line_user_state') IS NOT NULL THEN
    UPDATE line_user_state
       SET line_user_id = encode(digest(line_user_id, 'sha256'), 'hex')
     WHERE line_user_id !~ '^[0-9a-f]{64}$';
  END IF;
END $$;

-- ── 3. emotion_alerts: anonymized user identity column ───────────────────────
DO $$
BEGIN
  IF to_regclass('public.emotion_alerts') IS NOT NULL THEN
    ALTER TABLE emotion_alerts ADD COLUMN IF NOT EXISTS line_user_id_hash TEXT;
    CREATE INDEX IF NOT EXISTS idx_alerts_user_hash
      ON emotion_alerts (line_user_id_hash, triggered_at DESC);
  END IF;
END $$;

-- ── Migration Complete ───────────────────────────────────────────────────────
-- Verify: SELECT COUNT(*) FROM chat_messages WHERE line_user_id !~ '^[0-9a-f]{64}$';  -- expect 0