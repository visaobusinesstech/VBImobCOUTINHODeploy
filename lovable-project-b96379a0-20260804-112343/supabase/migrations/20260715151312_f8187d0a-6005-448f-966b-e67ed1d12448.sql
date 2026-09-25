
-- 1) article_types: substituir policy tautológica
DROP POLICY IF EXISTS "Users can manage their own imobiliaria article types" ON public.article_types;
CREATE POLICY article_types_select ON public.article_types FOR SELECT TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY article_types_insert ON public.article_types FOR INSERT TO authenticated
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));
CREATE POLICY article_types_update ON public.article_types FOR UPDATE TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()))
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY article_types_delete ON public.article_types FOR DELETE TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));

-- 2) wordpress_sites: substituir policy tautológica
DROP POLICY IF EXISTS "Users can manage their own imobiliaria wordpress sites" ON public.wordpress_sites;
CREATE POLICY wordpress_sites_select ON public.wordpress_sites FOR SELECT TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY wordpress_sites_insert ON public.wordpress_sites FOR INSERT TO authenticated
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));
CREATE POLICY wordpress_sites_update ON public.wordpress_sites FOR UPDATE TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()))
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY wordpress_sites_delete ON public.wordpress_sites FOR DELETE TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));

-- 3) imoveis: proteção a nível de coluna para anon (documentos internos)
REVOKE SELECT ON public.imoveis FROM anon;
GRANT SELECT (
  id, imobiliaria_id, titulo, tipo, operacao, preco,
  endereco, cidade, bairro, estado, cep,
  quartos, banheiros, vagas, area, descricao, status,
  destaque, fotos, videos, created_at, updated_at,
  suites, aceita_permuta, valor_condominio, valor_iptu,
  andar, posicao_solar, aceita_financiamento, aceita_fgts,
  foto_capa_index
) ON public.imoveis TO anon;

-- 4) lead_atividades: consolidar policies duplicadas
DROP POLICY IF EXISTS "Users can insert their own activities" ON public.lead_atividades;
DROP POLICY IF EXISTS "Users can view lead activities for their imobiliaria" ON public.lead_atividades;

-- 5) analise_inquilino: consolidar INSERT duplicado (manter can_access_imobiliaria)
DROP POLICY IF EXISTS "Users can insert own analise_inquilino" ON public.analise_inquilino;
