-- Rastreabilidade de fontes públicas (LGPD) para captação de proprietários

-- 1) Allowlist de fontes públicas
CREATE TABLE public.captacao_fontes_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid, -- NULL = regra global (só master edita)
  dominio_pattern text NOT NULL,
  fonte_tipo text NOT NULL CHECK (fonte_tipo IN (
    'portal_imobiliario','diario_oficial','cartorio_ri',
    'site_institucional','rede_social_publica','outra_publica'
  )),
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, dominio_pattern)
);

GRANT SELECT ON public.captacao_fontes_allowlist TO authenticated;
GRANT ALL ON public.captacao_fontes_allowlist TO service_role;

ALTER TABLE public.captacao_fontes_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowlist read" ON public.captacao_fontes_allowlist
  FOR SELECT TO authenticated
  USING (imobiliaria_id IS NULL OR imobiliaria_id = auth.uid() OR is_master(auth.uid()));

CREATE POLICY "allowlist insert master ou tenant" ON public.captacao_fontes_allowlist
  FOR INSERT TO authenticated
  WITH CHECK (
    (imobiliaria_id IS NULL AND is_master(auth.uid())) OR
    (imobiliaria_id = auth.uid())
  );

CREATE POLICY "allowlist update master ou tenant" ON public.captacao_fontes_allowlist
  FOR UPDATE TO authenticated
  USING (
    (imobiliaria_id IS NULL AND is_master(auth.uid())) OR
    (imobiliaria_id = auth.uid())
  );

CREATE POLICY "allowlist delete master ou tenant" ON public.captacao_fontes_allowlist
  FOR DELETE TO authenticated
  USING (
    (imobiliaria_id IS NULL AND is_master(auth.uid())) OR
    (imobiliaria_id = auth.uid())
  );

-- 2) Fontes por campo x lead
CREATE TABLE public.captacao_fontes_dados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  lead_tipo text NOT NULL CHECK (lead_tipo IN ('lista_proprietarios','pipeline')),
  lead_id uuid NOT NULL,
  campo text NOT NULL, -- nome, telefone, email, endereco, preco, ...
  valor_capturado text,
  fonte_url text NOT NULL,
  fonte_tipo text NOT NULL,
  fonte_titulo text,
  fonte_snippet text,
  fonte_expirada boolean NOT NULL DEFAULT false,
  base_legal text NOT NULL DEFAULT 'art7_iv_publico'
    CHECK (base_legal IN ('art7_iv_publico','art7_ix_legitimo_interesse')),
  coletado_por uuid,
  metodo_coleta text NOT NULL DEFAULT 'manual'
    CHECK (metodo_coleta IN ('firecrawl','radarzap','manual','import','portal_scraper')),
  hash_conteudo text,
  ativo boolean NOT NULL DEFAULT true,
  removido_em timestamptz,
  removido_motivo text,
  coletado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fontes_lead ON public.captacao_fontes_dados (imobiliaria_id, lead_tipo, lead_id);
CREATE INDEX idx_fontes_ativas ON public.captacao_fontes_dados (imobiliaria_id, ativo) WHERE ativo = true;

GRANT SELECT, INSERT ON public.captacao_fontes_dados TO authenticated;
GRANT ALL ON public.captacao_fontes_dados TO service_role;

ALTER TABLE public.captacao_fontes_dados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fontes read tenant" ON public.captacao_fontes_dados
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid() OR is_master(auth.uid()));

CREATE POLICY "fontes insert tenant" ON public.captacao_fontes_dados
  FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());

-- Update/delete só via service_role (edge functions) para preservar cadeia de auditoria.

-- 3) Solicitações LGPD do titular
CREATE TABLE public.captacao_lgpd_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  lead_tipo text NOT NULL CHECK (lead_tipo IN ('lista_proprietarios','pipeline')),
  lead_id uuid NOT NULL,
  tipo_solicitacao text NOT NULL CHECK (tipo_solicitacao IN ('remocao','retificacao','acesso','oposicao')),
  contato_titular text,
  descricao text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','atendida','rejeitada')),
  atendida_em timestamptz,
  atendida_por uuid,
  observacao_interna text,
  token_verificacao text,
  ip_origem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lgpd_solicitacoes_lead ON public.captacao_lgpd_solicitacoes (imobiliaria_id, status);

GRANT SELECT, UPDATE ON public.captacao_lgpd_solicitacoes TO authenticated;
GRANT ALL ON public.captacao_lgpd_solicitacoes TO service_role;

ALTER TABLE public.captacao_lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lgpd sol read tenant" ON public.captacao_lgpd_solicitacoes
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid() OR is_master(auth.uid()));

CREATE POLICY "lgpd sol update tenant" ON public.captacao_lgpd_solicitacoes
  FOR UPDATE TO authenticated
  USING (imobiliaria_id = auth.uid() OR is_master(auth.uid()));

-- 4) Colunas de cache nos leads
ALTER TABLE public.lista_proprietarios_captacao
  ADD COLUMN IF NOT EXISTS fontes_resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lgpd_status text NOT NULL DEFAULT 'parcial'
    CHECK (lgpd_status IN ('ok','parcial','remocao_solicitada','removido'));

