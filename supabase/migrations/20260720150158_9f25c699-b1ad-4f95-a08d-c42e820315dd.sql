
CREATE TABLE public.site_settings (
  id int PRIMARY KEY DEFAULT 1,
  contact_number text NOT NULL DEFAULT '01410014442',
  whatsapp_number text NOT NULL DEFAULT '01410014442',
  bkash_number text NOT NULL DEFAULT '01775113977',
  telegram_url text NOT NULL DEFAULT 'https://t.me/DeveloperX',
  offer_text text NOT NULL DEFAULT '12 hours FREE trial daily · No card required',
  plans jsonb NOT NULL DEFAULT '[
    {"name":"FREE TRIAL","credits":"12 hr","duration":"daily free","price":"৳0","note":"auto renews daily","cta":"Start Free","free":true},
    {"name":"DAILY","credits":"24 hr","duration":"full-day access","price":"৳50","note":"complete 24 hours","cta":"Get Daily"},
    {"name":"WEEKLY","credits":"7 days","duration":"weekly access","price":"৳200","note":"full week unlimited","cta":"Get Weekly"},
    {"name":"MONTHLY","credits":"30 days","duration":"monthly access","price":"৳500","note":"Most popular","cta":"Get Monthly","featured":true},
    {"name":"PRO","credits":"365 days","duration":"1 full year","price":"৳2,000","note":"Best value yearly"},
    {"name":"UNLIMITED","credits":"∞","duration":"lifetime access","price":"৳5,000","note":"One-time payment"}
  ]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = 1)
);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER site_settings_set_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
