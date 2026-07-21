CREATE POLICY "Block direct select on password_resets" ON public.password_resets FOR SELECT TO authenticated, anon USING (false);
CREATE POLICY "Block direct insert on password_resets" ON public.password_resets FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Block direct update on password_resets" ON public.password_resets FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Block direct delete on password_resets" ON public.password_resets FOR DELETE TO authenticated, anon USING (false);