
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS valor_iptu numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iptu_parcelado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_condominio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condominio_inclui text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inquilino_telefone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS inquilino_cpf text DEFAULT NULL;
