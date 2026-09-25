CREATE TABLE public.radarzap_normalizacao_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_ruidosos TEXT[] NOT NULL DEFAULT ARRAY['grupo','whatsapp','wpp','zap','oficial','link','convite','entrar','join']::text[],
  min_length INTEGER NOT NULL DEFAULT 3 CHECK (min_length BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radarzap_normalizacao_config TO authenticated;
GRANT ALL ON public.radarzap_normalizacao_config TO service_role;

ALTER TABLE public.radarzap_normalizacao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own tenant read normalizacao config"
  ON public.radarzap_normalizacao_config FOR SELECT
  TO authenticated
  USING (auth.uid() = imobiliaria_id);

CREATE POLICY "Own tenant insert normalizacao config"
  ON public.radarzap_normalizacao_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = imobiliaria_id);

CREATE POLICY "Own tenant update normalizacao config"
  ON public.radarzap_normalizacao_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = imobiliaria_id)
  WITH CHECK (auth.uid() = imobiliaria_id);

CREATE POLICY "Own tenant delete normalizacao config"
  ON public.radarzap_normalizacao_config FOR DELETE
  TO authenticated
  USING (auth.uid() = imobiliaria_id);

CREATE TRIGGER update_radarzap_normalizacao_config_updated_at
  BEFORE UPDATE ON public.radarzap_normalizacao_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
