
-- =====================================================================
-- CRON EXECUÇÕES LOG
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.cron_execucoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  status text NOT NULL DEFAULT 'executando' CHECK (status IN ('sucesso','falha','executando','skipped')),
  message text,
  servidor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_execucoes_log_started_at ON public.cron_execucoes_log (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_execucoes_log_job_name ON public.cron_execucoes_log (job_name);
CREATE INDEX IF NOT EXISTS idx_cron_execucoes_log_status ON public.cron_execucoes_log (status);

GRANT SELECT ON public.cron_execucoes_log TO authenticated;
GRANT ALL ON public.cron_execucoes_log TO service_role;

ALTER TABLE public.cron_execucoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master vê todos cron logs"
  ON public.cron_execucoes_log FOR SELECT
  TO authenticated
  USING (public.is_master(auth.uid()));

CREATE TRIGGER trg_cron_execucoes_log_updated_at
  BEFORE UPDATE ON public.cron_execucoes_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- RETENTION DELETION LOG
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.retention_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  entidade text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  politica text NOT NULL,
  criterio text,
  mecanismo text NOT NULL DEFAULT 'Sistema de Retenção Automática',
  tenant_id uuid,
  cron_execucao_id uuid REFERENCES public.cron_execucoes_log(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_deletion_log_deleted_at ON public.retention_deletion_log (deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_deletion_log_entidade ON public.retention_deletion_log (entidade);
CREATE INDEX IF NOT EXISTS idx_retention_deletion_log_politica ON public.retention_deletion_log (politica);

GRANT SELECT ON public.retention_deletion_log TO authenticated;
GRANT ALL ON public.retention_deletion_log TO service_role;

ALTER TABLE public.retention_deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master vê todos os logs de retenção"
  ON public.retention_deletion_log FOR SELECT
  TO authenticated
  USING (public.is_master(auth.uid()));

-- =====================================================================
-- Helpers
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cron_log_start(_job_name text, _servidor text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.cron_execucoes_log (job_name, servidor, metadata)
  VALUES (_job_name, _servidor, COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cron_log_finish(_id uuid, _status text, _message text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_started timestamptz; v_now timestamptz := now();
BEGIN
  IF _status NOT IN ('sucesso','falha','executando','skipped') THEN
    RAISE EXCEPTION 'status invalido: %', _status USING ERRCODE = '22023';
  END IF;
  SELECT started_at INTO v_started FROM public.cron_execucoes_log WHERE id = _id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.cron_execucoes_log
     SET status = _status,
         finished_at = v_now,
         duration_ms = GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_started))*1000)::integer,
         message = COALESCE(_message, message),
         metadata = metadata || COALESCE(_metadata,'{}'::jsonb),
         updated_at = v_now
   WHERE id = _id;
END;
$$;

-- =====================================================================
-- Reescreve retention para logar
-- =====================================================================
CREATE OR REPLACE FUNCTION public.apply_data_retention_policies()
RETURNS TABLE(tenant_id uuid, firecrawl_deleted integer, proprietarios_deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  cfg RECORD;
  v_fc_del integer;
  v_lp_del integer;
  v_total_fc integer := 0;
  v_total_lp integer := 0;
  v_tenants integer := 0;
  v_cron_id uuid;
  v_fc_days integer;
BEGIN
  v_cron_id := public.cron_log_start('apply_data_retention_policies', 'pg_cron');

  BEGIN
    FOR cfg IN
      SELECT user_id,
             retention_firecrawl_cache_dias AS fc_days,
             retention_lista_proprietarios_dias AS lp_days
      FROM public.imobiliaria_config
    LOOP
      v_lp_del := 0;

      WITH del AS (
        DELETE FROM public.lista_proprietarios_captacao
         WHERE imobiliaria_id = cfg.user_id
           AND created_at < now() - make_interval(days => cfg.lp_days)
         RETURNING 1
      )
      SELECT count(*) INTO v_lp_del FROM del;

      IF v_lp_del > 0 THEN
        INSERT INTO public.retention_deletion_log (
          entidade, quantidade, politica, criterio, mecanismo, tenant_id, cron_execucao_id, metadata
        ) VALUES (
          'lista_proprietarios_captacao', v_lp_del,
          'Retenção de Lista de Proprietários',
          'mais antigos que ' || cfg.lp_days || ' dias',
          'Sistema de Retenção Automática',
          cfg.user_id, v_cron_id,
          jsonb_build_object('retention_days', cfg.lp_days)
        );
      END IF;

      v_total_lp := v_total_lp + v_lp_del;
      v_tenants := v_tenants + 1;

      tenant_id := cfg.user_id;
      firecrawl_deleted := 0;
      proprietarios_deleted := v_lp_del;
      RETURN NEXT;
    END LOOP;

    v_fc_days := COALESCE(
      (SELECT MIN(retention_firecrawl_cache_dias) FROM public.imobiliaria_config),
      7
    );

    WITH del_fc AS (
      DELETE FROM public.firecrawl_captacao_cache
       WHERE created_at < now() - make_interval(days => v_fc_days)
       RETURNING 1
    )
    SELECT count(*) INTO v_fc_del FROM del_fc;
    v_total_fc := v_fc_del;

    IF v_fc_del > 0 THEN
      INSERT INTO public.retention_deletion_log (
        entidade, quantidade, politica, criterio, mecanismo, cron_execucao_id, metadata
      ) VALUES (
        'firecrawl_captacao_cache', v_fc_del,
        'Retenção de Cache Firecrawl',
        'mais antigos que ' || v_fc_days || ' dias',
        'Sistema de Retenção Automática',
        v_cron_id,
        jsonb_build_object('retention_days', v_fc_days)
      );
    END IF;

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

    PERFORM public.cron_log_finish(
      v_cron_id, 'sucesso',
      'Tenants: ' || v_tenants || ' · Firecrawl: ' || v_total_fc || ' · Proprietários: ' || v_total_lp,
      jsonb_build_object(
        'tenants_processed', v_tenants,
        'firecrawl_deleted_total', v_total_fc,
        'lista_proprietarios_deleted_total', v_total_lp
      )
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.cron_log_finish(v_cron_id, 'falha', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
    RAISE;
  END;
END;
$function$;

-- =====================================================================
-- Reescreve webhook_metrics_retention para logar
-- =====================================================================
CREATE OR REPLACE FUNCTION public.webhook_metrics_retention(_raw_retention_days integer DEFAULT 90, _daily_retention_days integer DEFAULT 730)
RETURNS TABLE(rollup_rows integer, deleted_raw integer, deleted_daily integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => _raw_retention_days);
  v_daily_cutoff date := (now() - make_interval(days => _daily_retention_days))::date;
  v_rollup integer := 0;
  v_del_raw integer := 0;
  v_del_daily integer := 0;
  v_cron_id uuid;
BEGIN
  v_cron_id := public.cron_log_start(
    'webhook_metrics_retention', 'pg_cron',
    jsonb_build_object('raw_retention_days', _raw_retention_days, 'daily_retention_days', _daily_retention_days)
  );

  BEGIN
    WITH src AS (
      SELECT
        (created_at AT TIME ZONE 'UTC')::date AS bucket_date,
        imobiliaria_id, provider,
        count(*) AS total_events,
        count(*) FILTER (WHERE outcome = 'allowed') AS allowed_events,
        count(*) FILTER (WHERE outcome = 'denied') AS denied_events,
        count(*) FILTER (WHERE cache_hit) AS cache_hits,
        COALESCE(SUM(keys_loaded), 0)::bigint AS keys_loaded_sum,
        COALESCE(SUM(keys_tested), 0)::bigint AS keys_tested_sum,
        COALESCE(SUM(validation_ms), 0)::numeric AS validation_ms_sum,
        COALESCE(MAX(validation_ms), 0)::numeric AS validation_ms_max
      FROM public.webhook_metrics
      WHERE created_at < v_cutoff
      GROUP BY 1, 2, 3
    ),
    ins AS (
      INSERT INTO public.webhook_metrics_daily AS d (
        bucket_date, imobiliaria_id, provider,
        total_events, allowed_events, denied_events,
        cache_hits, keys_loaded_sum, keys_tested_sum,
        validation_ms_sum, validation_ms_max
      )
      SELECT bucket_date, imobiliaria_id, provider,
             total_events, allowed_events, denied_events,
             cache_hits, keys_loaded_sum, keys_tested_sum,
             validation_ms_sum, validation_ms_max
      FROM src
      ON CONFLICT (bucket_date, imobiliaria_id, provider) DO UPDATE
        SET total_events     = d.total_events     + EXCLUDED.total_events,
            allowed_events   = d.allowed_events   + EXCLUDED.allowed_events,
            denied_events    = d.denied_events    + EXCLUDED.denied_events,
            cache_hits       = d.cache_hits       + EXCLUDED.cache_hits,
            keys_loaded_sum  = d.keys_loaded_sum  + EXCLUDED.keys_loaded_sum,
            keys_tested_sum  = d.keys_tested_sum  + EXCLUDED.keys_tested_sum,
            validation_ms_sum = d.validation_ms_sum + EXCLUDED.validation_ms_sum,
            validation_ms_max = GREATEST(d.validation_ms_max, EXCLUDED.validation_ms_max),
            updated_at = now()
      RETURNING 1
    )
    SELECT count(*) INTO v_rollup FROM ins;

    WITH del AS (
      DELETE FROM public.webhook_metrics
       WHERE created_at < v_cutoff
       RETURNING 1
    )
    SELECT count(*) INTO v_del_raw FROM del;

    WITH del2 AS (
      DELETE FROM public.webhook_metrics_daily
       WHERE bucket_date < v_daily_cutoff
       RETURNING 1
    )
    SELECT count(*) INTO v_del_daily FROM del2;

    IF v_del_raw > 0 THEN
      INSERT INTO public.retention_deletion_log (entidade, quantidade, politica, criterio, mecanismo, cron_execucao_id, metadata)
      VALUES ('webhook_metrics', v_del_raw, 'Retenção de Métricas de Webhook (raw)',
              'mais antigas que ' || _raw_retention_days || ' dias', 'Sistema de Retenção Automática',
              v_cron_id, jsonb_build_object('rollup_rows', v_rollup));
    END IF;
    IF v_del_daily > 0 THEN
      INSERT INTO public.retention_deletion_log (entidade, quantidade, politica, criterio, mecanismo, cron_execucao_id, metadata)
      VALUES ('webhook_metrics_daily', v_del_daily, 'Retenção de Métricas de Webhook (daily)',
              'mais antigas que ' || _daily_retention_days || ' dias', 'Sistema de Retenção Automática',
              v_cron_id, '{}'::jsonb);
    END IF;

    INSERT INTO public.system_logs (level, module, action, message, metadata)
    VALUES (
      'info', 'WebhookMetrics', 'retention',
      'Rotina de retenção executada',
      jsonb_build_object(
        'raw_retention_days', _raw_retention_days,
        'daily_retention_days', _daily_retention_days,
        'rollup_rows', v_rollup, 'deleted_raw', v_del_raw, 'deleted_daily', v_del_daily,
        'executed_at', now()
      )
    );

    PERFORM public.cron_log_finish(
      v_cron_id, 'sucesso',
      'Rollup: ' || v_rollup || ' · Raw removidos: ' || v_del_raw || ' · Daily removidos: ' || v_del_daily,
      jsonb_build_object('rollup_rows', v_rollup, 'deleted_raw', v_del_raw, 'deleted_daily', v_del_daily)
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.cron_log_finish(v_cron_id, 'falha', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
    RAISE;
  END;

  RETURN QUERY SELECT v_rollup, v_del_raw, v_del_daily;
END;
$function$;

-- Backfill retroativo a partir de system_logs (para não abrir a tela vazia)
INSERT INTO public.cron_execucoes_log (job_name, started_at, finished_at, duration_ms, status, message, servidor, metadata)
SELECT
  CASE module
    WHEN 'DataRetention' THEN 'apply_data_retention_policies'
    WHEN 'WebhookMetrics' THEN 'webhook_metrics_retention'
    ELSE lower(module) || '_' || action
  END AS job_name,
  created_at, created_at, 0, 'sucesso', message, 'pg_cron', COALESCE(metadata, '{}'::jsonb)
FROM public.system_logs
WHERE (module = 'DataRetention' AND action = 'apply_policies')
   OR (module = 'WebhookMetrics' AND action = 'retention')
ON CONFLICT DO NOTHING;
