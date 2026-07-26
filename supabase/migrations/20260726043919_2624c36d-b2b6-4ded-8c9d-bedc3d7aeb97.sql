
CREATE TABLE public.alert_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_log_kind_time ON public.alert_log (kind, created_at DESC);
GRANT ALL ON public.alert_log TO service_role;
ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin can read alert log" ON public.alert_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
