-- Allow anonymous/public read access to individual imoveis for the public detail page
CREATE POLICY "Public can view imoveis"
ON public.imoveis
FOR SELECT
TO anon, authenticated
USING (true);
