ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS cliente_telefone text,
  ADD COLUMN IF NOT EXISTS cliente_cpf text,
  ADD COLUMN IF NOT EXISTS cliente_email text,
  ADD COLUMN IF NOT EXISTS conjuge_telefone text,
  ADD COLUMN IF NOT EXISTS conjuge_email text;