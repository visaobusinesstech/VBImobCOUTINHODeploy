CREATE TABLE public.nutricao_metas_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  fluxo_id UUID REFERENCES public.nutricao_fluxos(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  janela_dias INTEGER NOT NULL DEFAULT 14,
  min_envios INTEGER NOT NULL DEFAULT 10,
  meta_abertura NUMERIC NOT NULL DEFAULT 25,
  meta_resposta NUMERIC NOT NULL DEFAULT 10,
  meta_agendamento NUMERIC NOT NULL DEFAULT 5,
  meta_fechamento NUMERIC NOT NULL DEFAULT 1,
  alertar_zero_agendamento BOOLEAN NOT NULL DEFAULT true,
  alertar_zero_resposta BOOLEAN NOT NULL DEFAULT true,
  frequencia_horas INTEGER NOT NULL DEFAULT 24,
  notificar_app BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX nutricao_metas_config_unico ON public.nutricao_metas_config (imobiliaria_id, COALESCE(fluxo_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutricao_metas_config TO authenticated;
GRANT ALL ON public.nutricao_metas_config TO service_role;
ALTER TABLE public.nutricao_metas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metas_config_own" ON public.nutricao_metas_config FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());

CREATE TABLE public.nutricao_metas_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  fluxo_id UUID REFERENCES public.nutricao_fluxos(id) ON DELETE CASCADE,
  fluxo_nome TEXT,
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL DEFAULT 'alerta',
  mensagem TEXT NOT NULL,
  metrica TEXT,
  valor NUMERIC,
  meta NUMERIC,
  envios INTEGER,
  janela_dias INTEGER,
  resolvido BOOLEAN NOT NULL DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutricao_metas_alertas_imob ON public.nutricao_metas_alertas (imobiliaria_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutricao_metas_alertas TO authenticated;
GRANT ALL ON public.nutricao_metas_alertas TO service_role;
ALTER TABLE public.nutricao_metas_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metas_alertas_own" ON public.nutricao_metas_alertas FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());

CREATE TRIGGER trg_nutricao_metas_config_updated
  BEFORE UPDATE ON public.nutricao_metas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();