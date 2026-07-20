DROP POLICY IF EXISTS "Public read cookies" ON public.session_cookies;
REVOKE SELECT ON public.session_cookies FROM anon;
CREATE POLICY "Admins can read cookies" ON public.session_cookies FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));