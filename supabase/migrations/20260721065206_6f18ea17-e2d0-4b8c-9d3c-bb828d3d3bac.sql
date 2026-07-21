CREATE TABLE public.password_resets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_resets_token ON public.password_resets(token);
CREATE INDEX idx_password_resets_user ON public.password_resets(user_id);
GRANT ALL ON public.password_resets TO service_role;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;