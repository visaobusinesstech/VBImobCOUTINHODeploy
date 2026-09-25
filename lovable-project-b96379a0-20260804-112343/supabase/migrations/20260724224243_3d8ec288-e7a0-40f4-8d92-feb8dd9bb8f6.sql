CREATE TABLE IF NOT EXISTS public.condominios_df (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  bairro TEXT,
  cep TEXT,
  endereco TEXT,
  cidade TEXT DEFAULT 'Brasília',
  uf TEXT DEFAULT 'DF',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  telefone TEXT,
  website TEXT,
  source TEXT NOT NULL CHECK (source IN ('osm','google_places','manual')),
  external_id TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_condominios_df_nome_lower ON public.condominios_df ((lower(nome)));
CREATE INDEX IF NOT EXISTS idx_condominios_df_cep ON public.condominios_df (cep);
CREATE INDEX IF NOT EXISTS idx_condominios_df_bairro ON public.condominios_df (bairro);

GRANT SELECT ON public.condominios_df TO authenticated;
GRANT ALL ON public.condominios_df TO service_role;

ALTER TABLE public.condominios_df ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem base de condomínios"
  ON public.condominios_df FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role gerencia base"
  ON public.condominios_df FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.condominios_df_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_condominios_df_updated_at ON public.condominios_df;
CREATE TRIGGER trg_condominios_df_updated_at
  BEFORE UPDATE ON public.condominios_df
  FOR EACH ROW EXECUTE FUNCTION public.condominios_df_set_updated_at();