
-- 1. WhatsApp config: restrict to owner only (not sub-users via master_autorizacoes)
DROP POLICY IF EXISTS "Users can manage own whatsapp config" ON public.whatsapp_config;

CREATE POLICY "whatsapp_config_select" ON public.whatsapp_config
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE POLICY "whatsapp_config_insert" ON public.whatsapp_config
  FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "whatsapp_config_update" ON public.whatsapp_config
  FOR UPDATE TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE POLICY "whatsapp_config_delete" ON public.whatsapp_config
  FOR DELETE TO authenticated
  USING (imobiliaria_id = auth.uid());

-- 2. imoveis-docs: add missing UPDATE policy
CREATE POLICY "Users can update their own property docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'imoveis-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 3. Logos: change INSERT and UPDATE from public to authenticated
DROP POLICY IF EXISTS "Users can upload own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own logo" ON storage.objects;

CREATE POLICY "Users can upload own logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);
