ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS proprietario_telefone text DEFAULT null;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS proprietario_cpf text DEFAULT null;