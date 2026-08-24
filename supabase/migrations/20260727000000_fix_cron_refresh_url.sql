-- The previous migration (20260726042826) accidentally pointed the
-- refresh-cookie-pool cron job at the "-dev" PREVIEW deployment URL
-- (https://project--...-dev.lovable.app) instead of the stable,
-- always-on production URL. Lovable's "-dev" preview instance is only
-- live while someone has the workspace/preview open in a browser, so
-- pg_cron's minutely HTTP call silently failed (or hit a sleeping
-- preview) whenever no one was looking at the site — which is exactly
-- why cookies only appeared to refresh "while the site was open"
-- (actually refreshed via the browser-driven admin panel poll / the
-- extension's /verify self-heal, not via this server-side cron job).
--
-- Point the job back at the stable production URL referenced by the
-- endpoint's own docs comment, so refreshes keep happening every
-- minute with zero browser tabs open.

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
    url := 'https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f.lovable.app/api/public/cron/refresh-cookies',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
