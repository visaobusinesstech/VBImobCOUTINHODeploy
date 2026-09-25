ALTER TABLE public.imobiliaria_config
ADD COLUMN IF NOT EXISTS extraction_max_retries INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS extraction_retry_delay_ms INTEGER DEFAULT 2000;
