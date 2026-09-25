CREATE TABLE public.nutricao_fluxos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  publico_alvo text NOT NULL DEFAULT 'lead_inativo',
  dias_inatividade integer NOT NULL DEFAULT 30,
  canal text NOT NULL DEFAULT 'whatsapp',
  encerrar_ao_responder boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.nutricao_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id uuid NOT NULL REFERENCES public.nutricao_fluxos(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  dias_apos integer NOT NULL DEFAULT 0,
  canal text NOT NULL DEFAULT 'whatsapp',
  titulo text NOT NULL,
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.nutricao_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  fluxo_id uuid NOT NULL REFERENCES public.nutricao_fluxos(id) ON DELETE CASCADE,
  lead_id uuid,
  cliente_id uuid,
  nome text,
  telefone text,
  email text,
  status text NOT NULL DEFAULT 'ativa',
  etapa_atual integer NOT NULL DEFAULT 0,
  proxima_execucao timestamptz NOT NULL DEFAULT now(),
  ultima_execucao timestamptz,
  motivo_encerramento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX nutricao_inscricoes_fluxo_lead_uidx
  ON public.nutricao_inscricoes (fluxo_id, lead_id)
  WHERE lead_id IS NOT NULL;

CREATE TABLE public.nutricao_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  inscricao_id uuid NOT NULL REFERENCES public.nutricao_inscricoes(id) ON DELETE CASCADE,
  etapa_id uuid REFERENCES public.nutricao_etapas(id) ON DELETE SET NULL,
  lead_id uuid,
  canal text NOT NULL DEFAULT 'whatsapp',
  destino text,
  titulo text,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  erro text,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX nutricao_etapas_fluxo_idx ON public.nutricao_etapas (fluxo_id, ordem);
CREATE INDEX nutricao_inscricoes_proxima_idx ON public.nutricao_inscricoes (status, proxima_execucao);
CREATE INDEX nutricao_envios_inscricao_idx ON public.nutricao_envios (inscricao_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutricao_fluxos TO authenticated;
GRANT ALL ON public.nutricao_fluxos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutricao_etapas TO authenticated;
GRANT ALL ON public.nutricao_etapas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutricao_inscricoes TO authenticated;
GRANT ALL ON public.nutricao_inscricoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutricao_envios TO authenticated;
GRANT ALL ON public.nutricao_envios TO service_role;

ALTER TABLE public.nutricao_fluxos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutricao_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutricao_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutricao_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own nutricao_fluxos" ON public.nutricao_fluxos FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "Own nutricao_etapas" ON public.nutricao_etapas FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "Own nutricao_inscricoes" ON public.nutricao_inscricoes FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "Own nutricao_envios" ON public.nutricao_envios FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());

CREATE TRIGGER update_nutricao_fluxos_updated_at BEFORE UPDATE ON public.nutricao_fluxos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_nutricao_etapas_updated_at BEFORE UPDATE ON public.nutricao_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_nutricao_inscricoes_updated_at BEFORE UPDATE ON public.nutricao_inscricoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_nutricao_envios_updated_at BEFORE UPDATE ON public.nutricao_envios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();