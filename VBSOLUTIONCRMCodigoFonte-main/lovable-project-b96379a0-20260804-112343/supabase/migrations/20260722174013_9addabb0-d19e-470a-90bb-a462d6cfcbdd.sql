
CREATE TABLE public.radarzap_metricas_alertas_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id uuid NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  min_taxa_geracao numeric(5,2) NOT NULL DEFAULT 5.0 CHECK (min_taxa_geracao >= 0 AND min_taxa_geracao <= 100),
  min_taxa_aprovacao numeric(5,2) NOT NULL DEFAULT 40.0 CHECK (min_taxa_aprovacao >= 0 AND min_taxa_aprovacao <= 100),
  min_mensagens_avaliacao integer NOT NULL DEFAULT 20 CHECK (min_mensagens_avaliacao >= 1),
  min_leads_avaliacao integer NOT NULL DEFAULT 5 CHECK (min_leads_avaliacao >= 1),
  janela_horas integer NOT NULL DEFAULT 24 CHECK (janela_horas BETWEEN 1 AND 168),
  cooldown_horas integer NOT NULL DEFAULT 6 CHECK (cooldown_horas BETWEEN 1 AND 168),
  ultimo_check_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radarzap_metricas_alertas_config TO authenticated;
GRANT ALL ON public.radarzap_metricas_alertas_config TO service_role;
ALTER TABLE public.radarzap_metricas_alertas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own config select" ON public.radarzap_metricas_alertas_config FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "own config insert" ON public.radarzap_metricas_alertas_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "own config update" ON public.radarzap_metricas_alertas_config FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id) WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "own config delete" ON public.radarzap_metricas_alertas_config FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

CREATE TABLE public.radarzap_metricas_alertas_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('taxa_geracao','taxa_aprovacao')),
  taxa_observada numeric(5,2) NOT NULL,
  taxa_minima numeric(5,2) NOT NULL,
  total_mensagens integer NOT NULL DEFAULT 0,
  total_leads integer NOT NULL DEFAULT 0,
  total_aprovados integer NOT NULL DEFAULT 0,
  janela_horas integer NOT NULL,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rz_alertas_log_imob_created ON public.radarzap_metricas_alertas_log(imobiliaria_id, created_at DESC);
CREATE INDEX idx_rz_alertas_log_tipo ON public.radarzap_metricas_alertas_log(imobiliaria_id, tipo, created_at DESC);
GRANT SELECT ON public.radarzap_metricas_alertas_log TO authenticated;
GRANT ALL ON public.radarzap_metricas_alertas_log TO service_role;
ALTER TABLE public.radarzap_metricas_alertas_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own log select" ON public.radarzap_metricas_alertas_log FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);

CREATE TRIGGER trg_rz_alertas_config_updated
  BEFORE UPDATE ON public.radarzap_metricas_alertas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
