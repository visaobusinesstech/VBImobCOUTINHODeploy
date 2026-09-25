
CREATE TABLE IF NOT EXISTS public.webhook_metrics_hourly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_hour timestamptz NOT NULL,
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
  UNIQUE (bucket_hour, imobiliaria_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_webhook_metrics_hourly_tenant
  ON public.webhook_metrics_hourly (imobiliaria_id, provider, bucket_hour DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_metrics_hourly_bucket
  ON public.webhook_metrics_hourly (bucket_hour DESC);

GRANT SELECT ON public.webhook_metrics_hourly TO authenticated;
GRANT ALL ON public.webhook_metrics_hourly TO service_role;

ALTER TABLE public.webhook_metrics_hourly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_own_webhook_metrics_hourly"
  ON public.webhook_metrics_hourly
  FOR SELECT TO authenticated
  USING (imobiliaria_id IS NOT NULL AND public.can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "service_role_full_webhook_metrics_hourly"
  ON public.webhook_metrics_hourly
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Idempotent refresh: reaggregates last N hours (default 3h) with UPSERT
CREATE OR REPLACE FUNCTION public.webhook_metrics_hourly_refresh(
  _since_hours integer DEFAULT 3
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_since timestamptz := date_trunc('hour', now() - make_interval(hours => GREATEST(_since_hours, 1)));
  v_rows integer := 0;
BEGIN
  WITH src AS (
    SELECT
      date_trunc('hour', created_at)                     AS bucket_hour,
      imobiliaria_id,
      provider,
      count(*)                                           AS total_events,
      count(*) FILTER (WHERE outcome = 'allowed')        AS allowed_events,
      count(*) FILTER (WHERE outcome = 'denied')         AS denied_events,
      count(*) FILTER (WHERE cache_hit)                  AS cache_hits,
      COALESCE(SUM(keys_loaded), 0)::bigint              AS keys_loaded_sum,
      COALESCE(SUM(keys_tested), 0)::bigint              AS keys_tested_sum,
      COALESCE(SUM(validation_ms), 0)::numeric           AS validation_ms_sum,
      COALESCE(MAX(validation_ms), 0)::numeric           AS validation_ms_max
    FROM public.webhook_metrics
    WHERE created_at >= v_since
    GROUP BY 1, 2, 3
  ),
  ups AS (
    INSERT INTO public.webhook_metrics_hourly AS h (
      bucket_hour, imobiliaria_id, provider,
      total_events, allowed_events, denied_events,
      cache_hits, keys_loaded_sum, keys_tested_sum,
      validation_ms_sum, validation_ms_max
    )
    SELECT bucket_hour, imobiliaria_id, provider,
           total_events, allowed_events, denied_events,
           cache_hits, keys_loaded_sum, keys_tested_sum,
           validation_ms_sum, validation_ms_max
    FROM src
    ON CONFLICT (bucket_hour, imobiliaria_id, provider) DO UPDATE
      SET total_events      = EXCLUDED.total_events,
          allowed_events    = EXCLUDED.allowed_events,
          denied_events     = EXCLUDED.denied_events,
          cache_hits        = EXCLUDED.cache_hits,
          keys_loaded_sum   = EXCLUDED.keys_loaded_sum,
          keys_tested_sum   = EXCLUDED.keys_tested_sum,
          validation_ms_sum = EXCLUDED.validation_ms_sum,
          validation_ms_max = EXCLUDED.validation_ms_max,
          updated_at        = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_rows FROM ups;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_metrics_hourly_refresh(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_metrics_hourly_refresh(integer) TO service_role;

-- Initial backfill (last 90 days)
SELECT public.webhook_metrics_hourly_refresh(24 * 90);
