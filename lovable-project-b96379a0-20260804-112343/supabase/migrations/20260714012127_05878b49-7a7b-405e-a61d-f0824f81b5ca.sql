
CREATE TABLE IF NOT EXISTS public.webhook_alert_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  provider text,
  enabled boolean NOT NULL DEFAULT true,
  cache_hit_min numeric(5,4) CHECK (cache_hit_min IS NULL OR (cache_hit_min >= 0 AND cache_hit_min <= 1)),
  latency_max_ms integer CHECK (latency_max_ms IS NULL OR (latency_max_ms >= 1 AND latency_max_ms <= 600000)),
  min_samples integer CHECK (min_samples IS NULL OR (min_samples >= 1 AND min_samples <= 100000)),
  cooldown_minutes integer CHECK (cooldown_minutes IS NULL OR (cooldown_minutes >= 0 AND cooldown_minutes <= 1440)),
  critical_cache_hit_min numeric(5,4) CHECK (critical_cache_hit_min IS NULL OR (critical_cache_hit_min >= 0 AND critical_cache_hit_min <= 1)),
  critical_latency_max_ms integer CHECK (critical_latency_max_ms IS NULL OR (critical_latency_max_ms >= 1 AND critical_latency_max_ms <= 600000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_alert_thresholds_tenant_provider_uidx
  ON public.webhook_alert_thresholds (imobiliaria_id, COALESCE(provider, ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_alert_thresholds TO authenticated;
GRANT ALL ON public.webhook_alert_thresholds TO service_role;

ALTER TABLE public.webhook_alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own alert thresholds"
  ON public.webhook_alert_thresholds FOR SELECT
  TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "Tenants manage own alert thresholds"
  ON public.webhook_alert_thresholds FOR ALL
  TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id))
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));

CREATE TRIGGER webhook_alert_thresholds_updated_at
  BEFORE UPDATE ON public.webhook_alert_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
