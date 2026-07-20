-- ═══════════════════════════════════════════════
-- Veu Unlimited — Complete Database Migration
-- ═══════════════════════════════════════════════
-- Run this entire file in Supabase SQL Editor
-- ═══════════════════════════════════════════════

-- 1) app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2) user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3) has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

CREATE POLICY "Admins can read all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) profiles table
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  credits bigint NOT NULL DEFAULT 99999,
  user_plan text NOT NULL DEFAULT 'unlimited',
  assigned_cookies jsonb,
  cookies_rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) set_updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) auto-create profile + first user = admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_count int;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7) admin_created_users
CREATE TABLE public.admin_created_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  user_id uuid,
  email text NOT NULL,
  password text NOT NULL,
  display_name text,
  plan text,
  credits bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_created_users TO authenticated;
GRANT ALL ON public.admin_created_users TO service_role;
ALTER TABLE public.admin_created_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read created users" ON public.admin_created_users FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can insert created users" ON public.admin_created_users FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update created users" ON public.admin_created_users FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete created users" ON public.admin_created_users FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 8) session_cookies
CREATE TABLE public.session_cookies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cookies JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cookies INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.session_cookies TO authenticated;
GRANT ALL ON public.session_cookies TO service_role;
ALTER TABLE public.session_cookies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read cookies" ON public.session_cookies FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 9) credit_ledger
CREATE TABLE public.credit_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  balance_after bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read credit ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX credit_ledger_user_id_created_at_idx ON public.credit_ledger (user_id, created_at DESC);
CREATE INDEX credit_ledger_created_at_idx ON public.credit_ledger (created_at DESC);
