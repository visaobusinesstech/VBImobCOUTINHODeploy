
CREATE TABLE public.matching_fallback_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL DEFAULT 'buscar_proprietario',
  nome_predio TEXT,
  cidade TEXT,
  bairro TEXT,
  tipo_imovel TEXT,
  operacao TEXT,
  match_type TEXT NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  ads_count INTEGER NOT NULL DEFAULT 0,
  suggestions_count INTEGER NOT NULL DEFAULT 0,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  firecrawl_error TEXT,
  duracao_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matching_fallback_log_imob_created
  ON public.matching_fallback_log (imobiliaria_id, created_at DESC);
CREATE INDEX idx_matching_fallback_log_user_created
  ON public.matching_fallback_log (user_id, created_at DESC);
CREATE INDEX idx_matching_fallback_log_nome_predio
  ON public.matching_fallback_log (lower(nome_predio));
CREATE INDEX idx_matching_fallback_log_match_type
  ON public.matching_fallback_log (match_type);

GRANT SELECT ON public.matching_fallback_log TO authenticated;
GRANT ALL ON public.matching_fallback_log TO service_role;

ALTER TABLE public.matching_fallback_log ENABLE ROW LEVEL SECURITY;

-- Users see their own rows
CREATE POLICY "Users view own matching fallback logs"
  ON public.matching_fallback_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Master sees the whole imobiliaria via master_autorizacoes
CREATE POLICY "Master views imobiliaria matching fallback logs"
  ON public.matching_fallback_log
  FOR SELECT
  TO authenticated
  USING (
    imobiliaria_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.master_autorizacoes ma
      WHERE ma.master_id = auth.uid()
        AND ma.ativo = true
        AND ma.user_id = matching_fallback_log.user_id
    )
  );
