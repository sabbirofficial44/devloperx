ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;

UPDATE public.profiles
SET session_expires_at = now() + (credits * interval '1 minute')
WHERE session_expires_at IS NULL
  AND lower(coalesce(user_plan,'basic')) NOT IN ('unlimited','ultra','lifetime')
  AND credits > 0;

CREATE OR REPLACE FUNCTION public.sync_session_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.user_plan,'basic')) IN ('unlimited','ultra','lifetime') THEN
    NEW.session_expires_at := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.session_expires_at IS NULL AND coalesce(NEW.credits,0) > 0 THEN
      NEW.session_expires_at := now() + (NEW.credits * interval '1 minute');
    END IF;
    RETURN NEW;
  END IF;

  -- Internal drain writes tag themselves so they never restart the clock.
  IF coalesce(current_setting('dx.skip_expiry_sync', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.session_expires_at IS DISTINCT FROM OLD.session_expires_at THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.credits,0) IS DISTINCT FROM coalesce(OLD.credits,0)
     OR NEW.session_expires_at IS NULL THEN
    IF coalesce(NEW.credits,0) > 0 THEN
      NEW.session_expires_at := now() + (NEW.credits * interval '1 minute');
    ELSE
      NEW.session_expires_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_session_expiry ON public.profiles;
CREATE TRIGGER profiles_sync_session_expiry
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_session_expiry();

DROP FUNCTION IF EXISTS public.tick_trial_credits(uuid);

CREATE OR REPLACE FUNCTION public.tick_trial_credits(_user_id uuid)
RETURNS TABLE(credits bigint, plan text, last_tick_at timestamp with time zone, session_expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_plan text;
  cur_credits bigint;
  cur_expiry timestamptz;
  remaining bigint;
BEGIN
  SELECT user_plan, p.credits, p.session_expires_at
    INTO cur_plan, cur_credits, cur_expiry
  FROM public.profiles p WHERE p.user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM set_config('dx.skip_expiry_sync', '1', true);

  IF lower(coalesce(cur_plan,'basic')) IN ('unlimited','ultra','lifetime') THEN
    UPDATE public.profiles p SET last_tick_at = now() WHERE p.user_id = _user_id;
    RETURN QUERY SELECT cur_credits, cur_plan, now(), NULL::timestamptz;
    RETURN;
  END IF;

  IF cur_expiry IS NULL THEN
    IF coalesce(cur_credits,0) > 0 THEN
      cur_expiry := now() + (cur_credits * interval '1 minute');
    ELSE
      cur_expiry := now();
    END IF;
  END IF;

  remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (cur_expiry - now())) / 60))::bigint;

  UPDATE public.profiles p
     SET credits = remaining,
         session_expires_at = cur_expiry,
         last_tick_at = now(),
         trial_started_at = COALESCE(p.trial_started_at, now())
   WHERE p.user_id = _user_id;

  IF remaining <> coalesce(cur_credits,0) THEN
    INSERT INTO public.credit_ledger (user_id, amount, reason, source, balance_after)
    VALUES (_user_id, (remaining - coalesce(cur_credits,0))::int,
            'Session clock sync', 'session-clock', remaining);
  END IF;

  RETURN QUERY SELECT remaining, cur_plan, now(), cur_expiry;
END;
$$;