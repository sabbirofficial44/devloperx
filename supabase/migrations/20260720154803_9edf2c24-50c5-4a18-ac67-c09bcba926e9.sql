ALTER TABLE public.session_cookies
  ADD COLUMN IF NOT EXISTS gmail text,
  ADD COLUMN IF NOT EXISTS user_name text;