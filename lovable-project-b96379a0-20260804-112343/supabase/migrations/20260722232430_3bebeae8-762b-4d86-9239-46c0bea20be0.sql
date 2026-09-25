-- ============================================================
-- MÓDULO: Monitoramento inteligente de fontes públicas
-- Fontes: telegram_channel | portal_crawler | facebook_apify
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monitoramento_fontes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('telegram_channel','portal_crawler','facebook_apify')),
  nome text NOT NULL,
  descricao text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Filtros de foco (usados pelo normalizador)
  cidades_alvo text[] DEFAULT '{}',
  bairros_alvo text[] DEFAULT '{}',
  operacao_alvo text[] DEFAULT '{venda,locacao}',
  -- LGPD
  fonte_url_publica text,
  base_legal text NOT NULL DEFAULT 'art7_iv_publico',
  ativo boolean NOT NULL DEFAULT true,
  ultima_execucao_em timestamptz,
  ultima_captura_em timestamptz,
  total_capturas bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoramento_fontes TO authenticated;
GRANT ALL ON public.monitoramento_fontes TO service_role;

ALTER TABLE public.monitoramento_fontes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant lê suas fontes" ON public.monitoramento_fontes
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "tenant escreve suas fontes" ON public.monitoramento_fontes
  FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mon_fontes_tenant_tipo
  ON public.monitoramento_fontes (imobiliaria_id, tipo, ativo);

-- ==== Capturas brutas + fila de normalização =================
CREATE TABLE IF NOT EXISTS public.monitoramento_capturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  fonte_id uuid NOT NULL REFERENCES public.monitoramento_fontes(id) ON DELETE CASCADE,
  tipo_fonte text NOT NULL,
  external_id text NOT NULL,       -- update_id, listing_id, apify_item_id, etc.
  url_origem text,                 -- URL pública original (sempre exibida no CRM)
  titulo text,
  texto text,
  cidade text,
  uf text,
  bairro text,
  operacao text,                   -- venda | locacao
  preco numeric,
  tipo_imovel text,
  telefone text,
  nome_contato text,
  media_urls text[] DEFAULT '{}',
  payload_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','processado','descartado','erro','duplicado')),
  motivo text,
  processado_em timestamptz,
  radarzap_lead_id uuid,
  captado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fonte_id, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoramento_capturas TO authenticated;
GRANT ALL ON public.monitoramento_capturas TO service_role;

ALTER TABLE public.monitoramento_capturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant lê suas capturas" ON public.monitoramento_capturas
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "service_role gerencia capturas" ON public.monitoramento_capturas
  FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mon_capturas_status
  ON public.monitoramento_capturas (imobiliaria_id, status, captado_em DESC);
CREATE INDEX IF NOT EXISTS idx_mon_capturas_fonte
  ON public.monitoramento_capturas (fonte_id, captado_em DESC);

-- ==== Log de execução (para painel de status/health) =========
CREATE TABLE IF NOT EXISTS public.monitoramento_execucoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid,
  fonte_id uuid REFERENCES public.monitoramento_fontes(id) ON DELETE SET NULL,
  tipo_fonte text NOT NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  duracao_ms integer,
  itens_capturados integer NOT NULL DEFAULT 0,
  itens_novos integer NOT NULL DEFAULT 0,
  itens_duplicados integer NOT NULL DEFAULT 0,
  itens_descartados integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','erro','parcial')),
  erro text,
  detalhes jsonb DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.monitoramento_execucoes_log TO authenticated;
GRANT ALL ON public.monitoramento_execucoes_log TO service_role;

ALTER TABLE public.monitoramento_execucoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant lê seus logs" ON public.monitoramento_execucoes_log
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid() OR imobiliaria_id IS NULL OR public.is_master(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mon_exec_iniciado
  ON public.monitoramento_execucoes_log (iniciado_em DESC);

-- ==== Trigger updated_at =====================================
CREATE OR REPLACE FUNCTION public.tg_mon_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mon_fontes_updated ON public.monitoramento_fontes;
CREATE TRIGGER trg_mon_fontes_updated
  BEFORE UPDATE ON public.monitoramento_fontes
  FOR EACH ROW EXECUTE FUNCTION public.tg_mon_touch_updated_at();

REVOKE ALL ON FUNCTION public.tg_mon_touch_updated_at() FROM PUBLIC, anon, authenticated;