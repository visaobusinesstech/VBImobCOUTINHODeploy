
-- Aggregated rollup table (daily per tenant/provider)
CREATE TABLE IF NOT EXISTS public.webhook_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_date date NOT NULL,
  imobiliaria_id uuid,
  provider text NOT NULL,
  total_events integer NOT NULL DEFAULT 0,
  allowed_events integer NOT NULL DEFAULT 0,
  denied_events integer NOT NULL DEFAULT 0,
  cache_hits integer NOT NULL DEFAULT 0,
  keys_loaded_sum bigint NOT NULL DEFAULT 0,
  keys_tested_sum bigint NOT NULL DEFAULT 0,
  validation_ms_sum numeric(18,3) NOT NULL DEFAULT 0,
  validation_ms_max numeric(10,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_date, imobiliaria_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_webhook_metrics_daily_tenant
  ON public.webhook_metrics_daily (imobiliaria_id, provider, bucket_date DESC);

GRANT SELECT ON public.webhook_metrics_daily TO authenticated;
GRANT ALL ON public.webhook_metrics_daily TO service_role;

ALTER TABLE public.webhook_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_own_webhook_metrics_daily"
  ON public.webhook_metrics_daily
  FOR SELECT TO authenticated
  USING (imobiliaria_id IS NOT NULL AND public.can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "service_role_full_webhook_metrics_daily"
  ON public.webhook_metrics_daily
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Retention parameters (defaults)
--   raw retention: 90 days
--   daily aggregate retention: 730 days
CREATE OR REPLACE FUNCTION public.webhook_metrics_retention(
  _raw_retention_days integer DEFAULT 90,
  _daily_retention_days integer DEFAULT 730
)
RETURNS TABLE(rollup_rows integer, deleted_raw integer, deleted_daily integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => _raw_retention_days);
  v_daily_cutoff date := (now() - make_interval(days => _daily_retention_days))::date;
  v_rollup integer := 0;
  v_del_raw integer := 0;
  v_del_daily integer := 0;
BEGIN
  -- 1) Upsert daily aggregates for anything older than the raw cutoff
  WITH src AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS bucket_date,
      imobiliaria_id,
      provider,
      count(*)                                              AS total_events,
      count(*) FILTER (WHERE outcome = 'allowed')           AS allowed_events,
      count(*) FILTER (WHERE outcome = 'denied')            AS denied_events,
      count(*) FILTER (WHERE cache_hit)                     AS cache_hits,
      COALESCE(SUM(keys_loaded), 0)::bigint                 AS keys_loaded_sum,
      COALESCE(SUM(keys_tested), 0)::bigint                 AS keys_tested_sum,
      COALESCE(SUM(validation_ms), 0)::numeric              AS validation_ms_sum,
      COALESCE(MAX(validation_ms), 0)::numeric              AS validation_ms_max
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

  -- 2) Delete raw rows already rolled up
  WITH del AS (
    DELETE FROM public.webhook_metrics
     WHERE created_at < v_cutoff
     RETURNING 1
  )
  SELECT count(*) INTO v_del_raw FROM del;

  -- 3) Prune very old daily aggregates
  WITH del2 AS (
    DELETE FROM public.webhook_metrics_daily
     WHERE bucket_date < v_daily_cutoff
     RETURNING 1
  )
  SELECT count(*) INTO v_del_daily FROM del2;

  INSERT INTO public.system_logs (level, module, action, message, metadata)
  VALUES (
    'info', 'WebhookMetrics', 'retention',
    'Rotina de retenção executada',
    jsonb_build_object(
      'raw_retention_days', _raw_retention_days,
      'daily_retention_days', _daily_retention_days,
      'rollup_rows', v_rollup,
      'deleted_raw', v_del_raw,
      'deleted_daily', v_del_daily,
      'executed_at', now()
    )
  );

  RETURN QUERY SELECT v_rollup, v_del_raw, v_del_daily;
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_metrics_retention(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_metrics_retention(integer, integer) TO service_role;
