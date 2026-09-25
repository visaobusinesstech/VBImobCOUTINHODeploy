ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS inquilino2_nome text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inquilino2_cpf text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inquilino2_telefone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inquilino2_email text DEFAULT NULL;