
ALTER TABLE public.contratos
ADD COLUMN IF NOT EXISTS fiador_nome text,
ADD COLUMN IF NOT EXISTS fiador_cpf text,
ADD COLUMN IF NOT EXISTS fiador_telefone text,
ADD COLUMN IF NOT EXISTS fiador_email text,
ADD COLUMN IF NOT EXISTS fiador_estado_civil text,
ADD COLUMN IF NOT EXISTS fiador_endereco text;
