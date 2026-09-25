
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS canal_origem text DEFAULT null;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS canal_origem text DEFAULT null;
