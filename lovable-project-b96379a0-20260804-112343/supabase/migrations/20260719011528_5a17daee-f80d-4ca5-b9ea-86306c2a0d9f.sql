
CREATE OR REPLACE FUNCTION public.simulate_data_retention_policies(
  _webhook_raw_retention_days integer DEFAULT 90,
  _webhook_daily_retention_days integer DEFAULT 730
)
RETURNS TABLE(
  politica text,
  entidade text,
  tenant_id uuid,
  criterio text,
  quantidade integer,
  exemplos jsonb,
  simulated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cfg RECORD;
  v_now timestamptz := now();
  v_count integer;
  v_examples jsonb;
  v_fc_days integer;
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  -- Por tenant: Lista de Proprietários
  FOR cfg IN
    SELECT user_id,
           retention_firecrawl_cache_dias AS fc_days,
           retention_lista_proprietarios_dias AS lp_days
    FROM public.imobiliaria_config
  LOOP
    SELECT count(*)::integer INTO v_count
      FROM public.lista_proprietarios_captacao
     WHERE imobiliaria_id = cfg.user_id
       AND created_at < v_now - make_interval(days => cfg.lp_days);

    IF v_count > 0 THEN
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_examples FROM (
        SELECT id, created_at, nome
          FROM public.lista_proprietarios_captacao
         WHERE imobiliaria_id = cfg.user_id
           AND created_at < v_now - make_interval(days => cfg.lp_days)
         ORDER BY created_at ASC
         LIMIT 5
      ) x;
    ELSE
      v_examples := '[]'::jsonb;
    END IF;

    politica := 'Retenção de Lista de Proprietários';
    entidade := 'lista_proprietarios_captacao';
    tenant_id := cfg.user_id;
    criterio := 'created_at < now() - ' || cfg.lp_days || ' dias';
    quantidade := v_count;
    exemplos := v_examples;
    simulated_at := v_now;
    RETURN NEXT;
  END LOOP;

  -- Global: Firecrawl Cache (usa o MENOR retention configurado; casa com o comportamento atual da rotina)
  v_fc_days := COALESCE(
    (SELECT MIN(retention_firecrawl_cache_dias) FROM public.imobiliaria_config),
    7
  );

  SELECT count(*)::integer INTO v_count
    FROM public.firecrawl_captacao_cache
   WHERE created_at < v_now - make_interval(days => v_fc_days);

  IF v_count > 0 THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_examples FROM (
      SELECT id, created_at, cache_key
        FROM public.firecrawl_captacao_cache
       WHERE created_at < v_now - make_interval(days => v_fc_days)
       ORDER BY created_at ASC
       LIMIT 5
    ) x;
  ELSE
    v_examples := '[]'::jsonb;
  END IF;

  politica := 'Retenção de Cache Firecrawl';
  entidade := 'firecrawl_captacao_cache';
  tenant_id := NULL;
  criterio := 'created_at < now() - ' || v_fc_days || ' dias';
  quantidade := v_count;
  exemplos := v_examples;
  simulated_at := v_now;
  RETURN NEXT;

  -- Webhook Metrics (raw)
  SELECT count(*)::integer INTO v_count
    FROM public.webhook_metrics
   WHERE created_at < v_now - make_interval(days => _webhook_raw_retention_days);

  politica := 'Retenção de Métricas de Webhook (raw)';
  entidade := 'webhook_metrics';
  tenant_id := NULL;
  criterio := 'created_at < now() - ' || _webhook_raw_retention_days || ' dias';
  quantidade := v_count;
  exemplos := '[]'::jsonb;
  simulated_at := v_now;
  RETURN NEXT;

  -- Webhook Metrics Daily
  SELECT count(*)::integer INTO v_count
    FROM public.webhook_metrics_daily
   WHERE bucket_date < (v_now - make_interval(days => _webhook_daily_retention_days))::date;

  politica := 'Retenção de Métricas de Webhook (daily)';
  entidade := 'webhook_metrics_daily';
  tenant_id := NULL;
  criterio := 'bucket_date < today - ' || _webhook_daily_retention_days || ' dias';
  quantidade := v_count;
  exemplos := '[]'::jsonb;
  simulated_at := v_now;
  RETURN NEXT;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.simulate_data_retention_policies(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simulate_data_retention_policies(integer, integer) TO authenticated;
