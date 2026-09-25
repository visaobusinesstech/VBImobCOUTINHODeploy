ALTER TABLE public.radarzap_descoberta_execucoes
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'completo',
  ADD COLUMN IF NOT EXISTS retry_of_run_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_radarzap_descoberta_retry_of ON public.radarzap_descoberta_execucoes(retry_of_run_id);