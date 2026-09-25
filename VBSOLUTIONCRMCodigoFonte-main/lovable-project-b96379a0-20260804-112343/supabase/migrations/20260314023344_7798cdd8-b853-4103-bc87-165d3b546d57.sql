
-- Add document fields to imoveis table
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS documentos_matricula text[] DEFAULT '{}'::text[];
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS documentos_iptu text[] DEFAULT '{}'::text[];
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS documentos_outros text[] DEFAULT '{}'::text[];
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS videos text[] DEFAULT '{}'::text[];

-- Add negotiation conditions to propostas
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS condicoes_especiais text DEFAULT NULL;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS prazo_contrato text DEFAULT NULL;
