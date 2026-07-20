CREATE TABLE public.session_cookies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cookies JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cookies INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.session_cookies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_cookies TO authenticated;
GRANT ALL ON public.session_cookies TO service_role;
ALTER TABLE public.session_cookies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cookies" ON public.session_cookies FOR SELECT TO anon, authenticated USING (true);