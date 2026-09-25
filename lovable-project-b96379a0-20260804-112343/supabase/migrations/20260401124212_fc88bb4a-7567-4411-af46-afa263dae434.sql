ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS proprietario_banco text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proprietario_agencia text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proprietario_conta text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proprietario_pix text DEFAULT NULL;