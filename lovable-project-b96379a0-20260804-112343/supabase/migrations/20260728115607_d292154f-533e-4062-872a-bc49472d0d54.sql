-- Funções usadas em políticas de leitura pública precisam continuar executáveis por visitantes
GRANT EXECUTE ON FUNCTION public.can_access_imobiliaria(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO anon, authenticated;

-- Revoga execução direta de funções internas por usuários logados
DO $$
DECLARE
  r record;
  allowlist text[] := ARRAY[
    'ack_webhook_alert','aplicar_autopublicacao_seo','captacao_pipeline_metricas','captacao_pipeline_move',
    'captacao_pipeline_sla_pendentes','condo_prosp_agendamento_concluir','find_dedup_groups_by_phone',
    'get_followup_counts','get_master_user_id','get_user_imobiliaria_id','ignore_dedup_group',
    'leads_ativos_por_corretor','lgpd_metricas_imobiliaria','list_retention_exceptions','log_rls_denied_attempt',
    'merge_dedup_group','pipeline_estagios_reorder','pipeline_estagios_seed_defaults','processar_captacao_followups',
    'recalcular_motivacao_proprietarios','record_retention_simulation','register_whatsapp_contato_captacao',
    'resolve_webhook_alert','rz_reprocessar_scores','seed_automacao_followup_defaults','set_sw_cleanup_disabled',
    'simulate_data_retention_policies','get_ai_usage_count',
    -- usadas dentro de políticas RLS / outras funções
    'can_access_imobiliaria','is_approved','is_master','owns_corretor','owns_contrato_file',
    'pode_aprovar_captacao','has_role','plano_limite','normalize_phone','normalize_phone_digits',
    'normalize_phone_e164','normalize_reference_url','is_lista_proprietario_retention_exception'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND pg_get_function_result(p.oid) <> 'trigger'
      AND NOT (p.proname = ANY(allowlist))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;