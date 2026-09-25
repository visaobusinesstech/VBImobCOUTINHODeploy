
CREATE TABLE public.captacao_execucoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  portais_consultados text[] NOT NULL DEFAULT '{}',
  cidades_alvo text[] NOT NULL DEFAULT '{}',
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'executando',
  resultados_encontrados integer NOT NULL DEFAULT 0,
  itens_processados integer NOT NULL DEFAULT 0,
  duracao_ms integer,
  erro text,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.captacao_execucoes_historico TO authenticated;
GRANT ALL ON public.captacao_execucoes_historico TO service_role;

ALTER TABLE public.captacao_execucoes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant pode ver seu histórico de execuções"
  ON public.captacao_execucoes_historico
  FOR SELECT
  TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id));

CREATE INDEX idx_captacao_execucoes_hist_imob_iniciado
  ON public.captacao_execucoes_historico (imobiliaria_id, iniciado_em DESC);

CREATE TRIGGER trg_captacao_execucoes_hist_updated_at
  BEFORE UPDATE ON public.captacao_execucoes_historico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
