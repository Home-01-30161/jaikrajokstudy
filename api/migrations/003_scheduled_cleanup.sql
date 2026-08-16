-- ============================================================
--  003_scheduled_cleanup.sql
--  JaiKraJok — Automated data retention cleanup
--  Schedule automatic cleanup to run daily at 3 AM Bangkok time
-- ============================================================

-- Install pg_cron extension (if not already installed)
-- Note: This requires superuser privileges on the database
-- If you don't have pg_cron, run the cleanup function manually via cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 3:00 AM Bangkok time (UTC+7 = 20:00 UTC previous day)
-- Runs cleanup_old_data(90) which deletes records older than 90 days
DO $$
BEGIN
  -- Check if pg_cron is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists (idempotent)
    PERFORM cron.unschedule('jaikrajok-data-retention-cleanup');

    -- Schedule new job
    PERFORM cron.schedule(
      'jaikrajok-data-retention-cleanup',   -- job name
      '0 20 * * *',                          -- cron expression: daily at 20:00 UTC (3 AM Bangkok)
      $$
        INSERT INTO data_retention_log (retention_days, total_rows_deleted, details, run_duration_ms)
        SELECT
          90,
          SUM(rows_deleted),
          jsonb_object_agg(table_name, rows_deleted),
          EXTRACT(EPOCH FROM (clock_timestamp() - NOW())) * 1000
        FROM cleanup_old_data(90);
      $$
    );

    RAISE NOTICE 'pg_cron job scheduled: daily cleanup at 3 AM Bangkok time';
  ELSE
    RAISE NOTICE 'pg_cron not available - set up external cron job to run: SELECT * FROM cleanup_old_data(90);';
  END IF;
END;
$$;

-- Create a manual cleanup procedure for admins
CREATE OR REPLACE FUNCTION run_manual_cleanup(retention_days INT DEFAULT 90)
RETURNS TABLE(
  summary TEXT,
  total_deleted BIGINT,
  details JSONB
) AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  total_count BIGINT;
  details_json JSONB;
BEGIN
  start_time := clock_timestamp();

  -- Run cleanup and collect results
  SELECT
    SUM(rd.rows_deleted),
    jsonb_object_agg(rd.table_name, rd.rows_deleted)
  INTO total_count, details_json
  FROM cleanup_old_data(retention_days) rd;

  end_time := clock_timestamp();

  -- Log the cleanup
  INSERT INTO data_retention_log (retention_days, total_rows_deleted, details, run_duration_ms)
  VALUES (
    retention_days,
    total_count,
    details_json,
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
  );

  -- Return summary
  summary := format('Deleted %s rows older than %s days', total_count, retention_days);
  total_deleted := total_count;
  details := details_json;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- View to check cleanup history
CREATE OR REPLACE VIEW data_retention_history AS
SELECT
  id,
  run_at,
  retention_days,
  total_rows_deleted,
  details,
  pg_size_pretty(total_rows_deleted::BIGINT * 1024) AS estimated_space_freed,  -- rough estimate
  run_duration_ms || ' ms' AS duration
FROM data_retention_log
ORDER BY run_at DESC
LIMIT 30;

-- Add helpful comments
COMMENT ON FUNCTION cleanup_old_data IS
  'Deletes chat_messages, emotion_events, homework_events older than retention_days (default 90). Returns rows deleted per table.';

COMMENT ON FUNCTION run_manual_cleanup IS
  'Runs cleanup_old_data and logs results to data_retention_log. Use: SELECT * FROM run_manual_cleanup(90);';

COMMENT ON VIEW data_retention_history IS
  'Shows last 30 data retention cleanup runs with deleted row counts and duration.';

-- ── Update Migration Registry ────────────────────────────────────────────────

INSERT INTO schema_migrations (version) VALUES ('003_scheduled_cleanup')
  ON CONFLICT (version) DO NOTHING;

-- ── Usage Instructions ───────────────────────────────────────────────────────
-- Manual cleanup: SELECT * FROM run_manual_cleanup(90);
-- Check history:  SELECT * FROM data_retention_history;
-- View next runs: SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE '%jaikrajok%';
