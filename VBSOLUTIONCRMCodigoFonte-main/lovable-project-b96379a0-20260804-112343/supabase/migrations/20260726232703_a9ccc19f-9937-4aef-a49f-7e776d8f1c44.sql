CREATE TABLE public.captacao_anuncios_extraidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  url_anuncio text NOT NULL,
  portal text,
  titulo text,
  preco numeric DEFAULT 0,
  bairro text,
  cidade text,
  estado text,
  telefone text,
  email text,
  anunciante_tipo text NOT NULL DEFAULT 'proprietario',
  extraction_status text NOT NULL DEFAULT 'completed',
  missing_fields text[] NOT NULL DEFAULT '{}',
  observacoes text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacao_anuncios_extraidos TO authenticated;
GRANT ALL ON public.captacao_anuncios_extraidos TO service_role;

ALTER TABLE public.captacao_anuncios_extraidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anuncios_extraidos_select" ON public.captacao_anuncios_extraidos
  FOR SELECT TO authenticated USING (imobiliaria_id = auth.uid());
CREATE POLICY "anuncios_extraidos_insert" ON public.captacao_anuncios_extraidos
  FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "anuncios_extraidos_update" ON public.captacao_anuncios_extraidos
  FOR UPDATE TO authenticated USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "anuncios_extraidos_delete" ON public.captacao_anuncios_extraidos
  FOR DELETE TO authenticated USING (imobiliaria_id = auth.uid());

CREATE UNIQUE INDEX captacao_anuncios_extraidos_uniq ON public.captacao_anuncios_extraidos (imobiliaria_id, url_anuncio);
CREATE INDEX captacao_anuncios_extraidos_created_idx ON public.captacao_anuncios_extraidos (imobiliaria_id, created_at DESC);

CREATE TRIGGER update_captacao_anuncios_extraidos_updated_at
  BEFORE UPDATE ON public.captacao_anuncios_extraidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();