
CREATE TABLE public.webhook_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL,
  imobiliaria_id uuid NULL,
  provider text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('allowed','denied')),
  reason text NULL,
  cache_hit boolean NOT NULL DEFAULT false,
  secrets_source text NULL,
  keys_loaded integer NOT NULL DEFAULT 0,
  keys_tested integer NOT NULL DEFAULT 0,
  validation_ms numeric(10,3) NOT NULL DEFAULT 0,
  secret_id uuid NULL,
  secret_version integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_metrics TO authenticated;
GRANT ALL ON public.webhook_metrics TO service_role;

ALTER TABLE public.webhook_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_own_webhook_metrics"
  ON public.webhook_metrics
  FOR SELECT
  TO authenticated
  USING (
    imobiliaria_id IS NOT NULL
    AND public.can_access_imobiliaria(imobiliaria_id)
  );

CREATE POLICY "service_role_full_webhook_metrics"
  ON public.webhook_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_webhook_metrics_tenant_provider_time
  ON public.webhook_metrics (imobiliaria_id, provider, created_at DESC);

CREATE INDEX idx_webhook_metrics_outcome_time
  ON public.webhook_metrics (outcome, created_at DESC);

CREATE INDEX idx_webhook_metrics_request_id
  ON public.webhook_metrics (request_id);
