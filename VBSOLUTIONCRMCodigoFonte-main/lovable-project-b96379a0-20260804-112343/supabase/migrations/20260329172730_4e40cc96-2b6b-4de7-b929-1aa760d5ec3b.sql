
-- FIX 1: Restrict public imoveis SELECT to only active listings, hiding sensitive fields
-- Drop the overly permissive public select policy
DROP POLICY IF EXISTS "imoveis_public_select" ON public.imoveis;

-- Recreate with proper scope: only active properties, anon role only
CREATE POLICY "imoveis_public_select"
  ON public.imoveis FOR SELECT TO anon
  USING (status = 'Ativo');

-- FIX 2: Scope corretor_permissoes to the corretor's imobiliaria
DROP POLICY IF EXISTS "permissoes_select" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "permissoes_insert" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "permissoes_update" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "permissoes_delete" ON public.corretor_permissoes;

CREATE POLICY "permissoes_select" ON public.corretor_permissoes FOR SELECT TO authenticated
  USING (is_approved(auth.uid()) AND owns_corretor(corretor_id));

CREATE POLICY "permissoes_insert" ON public.corretor_permissoes FOR INSERT TO authenticated
  WITH CHECK (is_approved(auth.uid()) AND owns_corretor(corretor_id));

CREATE POLICY "permissoes_update" ON public.corretor_permissoes FOR UPDATE TO authenticated
  USING (is_approved(auth.uid()) AND owns_corretor(corretor_id));

CREATE POLICY "permissoes_delete" ON public.corretor_permissoes FOR DELETE TO authenticated
  USING (is_approved(auth.uid()) AND owns_corretor(corretor_id));
