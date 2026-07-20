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

CREATE POLICY "Admins can read credit ledger"
  ON public.credit_ledger
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own ledger"
  ON public.credit_ledger
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX credit_ledger_user_id_created_at_idx
  ON public.credit_ledger (user_id, created_at DESC);
CREATE INDEX credit_ledger_created_at_idx
  ON public.credit_ledger (created_at DESC);