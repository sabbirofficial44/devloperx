CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if re-running
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-cookie-pool') THEN
    PERFORM cron.unschedule('refresh-cookie-pool');
  END IF;
END $$;

-- Every minute: hit our own public refresh endpoint so the cookie pool
-- stays fresh even when no admin panel is open and no extension pings.
SELECT cron.schedule(
  'refresh-cookie-pool',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://devloperx.lovable.app/api/public/cron/refresh-cookies',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);