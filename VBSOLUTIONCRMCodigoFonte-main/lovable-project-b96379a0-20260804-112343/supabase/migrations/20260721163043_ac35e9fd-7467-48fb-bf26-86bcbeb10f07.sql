
CREATE TABLE public.conteudos_seo_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_id uuid NOT NULL REFERENCES public.conteudos_seo(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  titulo text,
  slug text,
  meta_description text,
  origem text NOT NULL DEFAULT 'edicao_manual',
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conteudos_seo_versoes_conteudo ON public.conteudos_seo_versoes(conteudo_id, criado_em DESC);
CREATE INDEX idx_conteudos_seo_versoes_imob ON public.conteudos_seo_versoes(imobiliaria_id);

GRANT SELECT, INSERT, DELETE ON public.conteudos_seo_versoes TO authenticated;
GRANT ALL ON public.conteudos_seo_versoes TO service_role;

ALTER TABLE public.conteudos_seo_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY conteudos_seo_versoes_select ON public.conteudos_seo_versoes
  FOR SELECT USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY conteudos_seo_versoes_insert ON public.conteudos_seo_versoes
  FOR INSERT WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY conteudos_seo_versoes_delete ON public.conteudos_seo_versoes
  FOR DELETE USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
