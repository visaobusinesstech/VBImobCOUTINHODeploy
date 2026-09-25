
-- Fix 1: analise_inquilino INSERT policy - use can_access_imobiliaria instead of direct uid check
DROP POLICY IF EXISTS "Users can insert own analise_inquilino" ON public.analise_inquilino;
CREATE POLICY "Users can insert own analise_inquilino"
ON public.analise_inquilino
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_imobiliaria(imobiliaria_id)
  AND public.is_approved(auth.uid())
);

-- Fix 2: imoveis_mercado UPDATE policy - add is_approved check
DROP POLICY IF EXISTS "Users can update own imoveis_mercado" ON public.imoveis_mercado;
CREATE POLICY "Users can update own imoveis_mercado"
ON public.imoveis_mercado
FOR UPDATE
TO authenticated
USING (
  public.can_access_imobiliaria(imobiliaria_id)
  AND public.is_approved(auth.uid())
);
