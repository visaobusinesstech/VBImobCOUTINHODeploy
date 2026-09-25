ALTER TABLE public.proprietarios 
  ADD COLUMN IF NOT EXISTS inscricao_iptu text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS matricula text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS certidao_onus_url text DEFAULT NULL;