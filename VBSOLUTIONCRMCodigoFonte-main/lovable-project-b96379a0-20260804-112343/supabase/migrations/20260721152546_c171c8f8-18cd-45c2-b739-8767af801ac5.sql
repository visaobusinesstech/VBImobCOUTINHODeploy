
ALTER TABLE public.extraction_logs
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS error_code TEXT;

CREATE INDEX IF NOT EXISTS idx_extraction_logs_http_status
  ON public.extraction_logs(http_status) WHERE status = 'error';
CREATE INDEX IF NOT EXISTS idx_extraction_logs_created_status
  ON public.extraction_logs(created_at DESC, status);

CREATE TABLE IF NOT EXISTS public.extraction_failure_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  function_name TEXT NOT NULL DEFAULT 'extrair-dados-anuncio',
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  failure_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  failure_rate NUMERIC(5,2) NOT NULL,
  threshold INTEGER NOT NULL,
  sample_errors JSONB DEFAULT '[]'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.extraction_failure_alerts TO authenticated;
GRANT ALL ON public.extraction_failure_alerts TO service_role;
ALTER TABLE public.extraction_failure_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters can view alerts" ON public.extraction_failure_alerts;
CREATE POLICY "Masters can view alerts"
  ON public.extraction_failure_alerts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_master));

DROP POLICY IF EXISTS "Masters can update alerts" ON public.extraction_failure_alerts;
CREATE POLICY "Masters can update alerts"
  ON public.extraction_failure_alerts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_master));

CREATE INDEX IF NOT EXISTS idx_extraction_alerts_created ON public.extraction_failure_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_alerts_unresolved ON public.extraction_failure_alerts(created_at DESC) WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.check_extracao_anuncio_spikes(
  _window_minutes INTEGER DEFAULT 15,
  _threshold_429 INTEGER DEFAULT 5,
  _threshold_502 INTEGER DEFAULT 5,
  _threshold_total INTEGER DEFAULT 15
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start TIMESTAMPTZ := now() - make_interval(mins => _window_minutes);
  v_end   TIMESTAMPTZ := now();
  v_total INTEGER; v_err INTEGER; v_429 INTEGER; v_502 INTEGER;
  v_rate NUMERIC(5,2); v_samples JSONB;
  v_alerts JSONB := '[]'::jsonb;
  v_config RECORD;
  v_alert public.extraction_failure_alerts%ROWTYPE;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'error'),
    count(*) FILTER (WHERE status = 'error' AND (http_status = 429 OR error_code ILIKE '%429%' OR error_code = 'rate_limited')),
    count(*) FILTER (WHERE status = 'error' AND (http_status IN (502,503,504) OR error_code ILIKE '%502%' OR error_code ILIKE '%503%' OR error_code = 'upstream_error'))
  INTO v_total, v_err, v_429, v_502
  FROM public.extraction_logs
  WHERE created_at BETWEEN v_start AND v_end;

  v_rate := CASE WHEN COALESCE(v_total,0) = 0 THEN 0 ELSE ROUND((v_err::numeric / v_total) * 100, 2) END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'url', source_url, 'portal', portal, 'error_message', error_message,
    'http_status', http_status, 'error_code', error_code, 'created_at', created_at
  )), '[]'::jsonb)
    INTO v_samples
    FROM (
      SELECT source_url, portal, error_message, http_status, error_code, created_at
        FROM public.extraction_logs
       WHERE status = 'error' AND created_at BETWEEN v_start AND v_end
       ORDER BY created_at DESC LIMIT 5
    ) s;

  FOR v_config IN
    SELECT * FROM (VALUES
      ('spike_429', v_429, _threshold_429),
      ('spike_502', v_502, _threshold_502),
      ('spike_geral', v_err, _threshold_total)
    ) AS t(alert_type, cnt, thr)
  LOOP
    IF v_config.cnt >= v_config.thr THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.extraction_failure_alerts
         WHERE alert_type = v_config.alert_type
           AND function_name = 'extrair-dados-anuncio'
           AND resolved_at IS NULL
           AND created_at > now() - interval '60 minutes'
      ) THEN
        INSERT INTO public.extraction_failure_alerts(
          alert_type, function_name, window_start, window_end,
          failure_count, total_count, failure_rate, threshold, sample_errors
        ) VALUES (
          v_config.alert_type, 'extrair-dados-anuncio', v_start, v_end,
          v_config.cnt, v_total, v_rate, v_config.thr, v_samples
        ) RETURNING * INTO v_alert;

        INSERT INTO public.notifications(user_id, title, description)
        SELECT p.id,
               format('⚠️ Spike de falhas em extrair-dados-anuncio (%s)', v_config.alert_type),
               format('Detectadas %s falhas na janela de %s min (limite: %s). Total de tentativas: %s. Taxa de falha: %s%%.',
                      v_config.cnt, _window_minutes, v_config.thr, v_total, v_rate)
          FROM public.profiles p WHERE p.is_master IS TRUE;

        v_alerts := v_alerts || to_jsonb(v_alert);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'window_minutes', _window_minutes,
    'total', v_total, 'errors', v_err, 'errors_429', v_429, 'errors_502', v_502,
    'failure_rate', v_rate,
    'thresholds', jsonb_build_object('429', _threshold_429, '502', _threshold_502, 'total', _threshold_total),
    'alerts_created', v_alerts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_extracao_anuncio_spikes(INTEGER,INTEGER,INTEGER,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_extracao_anuncio_spikes(INTEGER,INTEGER,INTEGER,INTEGER) TO service_role, authenticated;
