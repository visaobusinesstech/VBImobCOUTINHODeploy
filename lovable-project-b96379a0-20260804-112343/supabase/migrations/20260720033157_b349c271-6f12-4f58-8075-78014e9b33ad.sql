
CREATE TABLE public.calibracao_filtro_ia_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  janela_dias INTEGER NOT NULL DEFAULT 60,
  threshold_ai INTEGER NOT NULL DEFAULT 60,
  amostra_total INTEGER NOT NULL DEFAULT 0,
  positivos_reais INTEGER NOT NULL DEFAULT 0,
  positivos_preditos INTEGER NOT NULL DEFAULT 0,
  tp INTEGER NOT NULL DEFAULT 0,
  fp INTEGER NOT NULL DEFAULT 0,
  tn INTEGER NOT NULL DEFAULT 0,
  fn INTEGER NOT NULL DEFAULT 0,
  precision_v NUMERIC(6,4),
  recall_v NUMERIC(6,4),
  f1_v NUMERIC(6,4),
  accuracy_v NUMERIC(6,4),
  conversao_preditos NUMERIC(6,4),
  conversao_geral NUMERIC(6,4),
  lift NUMERIC(6,3),
  threshold_sweep JSONB DEFAULT '[]'::jsonb,
  resultados_amostra JSONB DEFAULT '[]'::jsonb,
  modelo TEXT,
  provider TEXT,
  notas TEXT
);

CREATE INDEX idx_calibracao_ia_imob_data ON public.calibracao_filtro_ia_runs(imobiliaria_id, criado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calibracao_filtro_ia_runs TO authenticated;
GRANT ALL ON public.calibracao_filtro_ia_runs TO service_role;

ALTER TABLE public.calibracao_filtro_ia_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cal_ia_select_own" ON public.calibracao_filtro_ia_runs
  FOR SELECT TO authenticated USING (imobiliaria_id = auth.uid());
CREATE POLICY "cal_ia_insert_own" ON public.calibracao_filtro_ia_runs
  FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "cal_ia_update_own" ON public.calibracao_filtro_ia_runs
  FOR UPDATE TO authenticated USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "cal_ia_delete_own" ON public.calibracao_filtro_ia_runs
  FOR DELETE TO authenticated USING (imobiliaria_id = auth.uid());
