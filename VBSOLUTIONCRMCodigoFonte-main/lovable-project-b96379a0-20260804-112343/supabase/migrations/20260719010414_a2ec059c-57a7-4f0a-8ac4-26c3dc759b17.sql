
-- 1) Adiciona colunas de retenção
ALTER TABLE public.imobiliaria_config
  ADD COLUMN IF NOT EXISTS retention_firecrawl_cache_dias integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS retention_lista_proprietarios_dias integer NOT NULL DEFAULT 90;

ALTER TABLE public.imobiliaria_config
  ADD CONSTRAINT retention_firecrawl_cache_dias_range CHECK (retention_firecrawl_cache_dias BETWEEN 1 AND 3650);
ALTER TABLE public.imobiliaria_config
  ADD CONSTRAINT retention_lista_proprietarios_dias_range CHECK (retention_lista_proprietarios_dias BETWEEN 1 AND 3650);

-- 2) Função que aplica as políticas de retenção
CREATE OR REPLACE FUNCTION public.apply_data_retention_policies()
RETURNS TABLE(
  tenant_id uuid,
  firecrawl_deleted integer,
  proprietarios_deleted integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  v_fc_del integer;
  v_lp_del integer;
  v_total_fc integer := 0;
  v_total_lp integer := 0;
  v_tenants integer := 0;
BEGIN
  FOR cfg IN
    SELECT user_id,
           retention_firecrawl_cache_dias AS fc_days,
           retention_lista_proprietarios_dias AS lp_days
    FROM public.imobiliaria_config
  LOOP
    v_fc_del := 0;
    v_lp_del := 0;

    -- Cache Firecrawl é global (sem imobiliaria_id) — só apagamos uma vez, no primeiro tenant enquanto reter <= menor valor.
    -- Para simplificar e ser correto: aplicamos a política mais permissiva (maior nº de dias) fora do loop, abaixo.

    -- Lista de proprietários captação (por tenant)
    WITH del AS (
      DELETE FROM public.lista_proprietarios_captacao
       WHERE imobiliaria_id = cfg.user_id
         AND created_at < now() - make_interval(days => cfg.lp_days)
       RETURNING 1
    )
    SELECT count(*) INTO v_lp_del FROM del;

    v_total_lp := v_total_lp + v_lp_del;
    v_tenants := v_tenants + 1;

    tenant_id := cfg.user_id;
    firecrawl_deleted := 0;
    proprietarios_deleted := v_lp_del;
    RETURN NEXT;
  END LOOP;

  -- Cache Firecrawl é compartilhado: usa o MENOR período configurado entre todos os tenants.
  -- Se não houver configs, cai para 7 dias.
  WITH del_fc AS (
    DELETE FROM public.firecrawl_captacao_cache
     WHERE created_at < now() - make_interval(days => COALESCE(
              (SELECT MIN(retention_firecrawl_cache_dias) FROM public.imobiliaria_config),
              7
           ))
     RETURNING 1
  )
  SELECT count(*) INTO v_fc_del FROM del_fc;
  v_total_fc := v_fc_del;

  INSERT INTO public.system_logs (level, module, action, message, metadata)
  VALUES (
    'info', 'DataRetention', 'apply_policies',
    'Rotina de retenção de dados executada',
    jsonb_build_object(
      'tenants_processed', v_tenants,
      'firecrawl_deleted_total', v_total_fc,
      'lista_proprietarios_deleted_total', v_total_lp,
      'executed_at', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_data_retention_policies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_data_retention_policies() TO service_role;
