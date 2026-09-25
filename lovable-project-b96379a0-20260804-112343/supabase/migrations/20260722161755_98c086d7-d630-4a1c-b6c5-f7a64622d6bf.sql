
-- Config de agendamento RadarZAP por imobiliária
CREATE TABLE public.radarzap_agendamento_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT false,
  frequencia_horas INTEGER NOT NULL DEFAULT 24 CHECK (frequencia_horas BETWEEN 1 AND 168),
  cidades TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  termo_extra TEXT,
  max_grupos_por_execucao INTEGER NOT NULL DEFAULT 20 CHECK (max_grupos_por_execucao BETWEEN 1 AND 100),
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radarzap_agendamento_config TO authenticated;
GRANT ALL ON public.radarzap_agendamento_config TO service_role;
ALTER TABLE public.radarzap_agendamento_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia sua config RadarZAP"
  ON public.radarzap_agendamento_config
  FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_radarzap_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_radarzap_config_updated_at
BEFORE UPDATE ON public.radarzap_agendamento_config
FOR EACH ROW EXECUTE FUNCTION public.tg_radarzap_config_updated_at();

-- Log de execuções agendadas
CREATE TABLE public.radarzap_execucoes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  config_id UUID REFERENCES public.radarzap_agendamento_config(id) ON DELETE SET NULL,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMPTZ,
  duracao_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'em_execucao' CHECK (status IN ('em_execucao','sucesso','erro','parcial')),
  queries_executadas INTEGER NOT NULL DEFAULT 0,
  grupos_encontrados INTEGER NOT NULL DEFAULT 0,
  grupos_novos INTEGER NOT NULL DEFAULT 0,
  erros JSONB NOT NULL DEFAULT '[]'::jsonb,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.radarzap_execucoes_log TO authenticated;
GRANT ALL ON public.radarzap_execucoes_log TO service_role;
ALTER TABLE public.radarzap_execucoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê seus logs RadarZAP"
  ON public.radarzap_execucoes_log
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE INDEX idx_radarzap_log_imob_criado ON public.radarzap_execucoes_log (imobiliaria_id, created_at DESC);
CREATE INDEX idx_radarzap_config_proxima ON public.radarzap_agendamento_config (proxima_execucao) WHERE ativo = true;
