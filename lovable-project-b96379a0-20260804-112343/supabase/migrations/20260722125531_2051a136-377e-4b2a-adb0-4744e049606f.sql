
-- Enable required extensions for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table to store schedule config and last execution results for verify-captacao-sla
CREATE TABLE IF NOT EXISTS public.verify_sla_schedule_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cron_expression TEXT NOT NULL DEFAULT '0 * * * *',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_execucao_em TIMESTAMPTZ,
  ultima_execucao_status TEXT,
  ultima_execucao_payload JSONB,
  falhas_consecutivas INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.verify_sla_schedule_config TO authenticated;
GRANT ALL ON public.verify_sla_schedule_config TO service_role;

ALTER TABLE public.verify_sla_schedule_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master reads verify sla schedule"
  ON public.verify_sla_schedule_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND u.email = 'acoutinhoimoveis@gmail.com'
    )
  );

CREATE TRIGGER trg_verify_sla_schedule_config_updated
  BEFORE UPDATE ON public.verify_sla_schedule_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log table for each scheduled run
CREATE TABLE IF NOT EXISTS public.verify_sla_execucoes_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,
  http_status INT,
  duracao_ms INT,
  payload JSONB,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.verify_sla_execucoes_log TO authenticated;
GRANT ALL ON public.verify_sla_execucoes_log TO service_role;

ALTER TABLE public.verify_sla_execucoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master reads verify sla logs"
  ON public.verify_sla_execucoes_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND u.email = 'acoutinhoimoveis@gmail.com'
    )
  );

CREATE INDEX IF NOT EXISTS idx_verify_sla_execucoes_log_executado
  ON public.verify_sla_execucoes_log (executado_em DESC);

-- Seed default config row
INSERT INTO public.verify_sla_schedule_config (cron_expression, ativo)
SELECT '0 * * * *', true
WHERE NOT EXISTS (SELECT 1 FROM public.verify_sla_schedule_config);
