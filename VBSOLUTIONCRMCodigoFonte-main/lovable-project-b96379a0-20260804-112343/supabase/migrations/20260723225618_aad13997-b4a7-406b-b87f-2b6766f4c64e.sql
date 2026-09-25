
CREATE TABLE public.radarzap_descoberta_execucoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  imobiliaria_id UUID NOT NULL,
  cidades TEXT[] NOT NULL DEFAULT '{}',
  termo TEXT,
  firecrawl_key_kind TEXT,
  queries INT NOT NULL DEFAULT 0,
  encontrados INT NOT NULL DEFAULT 0,
  inseridos INT NOT NULL DEFAULT 0,
  total_raw_items INT NOT NULL DEFAULT 0,
  total_invites_validos INT NOT NULL DEFAULT 0,
  total_ms INT NOT NULL DEFAULT 0,
  erros JSONB NOT NULL DEFAULT '[]'::jsonb,
  telemetria JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX radarzap_descoberta_execucoes_imob_created_idx
  ON public.radarzap_descoberta_execucoes (imobiliaria_id, created_at DESC);

GRANT SELECT, INSERT ON public.radarzap_descoberta_execucoes TO authenticated;
GRANT ALL ON public.radarzap_descoberta_execucoes TO service_role;

ALTER TABLE public.radarzap_descoberta_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas execuções ou master vê todas"
  ON public.radarzap_descoberta_execucoes
  FOR SELECT
  TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));

CREATE POLICY "Usuário insere suas próprias execuções"
  ON public.radarzap_descoberta_execucoes
  FOR INSERT
  TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());
