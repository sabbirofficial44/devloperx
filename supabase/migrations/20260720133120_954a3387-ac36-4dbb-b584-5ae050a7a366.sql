
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_tick_at timestamptz NOT NULL DEFAULT now();

-- Backfill: existing rows get now() (fresh baseline)
UPDATE public.profiles SET last_tick_at = now() WHERE last_tick_at IS NULL;

-- RPC: atomically decrement credits by minutes elapsed since last_tick_at, only for non-unlimited plans.
CREATE OR REPLACE FUNCTION public.tick_trial_credits(_user_id uuid)
RETURNS TABLE(credits bigint, plan text, last_tick_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elapsed_min int;
  cur_plan text;
  cur_credits bigint;
  cur_tick timestamptz;
BEGIN
  SELECT user_plan, profiles.credits, profiles.last_tick_at
    INTO cur_plan, cur_credits, cur_tick
  FROM public.profiles WHERE user_id = _user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF lower(coalesce(cur_plan,'basic')) IN ('unlimited','ultra','lifetime') THEN
    UPDATE public.profiles SET last_tick_at = now() WHERE user_id = _user_id;
    RETURN QUERY SELECT cur_credits, cur_plan, now();
    RETURN;
  END IF;

  elapsed_min := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - cur_tick)) / 60))::int;
  IF elapsed_min > 0 THEN
    cur_credits := GREATEST(0, cur_credits - elapsed_min);
    UPDATE public.profiles
       SET credits = cur_credits, last_tick_at = now()
     WHERE user_id = _user_id;
  END IF;

  RETURN QUERY SELECT cur_credits, cur_plan, now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.tick_trial_credits(uuid) TO service_role;
