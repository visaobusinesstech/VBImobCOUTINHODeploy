ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS comprovante_agua_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comprovante_luz_url text DEFAULT NULL;