CREATE TABLE public.relatorios_agendados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  nome text NOT NULL,
  tipo_relatorio text NOT NULL,
  formato text NOT NULL DEFAULT 'csv',
  periodo text NOT NULL DEFAULT '30d',
  frequencia text NOT NULL DEFAULT 'semanal',
  dia_semana smallint NOT NULL DEFAULT 1,
  dia_mes smallint NOT NULL DEFAULT 1,
  hora smallint NOT NULL DEFAULT 8,
  destinatarios text[] NOT NULL DEFAULT '{}',
  enviar_para_permissao text,
  incluir_corretores boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ultima_execucao timestamptz,
  proxima_execucao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_agendados TO authenticated;
GRANT ALL ON public.relatorios_agendados TO service_role;
ALTER TABLE public.relatorios_agendados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relatorios_agendados_select" ON public.relatorios_agendados FOR SELECT TO authenticated USING (imobiliaria_id = auth.uid());
CREATE POLICY "relatorios_agendados_insert" ON public.relatorios_agendados FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "relatorios_agendados_update" ON public.relatorios_agendados FOR UPDATE TO authenticated USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "relatorios_agendados_delete" ON public.relatorios_agendados FOR DELETE TO authenticated USING (imobiliaria_id = auth.uid());

CREATE INDEX idx_relatorios_agendados_proxima ON public.relatorios_agendados (ativo, proxima_execucao);
CREATE INDEX idx_relatorios_agendados_imob ON public.relatorios_agendados (imobiliaria_id);

CREATE TRIGGER update_relatorios_agendados_updated_at
BEFORE UPDATE ON public.relatorios_agendados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.relatorios_agendados_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL REFERENCES public.relatorios_agendados(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'sucesso',
  formato text,
  total_registros integer NOT NULL DEFAULT 0,
  destinatarios text[] NOT NULL DEFAULT '{}',
  erro text,
  executado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.relatorios_agendados_execucoes TO authenticated;
GRANT ALL ON public.relatorios_agendados_execucoes TO service_role;
ALTER TABLE public.relatorios_agendados_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relatorios_execucoes_select" ON public.relatorios_agendados_execucoes FOR SELECT TO authenticated USING (imobiliaria_id = auth.uid());

CREATE INDEX idx_relatorios_execucoes_rel ON public.relatorios_agendados_execucoes (relatorio_id, executado_em DESC);