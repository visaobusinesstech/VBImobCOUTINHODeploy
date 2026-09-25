
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS aditivo_anexo_url text DEFAULT NULL;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS seguro_incendio_anexo_url text DEFAULT NULL;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS seguro_fianca_anexo_url text DEFAULT NULL;
