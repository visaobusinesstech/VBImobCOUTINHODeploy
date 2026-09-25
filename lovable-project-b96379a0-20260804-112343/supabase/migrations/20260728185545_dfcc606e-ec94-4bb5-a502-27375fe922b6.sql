GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ai_config TO authenticated;
GRANT ALL ON public.user_ai_config TO service_role;

GRANT SELECT, INSERT, DELETE ON public.ai_config_test_log TO authenticated;
GRANT ALL ON public.ai_config_test_log TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.serper_usage_limits TO authenticated;
GRANT ALL ON public.serper_usage_limits TO service_role;

GRANT SELECT, INSERT ON public.serper_audit_logs TO authenticated;
GRANT ALL ON public.serper_audit_logs TO service_role;