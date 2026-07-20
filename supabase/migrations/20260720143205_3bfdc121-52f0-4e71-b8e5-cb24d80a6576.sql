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
    INSERT INTO public.profiles (user_id, email, display_name, user_plan, credits)
    VALUES (NEW.id, NEW.email,
            COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
            'unlimited', 99999)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    -- Regular signup = basic plan, 12-hour trial (720 credits @ 1 credit/min)
    INSERT INTO public.profiles (user_id, email, display_name, user_plan, credits)
    VALUES (NEW.id, NEW.email,
            COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
            'basic', 720)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.credit_ledger (user_id, amount, reason, source, balance_after)
    VALUES (NEW.id, 720, 'Free 12-hour trial granted on signup', 'signup', 720);
  END IF;

  RETURN NEW;
END;
$function$;