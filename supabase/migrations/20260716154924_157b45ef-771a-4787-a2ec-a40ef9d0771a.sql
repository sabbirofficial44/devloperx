CREATE TABLE public.flow_settings (
  id integer PRIMARY KEY DEFAULT 1,
  credits bigint NOT NULL DEFAULT 99999,
  user_name text NOT NULL DEFAULT 'Flow User',
  user_plan text NOT NULL DEFAULT 'unlimited',
  cookie_version text NOT NULL DEFAULT '0',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flow_settings_singleton CHECK (id = 1)
);

GRANT SELECT ON public.flow_settings TO anon, authenticated;
GRANT ALL ON public.flow_settings TO service_role;

ALTER TABLE public.flow_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read flow settings"
  ON public.flow_settings FOR SELECT
  USING (true);

INSERT INTO public.flow_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;