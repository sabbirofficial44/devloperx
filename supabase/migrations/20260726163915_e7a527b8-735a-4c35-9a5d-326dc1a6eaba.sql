CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_lookup_idx ON public.rate_limits (bucket, key, created_at DESC);

GRANT ALL ON public.rate_limits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limits_id_seq TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies: only server-side privileged code (service_role) may touch this table.
