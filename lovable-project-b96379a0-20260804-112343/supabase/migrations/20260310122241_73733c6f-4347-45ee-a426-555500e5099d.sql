
-- Fix: All RLS policies on imoveis are RESTRICTIVE, meaning updates are always denied.
-- We need to recreate the UPDATE policy as PERMISSIVE.

DROP POLICY IF EXISTS "Owner can update imoveis" ON public.imoveis;

CREATE POLICY "Owner can update imoveis"
ON public.imoveis
FOR UPDATE
TO authenticated
USING (auth.uid() = imobiliaria_id)
WITH CHECK (auth.uid() = imobiliaria_id);
