
CREATE TABLE public.blog_rss_defaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT,
  cidade TEXT,
  "limit" INTEGER,
  cache_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blog_rss_defaults_limit_range CHECK ("limit" IS NULL OR ("limit" BETWEEN 1 AND 200)),
  CONSTRAINT blog_rss_defaults_cache_range CHECK (cache_seconds IS NULL OR (cache_seconds BETWEEN 0 AND 86400))
);

CREATE UNIQUE INDEX blog_rss_defaults_scope_uidx
  ON public.blog_rss_defaults (COALESCE(tipo, ''), COALESCE(cidade, ''));

GRANT SELECT ON public.blog_rss_defaults TO anon, authenticated;
GRANT ALL ON public.blog_rss_defaults TO service_role;

ALTER TABLE public.blog_rss_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read blog rss defaults"
  ON public.blog_rss_defaults FOR SELECT
  USING (true);

CREATE POLICY "Master manage blog rss defaults"
  ON public.blog_rss_defaults FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND u.email = 'acoutinhoimoveis@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND u.email = 'acoutinhoimoveis@gmail.com'
    )
  );

CREATE TRIGGER blog_rss_defaults_set_updated_at
  BEFORE UPDATE ON public.blog_rss_defaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
