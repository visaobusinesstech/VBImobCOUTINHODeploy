-- Enable RLS for all public tables
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

-- Restrict batch_exports
DROP POLICY IF EXISTS "Public access to exports" ON public.batch_exports;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'batch_exports') THEN
        CREATE POLICY "Users can see their own exports" ON public.batch_exports
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Restrict system_logs
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.system_logs;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'system_logs') THEN
        CREATE POLICY "Users can insert their own logs" ON public.system_logs
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Set search_path for SECURITY DEFINER functions to prevent hijacking
ALTER FUNCTION public.can_access_imobiliaria(user_id uuid) SET search_path = public;
ALTER FUNCTION public.is_approved(user_id uuid) SET search_path = public;
ALTER FUNCTION public.get_ai_usage_count(u_id uuid, p_name text) SET search_path = public;
ALTER FUNCTION public.get_master_user_id() SET search_path = public;
ALTER FUNCTION public.cleanup_old_notifications() SET search_path = public;
ALTER FUNCTION public.on_proposta_status_changed() SET search_path = public;
ALTER FUNCTION public.check_ip_abuse(client_ip text) SET search_path = public;
ALTER FUNCTION public.track_lead_activity() SET search_path = public;
ALTER FUNCTION public.on_transacao_created_notification() SET search_path = public;
ALTER FUNCTION public.is_master(user_id uuid) SET search_path = public;
ALTER FUNCTION public.restore_deleted_backup(backup_id uuid) SET search_path = public;
ALTER FUNCTION public.owns_corretor(corretor_id uuid) SET search_path = public;
ALTER FUNCTION public.on_contrato_auto_create_proprietario_captacao() SET search_path = public;
ALTER FUNCTION public.on_lead_closed_complete_followups() SET search_path = public;
ALTER FUNCTION public.on_contrato_created() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.on_lead_created_notification() SET search_path = public;
ALTER FUNCTION public.on_lead_created_followup() SET search_path = public;
ALTER FUNCTION public.handle_subscription_change() SET search_path = public;
ALTER FUNCTION public.owns_contrato_file(file_path text) SET search_path = public;
ALTER FUNCTION public.generate_codigo_contrato() SET search_path = public;
ALTER FUNCTION public.protect_sensitive_profile_fields() SET search_path = public;
ALTER FUNCTION public.get_user_imobiliaria_id() SET search_path = public;
ALTER FUNCTION public.on_contrato_updated_sync_transacao() SET search_path = public;
ALTER FUNCTION public.on_contrato_created_transacao() SET search_path = public;
ALTER FUNCTION public.on_lead_stage_changed() SET search_path = public;
ALTER FUNCTION public.on_lead_created() SET search_path = public;
ALTER FUNCTION public.backup_deleted_row() SET search_path = public;
ALTER FUNCTION public.handle_system_error_alert() SET search_path = public;