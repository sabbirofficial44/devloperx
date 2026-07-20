ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_cookies jsonb,
  ADD COLUMN IF NOT EXISTS cookies_rotated_at timestamptz;