
CREATE TABLE public.lighthouse_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL UNIQUE,
  paths TEXT[] NOT NULL DEFAULT ARRAY['/', '/portal', '/anunciar-imovel']::text[],
  strategies TEXT[] NOT NULL DEFAULT ARRAY['mobile']::text[],
  min_performance INT NOT NULL DEFAULT 70,
  min_seo INT NOT NULL DEFAULT 90,
  min_accessibility INT NOT NULL DEFAULT 85,
  min_best_practices INT NOT NULL DEFAULT 85,
  max_lcp_ms INT NOT NULL DEFAULT 2500,
  max_cls NUMERIC(4,3) NOT NULL DEFAULT 0.100,
  max_tbt_ms INT NOT NULL DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lighthouse_config TO authenticated;
GRANT ALL ON public.lighthouse_config TO service_role;

ALTER TABLE public.lighthouse_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manages own lighthouse config"
  ON public.lighthouse_config FOR ALL
  USING (auth.uid() = imobiliaria_id)
  WITH CHECK (auth.uid() = imobiliaria_id);

CREATE TRIGGER lighthouse_config_updated_at
  BEFORE UPDATE ON public.lighthouse_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
