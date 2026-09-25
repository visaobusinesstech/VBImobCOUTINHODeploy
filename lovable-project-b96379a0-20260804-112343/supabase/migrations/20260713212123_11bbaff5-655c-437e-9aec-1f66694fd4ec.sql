
-- 1) Add public lead capture flag
ALTER TABLE public.imobiliaria_config
  ADD COLUMN IF NOT EXISTS lead_capture_publico boolean NOT NULL DEFAULT false;

-- 2) Replace overly permissive leads_anon_insert with a flag-gated policy
DROP POLICY IF EXISTS leads_anon_insert ON public.leads;
CREATE POLICY leads_anon_insert ON public.leads
  FOR INSERT TO anon
  WITH CHECK (
    nome IS NOT NULL
    AND char_length(nome) <= 200
    AND imobiliaria_id IS NOT NULL
    AND estagio = 'novos'
    AND EXISTS (
      SELECT 1 FROM public.imobiliaria_config ic
      WHERE ic.user_id = leads.imobiliaria_id
        AND ic.lead_capture_publico = true
    )
  );

-- 3) Drop redundant permissive policy on contatos_landing (contatos_anon_insert already covers anon inserts safely)
DROP POLICY IF EXISTS "Usuários inserem suas próprias extrações" ON public.contatos_landing;

-- 4) Fix mutable search_path on 5 functions
ALTER FUNCTION public.check_expiring_contracts() SET search_path = public;
ALTER FUNCTION public.handle_lead_stage_change_followup() SET search_path = public;
ALTER FUNCTION public.handle_new_lead_followup() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 5) Revoke EXECUTE from public/anon/authenticated on all trigger + internal helper functions.
-- RPCs kept executable: get_followup_counts, get_master_user_id, get_user_imobiliaria_id, restore_deleted_backup, has_role/is_master/is_approved/can_access_imobiliaria/owns_* (used by RLS).
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'auto_assign_lead_ludmila()',
    'backup_deleted_row()',
    'check_expiring_contracts()',
    'check_ip_abuse(text)',
    'cleanup_old_notifications()',
    'cleanup_old_serper_cache()',
    'generate_codigo_contrato()',
    'get_ai_usage_count(uuid,text)',
    'handle_lead_stage_change_followup()',
    'handle_new_lead_followup()',
    'handle_new_user()',
    'handle_subscription_change()',
    'handle_system_error_alert()',
    'handle_updated_at()',
    'log_auto_assign_lead_ludmila()',
    'on_contrato_auto_create_proprietario_captacao()',
    'on_contrato_created()',
    'on_contrato_created_transacao()',
    'on_contrato_updated_sync_transacao()',
    'on_lead_closed_complete_followups()',
    'on_lead_created()',
    'on_lead_created_followup()',
    'on_lead_created_notification()',
    'on_lead_stage_changed()',
    'on_proposta_status_changed()',
    'on_transacao_created_notification()',
    'prevent_legacy_estagio()',
    'protect_sensitive_profile_fields()',
    'set_lead_created_by()',
    'set_lead_imobiliaria_id()',
    'set_proposta_imobiliaria_id()',
    'set_updated_at_lista_capt()',
    'track_lead_activity()',
    'update_updated_at_column()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      -- skip missing overloads
      NULL;
    END;
  END LOOP;
END $$;

-- 6) Restrict listing on public buckets (files still accessible via direct URL)
DROP POLICY IF EXISTS "Public read imoveis" ON storage.objects;
DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view imoveis" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
