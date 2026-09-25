CREATE TABLE public.webhook_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  provider text NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('cache_hit_rate_low','validation_latency_high')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  metric_value numeric NOT NULL,
  threshold numeric NOT NULL,
  sample_size integer NOT NULL,
  window_seconds integer NOT NULL,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_alerts_tenant_provider_created
  ON public.webhook_alerts (imobiliaria_id, provider, created_at DESC);
CREATE INDEX idx_webhook_alerts_type_created
  ON public.webhook_alerts (alert_type, created_at DESC);
CREATE INDEX idx_webhook_alerts_unresolved
  ON public.webhook_alerts (imobiliaria_id, provider, alert_type)
  WHERE resolved_at IS NULL;

GRANT SELECT ON public.webhook_alerts TO authenticated;
GRANT ALL ON public.webhook_alerts TO service_role;

ALTER TABLE public.webhook_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own webhook alerts"
  ON public.webhook_alerts
  FOR SELECT
  TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "Service role manages webhook alerts"
  ON public.webhook_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_webhook_alerts_updated_at
  BEFORE UPDATE ON public.webhook_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();