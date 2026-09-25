
REVOKE ALL ON FUNCTION public.cron_log_start(text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cron_log_finish(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_log_start(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_log_finish(uuid, text, text, jsonb) TO service_role;
