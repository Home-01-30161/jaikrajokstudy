-- ============================================================
--  002_production_ready.sql
--  JaiKraJok — Production-ready improvements
--  Optimizations for 1000+ daily active users
--
--  Changes:
--    1. Add missing indexes for high-frequency queries
--    2. Add CHECK constraints for data integrity
--    3. Add soft delete support
--    4. Add performance monitoring columns
--    5. Fix foreign key inconsistencies
--    6. Create data retention cleanup function
-- ============================================================

-- ── 1. Missing Indexes (critical for performance at scale) ──────────────────

-- chat_messages: most-queried table, needs session and user indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_time
  ON chat_messages(line_user_id, created_at DESC)
  WHERE line_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_source
  ON chat_messages(source, created_at DESC);

-- homework_events: user timeline queries (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'homework_events') THEN
    CREATE INDEX IF NOT EXISTS idx_homework_user_time
      ON homework_events(anon_user_id, created_at DESC)
      WHERE anon_user_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_homework_session
      ON homework_events(session_id, created_at DESC)
      WHERE session_id IS NOT NULL;
  END IF;
END $$;

-- sessions: active session lookups (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
    CREATE INDEX IF NOT EXISTS idx_sessions_active
      ON sessions(ended_at)
      WHERE ended_at IS NULL;
  END IF;
END $$;

-- users: soft delete queries (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    CREATE INDEX IF NOT EXISTS idx_users_active
      ON users(is_active, created_at DESC)
      WHERE is_active = TRUE;
  END IF;
END $$;

-- ── 2. Data Integrity Constraints ────────────────────────────────────────────

-- Only add constraints if tables exist (from 001_new_schema.sql)

-- emotion_events: validate source_type enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emotion_events') THEN
    ALTER TABLE emotion_events DROP CONSTRAINT IF EXISTS chk_source_type;
    ALTER TABLE emotion_events ADD CONSTRAINT chk_source_type
      CHECK (source_type IN ('face', 'text', 'voice', 'combined'));

    ALTER TABLE emotion_events DROP CONSTRAINT IF EXISTS chk_sentiment;
    ALTER TABLE emotion_events ADD CONSTRAINT chk_sentiment
      CHECK (sentiment_label IN ('positive', 'negative', 'neutral') OR sentiment_label IS NULL);

    ALTER TABLE emotion_events DROP CONSTRAINT IF EXISTS chk_face_emotion;
    ALTER TABLE emotion_events ADD CONSTRAINT chk_face_emotion
      CHECK (face_emotion IN ('happy', 'sad', 'angry', 'fearful', 'surprised', 'neutral', 'disgust')
             OR face_emotion IS NULL);

    ALTER TABLE emotion_events DROP CONSTRAINT IF EXISTS chk_face_confidence;
    ALTER TABLE emotion_events ADD CONSTRAINT chk_face_confidence
      CHECK (face_confidence IS NULL OR (face_confidence >= 0.0 AND face_confidence <= 1.0));

    ALTER TABLE emotion_events DROP CONSTRAINT IF EXISTS chk_sentiment_score;
    ALTER TABLE emotion_events ADD CONSTRAINT chk_sentiment_score
      CHECK (sentiment_score IS NULL OR (sentiment_score >= 0.0 AND sentiment_score <= 1.0));
  END IF;
END $$;

-- schools: validate subscription_plan enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools') THEN
    ALTER TABLE schools DROP CONSTRAINT IF EXISTS chk_subscription_plan;
    ALTER TABLE schools ADD CONSTRAINT chk_subscription_plan
      CHECK (subscription_plan IN ('free', 'org'));
  END IF;
END $$;

-- emotion_alerts: validate alert_type enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emotion_alerts') THEN
    ALTER TABLE emotion_alerts DROP CONSTRAINT IF EXISTS chk_alert_type;
    ALTER TABLE emotion_alerts ADD CONSTRAINT chk_alert_type
      CHECK (alert_type IN ('continuous_negative', 'crisis_signal', 'high_stress'));
  END IF;
END $$;

-- sessions: validate session_type enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
    ALTER TABLE sessions DROP CONSTRAINT IF EXISTS chk_session_type;
    ALTER TABLE sessions ADD CONSTRAINT chk_session_type
      CHECK (session_type IN ('chat', 'homework', 'voice'));

    ALTER TABLE sessions DROP CONSTRAINT IF EXISTS chk_session_times;
    ALTER TABLE sessions ADD CONSTRAINT chk_session_times
      CHECK (ended_at IS NULL OR ended_at >= started_at);
  END IF;
END $$;

-- ── 3. Soft Delete Support ───────────────────────────────────────────────────

-- Add deleted_at timestamp for audit trail (only if users table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by TEXT;

    CREATE INDEX IF NOT EXISTS idx_users_deleted
      ON users(deleted_at)
      WHERE deleted_at IS NOT NULL;
  END IF;
END $$;

-- ── 4. Performance Monitoring Columns ─────────────────────────────────────────

-- Track API response times for debugging slow queries
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS response_time_ms INT;

CREATE INDEX IF NOT EXISTS idx_chat_messages_slow
  ON chat_messages(response_time_ms DESC)
  WHERE response_time_ms > 5000;  -- queries over 5 seconds

-- Track token usage for cost monitoring
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS tokens_used INT;

CREATE INDEX IF NOT EXISTS idx_chat_messages_tokens
  ON chat_messages(created_at, tokens_used)
  WHERE tokens_used IS NOT NULL;

-- Add latency tracking to other tables (only if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emotion_events') THEN
    ALTER TABLE emotion_events ADD COLUMN IF NOT EXISTS api_latency_ms INT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'homework_events') THEN
    ALTER TABLE homework_events ADD COLUMN IF NOT EXISTS processing_time_ms INT;
  END IF;
END $$;

-- ── 5. Fix Foreign Key Inconsistencies ────────────────────────────────────────

-- Make session_id a proper foreign key (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emotion_events')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
    -- Clean up orphaned records
    DELETE FROM emotion_events
    WHERE session_id IS NOT NULL
      AND session_id NOT IN (SELECT session_id FROM sessions);

    ALTER TABLE emotion_events DROP CONSTRAINT IF EXISTS fk_emotion_events_session;
    ALTER TABLE emotion_events ADD CONSTRAINT fk_emotion_events_session
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'homework_events')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
    -- Clean up orphaned records
    DELETE FROM homework_events
    WHERE session_id IS NOT NULL
      AND session_id NOT IN (SELECT session_id FROM sessions);

    ALTER TABLE homework_events DROP CONSTRAINT IF EXISTS fk_homework_events_session;
    ALTER TABLE homework_events ADD CONSTRAINT fk_homework_events_session
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 6. Data Retention Policy (PDPA Compliance) ────────────────────────────────

-- Function to clean up old data (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_data(retention_days INT DEFAULT 90)
RETURNS TABLE(
  table_name TEXT,
  rows_deleted BIGINT
) AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  deleted_count BIGINT;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;

  -- Delete old chat messages
  DELETE FROM chat_messages
  WHERE created_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'chat_messages';
  rows_deleted := deleted_count;
  RETURN NEXT;

  -- Delete old emotion events (keep aggregated daily_emotion_summary)
  DELETE FROM emotion_events
  WHERE detected_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'emotion_events';
  rows_deleted := deleted_count;
  RETURN NEXT;

  -- Delete old homework events
  DELETE FROM homework_events
  WHERE created_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'homework_events';
  rows_deleted := deleted_count;
  RETURN NEXT;

  -- Delete resolved emotion alerts older than 1 year
  DELETE FROM emotion_alerts
  WHERE resolved_at IS NOT NULL
    AND resolved_at < (NOW() - INTERVAL '1 year');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'emotion_alerts';
  rows_deleted := deleted_count;
  RETURN NEXT;

  -- Delete ended sessions older than retention period
  DELETE FROM sessions
  WHERE ended_at IS NOT NULL
    AND ended_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'sessions';
  rows_deleted := deleted_count;
  RETURN NEXT;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to application user
-- (Adjust role name based on your setup)
GRANT EXECUTE ON FUNCTION cleanup_old_data TO PUBLIC;

-- Create a table to track cleanup runs
CREATE TABLE IF NOT EXISTS data_retention_log (
  id SERIAL PRIMARY KEY,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_days INT NOT NULL,
  total_rows_deleted BIGINT,
  details JSONB,
  run_duration_ms INT
);

-- ── 7. Vacuum and Analyze Settings ───────────────────────────────────────────

-- Optimize autovacuum for high-write tables
ALTER TABLE chat_messages SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- vacuum at 5% dead tuples (default 20%)
  autovacuum_analyze_scale_factor = 0.02  -- analyze at 2% changes (default 10%)
);

ALTER TABLE emotion_events SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- ── 8. Partitioning Preparation (for future scaling) ─────────────────────────

-- Create a view that unions current table + future partitions
-- This allows transparent migration to partitioned table later
CREATE OR REPLACE VIEW chat_messages_all AS
SELECT * FROM chat_messages;

-- Add comment for future migration
COMMENT ON TABLE chat_messages IS
  'TODO: Partition by created_at (monthly) when exceeds 100k rows. Use: CREATE TABLE chat_messages_new PARTITION OF...';

-- ── 9. Monitoring Queries as Views ───────────────────────────────────────────

-- View: Database health metrics
CREATE OR REPLACE VIEW db_health AS
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size,
  n_tup_ins AS inserts,
  n_tup_upd AS updates,
  n_tup_del AS deletes,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percent,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- View: Slow queries (messages taking > 3 seconds)
CREATE OR REPLACE VIEW slow_responses AS
SELECT
  id,
  user_id,
  session_id,
  created_at,
  response_time_ms,
  LEFT(content, 100) AS content_preview,
  tokens_used
FROM chat_messages
WHERE response_time_ms > 3000
ORDER BY response_time_ms DESC;

-- View: Daily usage statistics
CREATE OR REPLACE VIEW daily_usage_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_messages,
  COUNT(DISTINCT user_id) AS active_users,
  COUNT(DISTINCT session_id) AS sessions,
  AVG(response_time_ms) AS avg_response_ms,
  SUM(tokens_used) AS total_tokens
FROM chat_messages
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View: Emotion tracking summary
CREATE OR REPLACE VIEW emotion_summary AS
SELECT
  DATE(detected_at) AS date,
  source_type,
  sentiment_label,
  COUNT(*) AS event_count,
  AVG(face_confidence) AS avg_face_conf,
  AVG(sentiment_score) AS avg_sentiment_score
FROM emotion_events
WHERE detected_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(detected_at), source_type, sentiment_label
ORDER BY date DESC, source_type, sentiment_label;

-- ── 10. Update Migration Registry ────────────────────────────────────────────

INSERT INTO schema_migrations (version) VALUES ('002_production_ready')
  ON CONFLICT (version) DO NOTHING;

-- ── Migration Complete ───────────────────────────────────────────────────────
-- Run cleanup manually when needed: SELECT * FROM cleanup_old_data(90);
-- Monitor health: SELECT * FROM db_health;
-- Check slow queries: SELECT * FROM slow_responses LIMIT 20;
-- View usage trends: SELECT * FROM daily_usage_stats;
