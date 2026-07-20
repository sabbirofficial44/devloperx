
-- Change new signups to a 5-hour (300 credit) basic trial.
-- First user still becomes admin with unlimited credits.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE user_count int;
BEGIN
  SELECT count(*) INTO user_count FROM public.user_roles;

  IF user_count = 0 THEN
    -- First user = admin, unlimited access
    INSERT INTO public.profiles (user_id, email, display_name, user_plan, credits)
    VALUES (NEW.id, NEW.email,
            COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
            'unlimited', 99999)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    -- Regular signup = basic plan, 5-hour trial (300 credits @ 1 credit/min)
    INSERT INTO public.profiles (user_id, email, display_name, user_plan, credits)
    VALUES (NEW.id, NEW.email,
            COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
            'basic', 300)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Ledger entry for the trial grant
    INSERT INTO public.credit_ledger (user_id, amount, reason, source, balance_after)
    VALUES (NEW.id, 300, 'Free 5-hour trial granted on signup', 'signup', 300);
  END IF;

  RETURN NEW;
END;
$function$;
