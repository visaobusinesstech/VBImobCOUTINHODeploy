
-- Fix analise_inquilino policies: change from public to authenticated
DROP POLICY IF EXISTS "analise_inquilino_select" ON public.analise_inquilino;
DROP POLICY IF EXISTS "analise_inquilino_insert" ON public.analise_inquilino;
DROP POLICY IF EXISTS "analise_inquilino_update" ON public.analise_inquilino;
DROP POLICY IF EXISTS "analise_inquilino_delete" ON public.analise_inquilino;

CREATE POLICY "analise_inquilino_select" ON public.analise_inquilino
  FOR SELECT TO authenticated USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));

CREATE POLICY "analise_inquilino_insert" ON public.analise_inquilino
  FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid() AND public.is_approved(auth.uid()));

CREATE POLICY "analise_inquilino_update" ON public.analise_inquilino
  FOR UPDATE TO authenticated USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));

CREATE POLICY "analise_inquilino_delete" ON public.analise_inquilino
  FOR DELETE TO authenticated USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));

-- Fix imoveis_mercado UPDATE policy: change from public to authenticated
DROP POLICY IF EXISTS "Users can update own imobiliaria market properties" ON public.imoveis_mercado;

CREATE POLICY "imoveis_mercado_update" ON public.imoveis_mercado
  FOR UPDATE TO authenticated USING (public.can_access_imobiliaria(imobiliaria_id));
