REVOKE EXECUTE ON FUNCTION public.tick_trial_credits(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.tick_trial_credits(uuid) TO service_role;