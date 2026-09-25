
ALTER TABLE public.conteudos_seo
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS idx_conteudos_seo_origem ON public.conteudos_seo(imobiliaria_id, origem);
