
-- 1) Datasets históricos versionados
CREATE TABLE public.calibracao_datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome TEXT NOT NULL,
  descricao TEXT,
  origem TEXT NOT NULL DEFAULT 'snapshot', -- snapshot | csv | manual
  periodo_inicio TIMESTAMPTZ,
  periodo_fim TIMESTAMPTZ,
  janela_dias INTEGER,
  total_itens INTEGER NOT NULL DEFAULT 0,
  positivos INTEGER NOT NULL DEFAULT 0,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb
    -- cada item: { input: {...campos anonimizados...}, label: 0|1 }
);

CREATE INDEX idx_cal_ds_imob ON public.calibracao_datasets(imobiliaria_id, criado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calibracao_datasets TO authenticated;
GRANT ALL ON public.calibracao_datasets TO service_role;

ALTER TABLE public.calibracao_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cal_ds_select_own" ON public.calibracao_datasets
  FOR SELECT TO authenticated USING (imobiliaria_id = auth.uid());
CREATE POLICY "cal_ds_insert_own" ON public.calibracao_datasets
  FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "cal_ds_update_own" ON public.calibracao_datasets
  FOR UPDATE TO authenticated USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "cal_ds_delete_own" ON public.calibracao_datasets
  FOR DELETE TO authenticated USING (imobiliaria_id = auth.uid());

-- 2) Novas colunas nas execuções de calibração
ALTER TABLE public.calibracao_filtro_ia_runs
  ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES public.calibracao_datasets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fpr NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS fnr NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS auc NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS roc_curve JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS latency_ms_avg INTEGER,
  ADD COLUMN IF NOT EXISTS latency_ms_p50 INTEGER,
  ADD COLUMN IF NOT EXISTS latency_ms_p95 INTEGER,
  ADD COLUMN IF NOT EXISTS latency_ms_p99 INTEGER,
  ADD COLUMN IF NOT EXISTS latency_ms_total INTEGER,
  ADD COLUMN IF NOT EXISTS latency_batches INTEGER;

CREATE INDEX IF NOT EXISTS idx_cal_runs_dataset ON public.calibracao_filtro_ia_runs(dataset_id);
