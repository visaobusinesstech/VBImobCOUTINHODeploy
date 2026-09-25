
CREATE TABLE public.captacao_buscas_agendadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  params JSONB NOT NULL,
  frequencia TEXT NOT NULL CHECK (frequencia IN ('diaria','semanal')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  proxima_execucao TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_execucao TIMESTAMPTZ,
  ultimo_total INTEGER NOT NULL DEFAULT 0,
  ultimo_novos INTEGER NOT NULL DEFAULT 0,
  fingerprints_conhecidos TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cba_due ON public.captacao_buscas_agendadas (ativo, proxima_execucao);
CREATE INDEX idx_cba_user ON public.captacao_buscas_agendadas (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacao_buscas_agendadas TO authenticated;
GRANT ALL ON public.captacao_buscas_agendadas TO service_role;

ALTER TABLE public.captacao_buscas_agendadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cba_select_own" ON public.captacao_buscas_agendadas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cba_insert_own" ON public.captacao_buscas_agendadas
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cba_update_own" ON public.captacao_buscas_agendadas
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cba_delete_own" ON public.captacao_buscas_agendadas
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_cba_updated
  BEFORE UPDATE ON public.captacao_buscas_agendadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
