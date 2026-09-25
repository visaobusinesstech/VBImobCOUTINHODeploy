
CREATE TABLE public.conteudos_seo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  imovel_id UUID REFERENCES public.imoveis(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'descricao_imovel',
  titulo TEXT NOT NULL DEFAULT '',
  conteudo JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conteudos_seo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conteudos_seo_select" ON public.conteudos_seo FOR SELECT TO authenticated
  USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

CREATE POLICY "conteudos_seo_insert" ON public.conteudos_seo FOR INSERT TO authenticated
  WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

CREATE POLICY "conteudos_seo_update" ON public.conteudos_seo FOR UPDATE TO authenticated
  USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

CREATE POLICY "conteudos_seo_delete" ON public.conteudos_seo FOR DELETE TO authenticated
  USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
