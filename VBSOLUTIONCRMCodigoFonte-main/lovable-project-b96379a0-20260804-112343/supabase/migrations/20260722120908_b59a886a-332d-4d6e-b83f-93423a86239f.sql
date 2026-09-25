
ALTER TABLE public.calibracao_filtro_ia_runs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS erro text,
  ADD COLUMN IF NOT EXISTS duracao_ms integer,
  ADD COLUMN IF NOT EXISTS finalizado_em timestamptz DEFAULT now();

ALTER TABLE public.calibracao_filtro_ia_runs
  DROP CONSTRAINT IF EXISTS calibracao_filtro_ia_runs_status_chk;
ALTER TABLE public.calibracao_filtro_ia_runs
  ADD CONSTRAINT calibracao_filtro_ia_runs_status_chk
  CHECK (status IN ('success','failure','partial'));

CREATE INDEX IF NOT EXISTS idx_cal_runs_status
  ON public.calibracao_filtro_ia_runs(imobiliaria_id, status, criado_em DESC);