ALTER TABLE public.captacao_pipeline
  ADD COLUMN IF NOT EXISTS fontes_resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lgpd_status text NOT NULL DEFAULT 'parcial'
    CHECK (lgpd_status IN ('ok','parcial','remocao_solicitada','removido'));

-- 5) Trigger updated_at padrão
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_fontes_allowlist_upd BEFORE UPDATE ON public.captacao_fontes_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_fontes_dados_upd BEFORE UPDATE ON public.captacao_fontes_dados
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_lgpd_sol_upd BEFORE UPDATE ON public.captacao_lgpd_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 6) Função para recalcular resumo/status de um lead
CREATE OR REPLACE FUNCTION public.recalcular_fontes_lead(
  p_lead_tipo text, p_lead_id uuid, p_imobiliaria_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resumo jsonb := '{}'::jsonb;
  campos_criticos text[] := ARRAY['nome','telefone','email'];
  cobertos int := 0;
  status_calc text;
BEGIN
  SELECT COALESCE(jsonb_object_agg(campo, jsonb_build_object(
    'url', fonte_url,
    'tipo', fonte_tipo,
    'coletado_em', coletado_em,
    'expirada', fonte_expirada
  )), '{}'::jsonb)
  INTO resumo
  FROM (
    SELECT DISTINCT ON (campo) campo, fonte_url, fonte_tipo, coletado_em, fonte_expirada
    FROM public.captacao_fontes_dados
    WHERE lead_tipo = p_lead_tipo AND lead_id = p_lead_id
      AND imobiliaria_id = p_imobiliaria_id AND ativo = true
    ORDER BY campo, coletado_em DESC
  ) t;

  SELECT count(*) INTO cobertos
  FROM jsonb_object_keys(resumo) k
  WHERE k = ANY(campos_criticos);

  IF cobertos >= 2 THEN status_calc := 'ok';
  ELSE status_calc := 'parcial'; END IF;

  IF p_lead_tipo = 'lista_proprietarios' THEN
    UPDATE public.lista_proprietarios_captacao
    SET fontes_resumo = resumo,
        lgpd_status = CASE WHEN lgpd_status IN ('remocao_solicitada','removido')
                           THEN lgpd_status ELSE status_calc END
    WHERE id = p_lead_id AND imobiliaria_id = p_imobiliaria_id;
  ELSIF p_lead_tipo = 'pipeline' THEN
    UPDATE public.captacao_pipeline
    SET fontes_resumo = resumo,
        lgpd_status = CASE WHEN lgpd_status IN ('remocao_solicitada','removido')
                           THEN lgpd_status ELSE status_calc END
    WHERE id = p_lead_id AND imobiliaria_id = p_imobiliaria_id;
  END IF;
END; $$;

-- 7) Trigger que dispara recalculo após insert/update em fontes
CREATE OR REPLACE FUNCTION public.tg_fontes_recalcular()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_fontes_lead(NEW.lead_tipo, NEW.lead_id, NEW.imobiliaria_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fontes_recalc AFTER INSERT OR UPDATE ON public.captacao_fontes_dados
  FOR EACH ROW EXECUTE FUNCTION public.tg_fontes_recalcular();

-- 8) Seed inicial da allowlist (portais brasileiros públicos)
INSERT INTO public.captacao_fontes_allowlist (imobiliaria_id, dominio_pattern, fonte_tipo, descricao) VALUES
  (NULL, '%vivareal.com.br%',     'portal_imobiliario', 'VivaReal'),
  (NULL, '%zapimoveis.com.br%',   'portal_imobiliario', 'ZAP Imóveis'),
  (NULL, '%olx.com.br%',          'portal_imobiliario', 'OLX Imóveis'),
  (NULL, '%imovelweb.com.br%',    'portal_imobiliario', 'ImovelWeb'),
  (NULL, '%chavesnamao.com.br%',  'portal_imobiliario', 'Chaves na Mão'),
  (NULL, '%dfimoveis.com.br%',    'portal_imobiliario', 'DFImóveis'),
  (NULL, '%wimoveis.com.br%',     'portal_imobiliario', 'Wimóveis'),
  (NULL, '%netimoveis.com%',      'portal_imobiliario', 'Netimóveis'),
  (NULL, '%imovelguide.com.br%',  'portal_imobiliario', 'Imóvel Guide'),
  (NULL, '%mercadolivre.com.br/imoveis%', 'portal_imobiliario', 'Mercado Livre Imóveis'),
  (NULL, '%in.gov.br%',           'diario_oficial',     'Diário Oficial da União'),
  (NULL, '%dodf.df.gov.br%',      'diario_oficial',     'Diário Oficial do DF'),
  (NULL, '%imprensaoficial.com.br%', 'diario_oficial',  'Imprensa Oficial SP'),
  (NULL, '%registrodeimoveis.org.br%', 'cartorio_ri',   'ONR – Portal do Registro de Imóveis'),
  (NULL, '%receita.economia.gov.br%',  'site_institucional', 'Receita Federal — dados públicos'),
  (NULL, '%gov.br%',              'site_institucional', 'Portal Gov.br'),
  (NULL, '%creci.org.br%',        'site_institucional', 'CRECI'),
  (NULL, '%facebook.com/marketplace%', 'rede_social_publica', 'Facebook Marketplace (anúncio público)')
ON CONFLICT DO NOTHING;
