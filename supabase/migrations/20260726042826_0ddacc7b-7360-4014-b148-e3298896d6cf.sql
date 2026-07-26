DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-cookie-pool') THEN
    PERFORM cron.unschedule('refresh-cookie-pool');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-cookie-pool',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f-dev.lovable.app/api/public/cron/refresh-cookies',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);