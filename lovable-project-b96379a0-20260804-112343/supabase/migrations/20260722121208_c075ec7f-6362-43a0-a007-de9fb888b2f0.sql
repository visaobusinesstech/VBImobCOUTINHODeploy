
CREATE TABLE IF NOT EXISTS public.calibracao_falhas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  run_id uuid REFERENCES public.calibracao_filtro_ia_runs(id) ON DELETE SET NULL,
  fingerprint text NOT NULL,
  erro text NOT NULL,
  stack text,
  http_status integer,
  duracao_ms integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  query_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_provider text,
  ai_modelo text,
  ocorrencias_24h integer NOT NULL DEFAULT 1,
  notificado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.calibracao_falhas_log TO authenticated;
GRANT ALL ON public.calibracao_falhas_log TO service_role;

ALTER TABLE public.calibracao_falhas_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cal_falhas_select_own" ON public.calibracao_falhas_log
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_cal_falhas_imob_data
  ON public.calibracao_falhas_log(imobiliaria_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_cal_falhas_fingerprint
  ON public.calibracao_falhas_log(imobiliaria_id, fingerprint, criado_em DESC);
