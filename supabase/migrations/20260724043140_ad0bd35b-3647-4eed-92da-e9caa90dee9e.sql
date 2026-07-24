CREATE TABLE public.video_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text,
  video_url text,
  thumbnail_url text,
  model text,
  status text NOT NULL DEFAULT 'completed',
  source text NOT NULL DEFAULT 'flow',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.video_history TO authenticated;
GRANT ALL ON public.video_history TO service_role;
ALTER TABLE public.video_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own videos select" ON public.video_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own videos insert" ON public.video_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own videos delete" ON public.video_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX video_history_user_created_idx ON public.video_history (user_id, created_at DESC);
CREATE UNIQUE INDEX video_history_user_ext_idx ON public.video_history (user_id, external_id) WHERE external_id IS NOT NULL;