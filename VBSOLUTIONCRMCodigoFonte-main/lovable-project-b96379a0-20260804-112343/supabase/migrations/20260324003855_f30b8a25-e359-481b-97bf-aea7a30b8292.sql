
ALTER TABLE public.proprietarios
ADD COLUMN IF NOT EXISTS contrato_administracao boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS comissao_acordada numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS exclusividade boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS exclusividade_inicio date,
ADD COLUMN IF NOT EXISTS exclusividade_fim date;
