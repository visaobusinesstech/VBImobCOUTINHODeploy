
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS numero_unidade text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proprietario_nome text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proprietario_telefone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proprietario_cpf text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS imposto_tipo text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS imposto_percentual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imposto_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_nao_tributavel numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_iptu numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_condominio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_extra numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_extra_descricao text DEFAULT NULL;
