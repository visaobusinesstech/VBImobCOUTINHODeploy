
-- Add tipo_operacao to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tipo_operacao text NOT NULL DEFAULT 'venda';

-- Add utility fields to contratos
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS numero_agua text NULL;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS numero_luz text NULL;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS inscricao_iptu text NULL;
