
-- Ensure email_verifications has explicit user-scoped SELECT and blocks direct writes from authenticated/anon
-- Writes happen only via service_role in server functions.

-- Allow users to view only their own verification rows (owner scoped)
DROP POLICY IF EXISTS "Users can view own verifications" ON public.email_verifications;
CREATE POLICY "Users can view own verifications"
ON public.email_verifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Explicitly block INSERT/UPDATE/DELETE for authenticated and anon (service_role bypasses RLS)
DROP POLICY IF EXISTS "Block direct inserts on email_verifications" ON public.email_verifications;
CREATE POLICY "Block direct inserts on email_verifications"
ON public.email_verifications
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct updates on email_verifications" ON public.email_verifications;
CREATE POLICY "Block direct updates on email_verifications"
ON public.email_verifications
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct deletes on email_verifications" ON public.email_verifications;
CREATE POLICY "Block direct deletes on email_verifications"
ON public.email_verifications
FOR DELETE
TO authenticated, anon
USING (false);

-- user_roles: block privilege escalation by explicitly denying INSERT/UPDATE/DELETE
-- from authenticated and anon. Role changes only via service_role server functions.
DROP POLICY IF EXISTS "Block direct role inserts" ON public.user_roles;
CREATE POLICY "Block direct role inserts"
ON public.user_roles
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct role updates" ON public.user_roles;
CREATE POLICY "Block direct role updates"
ON public.user_roles
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Block direct role deletes" ON public.user_roles;
CREATE POLICY "Block direct role deletes"
ON public.user_roles
FOR DELETE
TO authenticated, anon
USING (false);
