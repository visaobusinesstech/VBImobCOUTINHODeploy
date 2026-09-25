CREATE POLICY "conteudos_seo_public_read" ON public.conteudos_seo
  FOR SELECT TO anon
  USING (status = 'publicado' AND slug IS NOT NULL);

GRANT SELECT ON public.conteudos_seo TO anon;