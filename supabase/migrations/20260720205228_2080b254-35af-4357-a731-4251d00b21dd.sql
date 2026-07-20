
CREATE TABLE public.site_settings (
  id integer PRIMARY KEY DEFAULT 1,
  contact_number text,
  whatsapp_number text,
  bkash_number text,
  telegram_url text,
  offer_text text,
  plans jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update site settings" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Tighten SECURITY DEFINER helper exposure
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tick_trial_credits(uuid) FROM PUBLIC, anon;

-- Create default admin user (admin@gmail.com / admin1122)
DO $$
DECLARE
  new_uid uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@gmail.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
      'admin@gmail.com', crypt('admin1122', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Admin"}'::jsonb, false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_uid,
      jsonb_build_object('sub', new_uid::text, 'email', 'admin@gmail.com', 'email_verified', true),
      'email', new_uid::text, now(), now(), now());
  END IF;
END $$;

-- Ensure admin role + unlimited profile for the admin user (in case trigger picked wrong plan)
INSERT INTO public.profiles (user_id, email, display_name, user_plan, credits)
SELECT id, email, 'Admin', 'unlimited', 99999 FROM auth.users WHERE email='admin@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET user_plan='unlimited', credits=99999;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email='admin@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
