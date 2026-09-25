ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS fiador2_nome text,
  ADD COLUMN IF NOT EXISTS fiador2_cpf text,
  ADD COLUMN IF NOT EXISTS fiador2_telefone text,
  ADD COLUMN IF NOT EXISTS fiador2_email text,
  ADD COLUMN IF NOT EXISTS fiador2_estado_civil text,
  ADD COLUMN IF NOT EXISTS fiador2_endereco text,
  ADD COLUMN IF NOT EXISTS fiador2_matricula_url text,
  ADD COLUMN IF NOT EXISTS fiador_renda_url text,
  ADD COLUMN IF NOT EXISTS fiador2_renda_url text;