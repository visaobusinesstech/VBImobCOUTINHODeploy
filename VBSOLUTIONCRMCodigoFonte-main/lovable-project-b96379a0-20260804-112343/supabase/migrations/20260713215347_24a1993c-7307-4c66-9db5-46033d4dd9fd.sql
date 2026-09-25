ALTER TABLE public.imobiliaria_config
  ADD COLUMN IF NOT EXISTS pipeline_tema_default text NOT NULL DEFAULT 'premium';

ALTER TABLE public.imobiliaria_config
  DROP CONSTRAINT IF EXISTS imobiliaria_config_pipeline_tema_default_check;

ALTER TABLE public.imobiliaria_config
  ADD CONSTRAINT imobiliaria_config_pipeline_tema_default_check
  CHECK (pipeline_tema_default IN ('premium','suave','azul','claro'));