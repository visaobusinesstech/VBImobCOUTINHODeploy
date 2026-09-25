CREATE POLICY "imoveis_select_authenticated"
ON public.imoveis
FOR SELECT
TO authenticated
USING (can_access_imobiliaria(imobiliaria_id));