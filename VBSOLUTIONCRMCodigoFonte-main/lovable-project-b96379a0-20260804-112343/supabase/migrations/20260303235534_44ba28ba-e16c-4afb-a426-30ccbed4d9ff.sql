
-- Update RLS: all authenticated can read, only master can write
DROP POLICY "Owner can select modulo_config" ON public.modulo_config;
DROP POLICY "Owner can insert modulo_config" ON public.modulo_config;
DROP POLICY "Owner can update modulo_config" ON public.modulo_config;
DROP POLICY "Owner can delete modulo_config" ON public.modulo_config;

CREATE POLICY "Authenticated can select modulo_config" ON public.modulo_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master can insert modulo_config" ON public.modulo_config FOR INSERT TO authenticated WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "Master can update modulo_config" ON public.modulo_config FOR UPDATE TO authenticated USING (public.is_master(auth.uid()));
CREATE POLICY "Master can delete modulo_config" ON public.modulo_config FOR DELETE TO authenticated USING (public.is_master(auth.uid()));
