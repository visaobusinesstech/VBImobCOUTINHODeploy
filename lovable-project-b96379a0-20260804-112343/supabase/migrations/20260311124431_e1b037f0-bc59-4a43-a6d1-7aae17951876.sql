CREATE POLICY "Public can view imoveis_mercado"
ON public.imoveis_mercado
FOR SELECT
TO anon, authenticated
USING (true);