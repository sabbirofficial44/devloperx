
CREATE TABLE public.prompt_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.prompt_history TO authenticated;
GRANT ALL ON public.prompt_history TO service_role;
ALTER TABLE public.prompt_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prompts select" ON public.prompt_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own prompts insert" ON public.prompt_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prompts delete" ON public.prompt_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX prompt_history_user_created ON public.prompt_history(user_id, created_at DESC);

CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read active announcements" ON public.announcements FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "admins manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.announcements (title, body, kind) VALUES
  ('Welcome to DeveloperX 🎉', 'Enjoy your 5-hour free trial. Contact admin on WhatsApp to upgrade any time.', 'info'),
  ('New: Veo 3.5 Pro model', 'Veo 3.5 Pro is now the default model — auto-selected in every generation.', 'success');
