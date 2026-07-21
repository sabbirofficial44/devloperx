
-- Add trial_started_at to track when extension login timer began
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

-- Updated tick function: only ticks if trial_started_at is set (i.e., extension login happened)
CREATE OR REPLACE FUNCTION public.tick_trial_credits(_user_id uuid)
 RETURNS TABLE(credits bigint, plan text, last_tick_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  elapsed_min int;
  deducted int;
  cur_plan text;
  cur_credits bigint;
  cur_tick timestamptz;
  cur_started timestamptz;
BEGIN
  SELECT user_plan, profiles.credits, profiles.last_tick_at, profiles.trial_started_at
    INTO cur_plan, cur_credits, cur_tick, cur_started
  FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  -- Unlimited plans: no drain
  IF lower(coalesce(cur_plan,'basic')) IN ('unlimited','ultra','lifetime') THEN
    UPDATE public.profiles SET last_tick_at = now() WHERE user_id = _user_id;
    RETURN QUERY SELECT cur_credits, cur_plan, now();
    RETURN;
  END IF;

  -- Timer hasn't started: user has not logged into extension yet — no drain
  IF cur_started IS NULL THEN
    RETURN QUERY SELECT cur_credits, cur_plan, cur_tick;
    RETURN;
  END IF;

  elapsed_min := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - cur_tick)) / 60))::int;
  IF elapsed_min > 0 THEN
    deducted := LEAST(elapsed_min, cur_credits::int);
    cur_credits := GREATEST(0, cur_credits - elapsed_min);
    UPDATE public.profiles SET credits = cur_credits, last_tick_at = now() WHERE user_id = _user_id;
    IF deducted > 0 THEN
      INSERT INTO public.credit_ledger (user_id, amount, reason, source, balance_after)
      VALUES (_user_id, -deducted, format('Auto trial drain (%s min)', deducted), 'trial-tick', cur_credits);
    END IF;
  END IF;
  RETURN QUERY SELECT cur_credits, cur_plan, now();
END;
$function$;

-- Function called on first extension login to start the timer
CREATE OR REPLACE FUNCTION public.start_trial_if_needed(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET trial_started_at = now(), last_tick_at = now()
  WHERE user_id = _user_id AND trial_started_at IS NULL;
END;
$function$;
