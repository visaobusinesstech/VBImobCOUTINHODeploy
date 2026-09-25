
-- Add CRECI to imobiliaria_config
ALTER TABLE public.imobiliaria_config ADD COLUMN IF NOT EXISTS creci text DEFAULT '';

-- Add CRECI to corretores
ALTER TABLE public.corretores ADD COLUMN IF NOT EXISTS creci text DEFAULT '';
