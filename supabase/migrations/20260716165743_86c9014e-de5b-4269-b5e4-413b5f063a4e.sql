
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
CREATE POLICY "Admins can read created users" ON public.admin_created_users
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
