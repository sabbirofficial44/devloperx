
-- credit_ledger: admin-only writes (server uses service_role, bypasses RLS)
CREATE POLICY "Admins can insert credit ledger" ON public.credit_ledger FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update credit ledger" ON public.credit_ledger FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete credit ledger" ON public.credit_ledger FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- email_verifications: admin-only read; writes go through service_role only
CREATE POLICY "Admins can read email verifications" ON public.email_verifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- session_cookies: admin-only writes
CREATE POLICY "Admins can insert cookies" ON public.session_cookies FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update cookies" ON public.session_cookies FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete cookies" ON public.session_cookies FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Restrict SECURITY DEFINER helper functions from anon; keep authenticated + service_role where needed
REVOKE EXECUTE ON FUNCTION public.start_trial_if_needed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tick_trial_credits(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_trial_if_needed(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tick_trial_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
