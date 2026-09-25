-- Add missing UPDATE policy on imoveis_mercado
CREATE POLICY "Users can update own imobiliaria market properties"
ON public.imoveis_mercado
FOR UPDATE
USING (public.can_access_imobiliaria(imobiliaria_id))
WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));