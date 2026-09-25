
-- Fix all RESTRICTIVE policies on imoveis table to be PERMISSIVE

DROP POLICY IF EXISTS "Owner can delete imoveis" ON public.imoveis;
CREATE POLICY "Owner can delete imoveis"
ON public.imoveis FOR DELETE TO authenticated
USING (auth.uid() = imobiliaria_id);

DROP POLICY IF EXISTS "Owner can insert imoveis" ON public.imoveis;
CREATE POLICY "Owner can insert imoveis"
ON public.imoveis FOR INSERT TO authenticated
WITH CHECK (auth.uid() = imobiliaria_id);

DROP POLICY IF EXISTS "Owner can select imoveis" ON public.imoveis;
CREATE POLICY "Owner can select imoveis"
ON public.imoveis FOR SELECT TO authenticated
USING (auth.uid() = imobiliaria_id);
