ALTER TABLE public.alert_log
  ADD COLUMN IF NOT EXISTS email_ok boolean,
  ADD COLUMN IF NOT EXISTS slack_ok boolean,
  ADD COLUMN IF NOT EXISTS subject text;