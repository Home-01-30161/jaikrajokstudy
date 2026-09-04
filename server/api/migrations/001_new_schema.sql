-- ============================================================
--  001_new_schema.sql
--  JaiKraJok — full schema migration
--  Based on proposal: emotion-aware study buddy for Thai students
--
--  Run order:
--    1. extensions
--    2. new tables
--    3. alter existing chat_messages
--    4. migrate mood_events → emotion_events
--    5. drop old tables (mood_events, message_counts)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ── 1. Schools (referenced by users) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id                SERIAL PRIMARY KEY,
  school_code       TEXT        NOT NULL UNIQUE,
  name              TEXT        NOT NULL,
  province          TEXT,
  subscription_plan TEXT        NOT NULL DEFAULT 'free',  -- 'free' | 'org'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Anonymous user registry ────────────────────────────────────────────────
--  line_user_id is never stored raw — always SHA-256 hashed
CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  anon_id               UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  line_user_id_hash     TEXT        NOT NULL UNIQUE,
  age_group             TEXT,                          -- 'M4' 'M5' 'M6'
  school_code           TEXT        REFERENCES schools(school_code),
  consent_given_at      TIMESTAMPTZ,                   -- PDPA consent timestamp
  parental_consent_at   TIMESTAMPTZ,                   -- required for under-20
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_users_anon ON users (anon_id);

-- ── 3. Sessions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id               SERIAL PRIMARY KEY,
  session_id       TEXT        NOT NULL UNIQUE,       -- matches chat_messages.session_id
  anon_user_id     INT         REFERENCES users(id) ON DELETE SET NULL,
  title            TEXT,
  session_type     TEXT        NOT NULL DEFAULT 'chat',  -- 'chat' | 'homework' | 'voice'
  dominant_emotion TEXT,                              -- computed on session end
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (anon_user_id, started_at DESC);

-- ── 4. Emotion events (one row per AI detection call) ─────────────────────────
CREATE TABLE IF NOT EXISTS emotion_events (
  id                SERIAL PRIMARY KEY,
  anon_user_id      INT         REFERENCES users(id) ON DELETE SET NULL,
  session_id        TEXT,                             -- loose FK to sessions.session_id
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- which modality triggered this event
  source_type       TEXT        NOT NULL,             -- 'face' | 'text' | 'voice' | 'combined'

  -- face recognition result (null when source_type != 'face'/'combined')
  face_emotion      TEXT,                             -- happy/sad/angry/fearful/surprised/neutral
  face_confidence   FLOAT,

  -- sentiment analysis result (null when source_type != 'text'/'combined')
  sentiment_label   TEXT,                             -- positive | negative | neutral
  sentiment_score   FLOAT,

  -- Pathumma synthesized result
  combined_emotion  TEXT,
  combined_summary  TEXT,                             -- short Thai text from Pathumma

  -- full API response payload for debugging — never shown to users
  raw_response      JSONB
);

CREATE INDEX IF NOT EXISTS idx_emotion_user_time
  ON emotion_events (anon_user_id, detected_at DESC);

-- ── 5. Emotion alerts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emotion_alerts (
  id                      SERIAL PRIMARY KEY,
  anon_user_id            INT         REFERENCES users(id) ON DELETE SET NULL,
  triggered_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alert_type              TEXT        NOT NULL,   -- 'continuous_negative' | 'crisis_signal' | 'high_stress'
  consecutive_negative    INT,                    -- how many negative events in a row
  message_shown_to_user   TEXT,                   -- what bot told the user (e.g. "แนะนำโทร 1323")
  admin_notified          BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at             TIMESTAMPTZ,
  resolution_note         TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON emotion_alerts (anon_user_id, triggered_at DESC);

-- ── 6. Homework / OCR study-help events ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS homework_events (
  id               SERIAL PRIMARY KEY,
  anon_user_id     INT         REFERENCES users(id) ON DELETE SET NULL,
  session_id       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subject_detected TEXT,                           -- 'math' | 'science' | 'thai' | etc.
  ocr_text         TEXT,                           -- text extracted from image
  ai_response      TEXT,                           -- Pathumma's explanation
  emotion_at_time  TEXT,                           -- user emotion during this study event
  image_stored     BOOLEAN     NOT NULL DEFAULT FALSE  -- MUST stay FALSE per proposal §6
);

-- ── 7. Daily emotion summary (trend graph data) ───────────────────────────────
CREATE TABLE IF NOT EXISTS daily_emotion_summary (
  id               SERIAL PRIMARY KEY,
  anon_user_id     INT         REFERENCES users(id) ON DELETE CASCADE,
  summary_date     DATE        NOT NULL,
  positive_count   INT         NOT NULL DEFAULT 0,
  negative_count   INT         NOT NULL DEFAULT 0,
  neutral_count    INT         NOT NULL DEFAULT 0,
  total_events     INT         NOT NULL DEFAULT 0,
  dominant_emotion TEXT,
  UNIQUE (anon_user_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_user
  ON daily_emotion_summary (anon_user_id, summary_date DESC);

-- ── 8. Extend existing chat_messages ─────────────────────────────────────────
-- chat_messages is created lazily by history.js / webhook.js at runtime, so it
-- may not exist yet when this migration runs on a fresh database.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
    ALTER TABLE chat_messages
      ADD COLUMN IF NOT EXISTS emotion_tag   TEXT,
      ADD COLUMN IF NOT EXISTS emotion_score FLOAT;
  END IF;
END $$;

-- ── 9. Migrate mood_events → emotion_events ──────────────────────────────────
--  mood_events columns are unknown at write time; migrate what we can safely.
--  If the table doesn't exist this block is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mood_events'
  ) THEN
    INSERT INTO emotion_events (
      detected_at,
      source_type,
      combined_emotion,
      combined_summary,
      raw_response
    )
    SELECT
      COALESCE(
        (row_to_json(me) ->> 'created_at')::TIMESTAMPTZ,
        NOW()
      ),
      'text',                                       -- best-guess source
      (row_to_json(me) ->> 'mood')::TEXT,
      (row_to_json(me) ->> 'note')::TEXT,
      row_to_json(me)::JSONB                        -- keep full original row
    FROM mood_events me;

    RAISE NOTICE 'mood_events migrated: % rows', (SELECT COUNT(*) FROM mood_events);
  END IF;
END;
$$;

-- ── 10. Drop legacy tables ────────────────────────────────────────────────────
DROP TABLE IF EXISTS mood_events;
DROP TABLE IF EXISTS message_counts;

-- ── Migration registry (tracks which migrations have run) ────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT        NOT NULL PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_new_schema')
  ON CONFLICT (version) DO NOTHING;
