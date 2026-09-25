
-- Fix followups RLS policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Owner can select followups" ON public.followups;
DROP POLICY IF EXISTS "Owner can insert followups" ON public.followups;
DROP POLICY IF EXISTS "Owner can update followups" ON public.followups;
DROP POLICY IF EXISTS "Owner can delete followups" ON public.followups;

CREATE POLICY "Owner can select followups" ON public.followups FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert followups" ON public.followups FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update followups" ON public.followups FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete followups" ON public.followups FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);
