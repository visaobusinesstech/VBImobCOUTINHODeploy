
CREATE TABLE public.filtro_ia_execucoes_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  run_id UUID NOT NULL,
  modo_teste BOOLEAN NOT NULL DEFAULT false,
  sucesso BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT,
  duracao_ms INTEGER NOT NULL DEFAULT 0,
  tempos JSONB NOT NULL DEFAULT '{}'::jsonb,
  filtros_aplicados JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterios JSONB NOT NULL DEFAULT '{}'::jsonb,
  contagens JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivos_exclusao JSONB NOT NULL DEFAULT '{}'::jsonb,
  filtros_efetivos JSONB NOT NULL DEFAULT '[]'::jsonb,
  modelo TEXT,
  provider TEXT,
  total_resultados INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_filtro_ia_execucoes_imob_data
  ON public.filtro_ia_execucoes_log (imobiliaria_id, criado_em DESC);
CREATE INDEX idx_filtro_ia_execucoes_run ON public.filtro_ia_execucoes_log (run_id);

GRANT SELECT ON public.filtro_ia_execucoes_log TO authenticated;
GRANT ALL ON public.filtro_ia_execucoes_log TO service_role;

ALTER TABLE public.filtro_ia_execucoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own IA Filtra runs"
  ON public.filtro_ia_execucoes_log FOR SELECT
  TO authenticated
  USING (auth.uid() = imobiliaria_id);

-- Inserts are performed only by the edge function using service role; no INSERT policy for authenticated.
