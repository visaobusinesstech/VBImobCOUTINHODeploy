ALTER TABLE public.conteudos_seo
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS bairro text;

CREATE INDEX IF NOT EXISTS idx_conteudos_seo_cidade ON public.conteudos_seo (cidade);
CREATE INDEX IF NOT EXISTS idx_conteudos_seo_bairro ON public.conteudos_seo (bairro);