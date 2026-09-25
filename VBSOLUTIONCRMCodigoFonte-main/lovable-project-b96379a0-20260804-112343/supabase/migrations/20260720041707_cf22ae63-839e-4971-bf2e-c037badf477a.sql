
-- 1) Solicitações do titular
CREATE TABLE public.lgpd_solicitacoes_titular (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('acesso','correcao','exclusao','oposicao','portabilidade','revogacao_consentimento','anonimizacao','informacao_uso')),
  status TEXT NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','em_verificacao','em_analise','atendida','rejeitada','expirada')),
  titular_nome TEXT,
  titular_email TEXT,
  titular_telefone TEXT,
  titular_documento TEXT,
  descricao TEXT,
  evidencia_identidade JSONB DEFAULT '{}'::jsonb,
  lead_ids UUID[] DEFAULT ARRAY[]::UUID[],
  base_legal_invocada TEXT,
  resposta TEXT,
  respondido_por UUID,
  respondido_em TIMESTAMPTZ,
  prazo_legal_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 days'),
  canal_recebimento TEXT NOT NULL DEFAULT 'portal_publico',
  ip_origem TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lgpd_sol_imob ON public.lgpd_solicitacoes_titular(imobiliaria_id, status, created_at DESC);
CREATE INDEX idx_lgpd_sol_email ON public.lgpd_solicitacoes_titular(lower(titular_email));
CREATE INDEX idx_lgpd_sol_prazo ON public.lgpd_solicitacoes_titular(prazo_legal_em) WHERE status IN ('recebida','em_verificacao','em_analise');

GRANT SELECT, UPDATE ON public.lgpd_solicitacoes_titular TO authenticated;
GRANT ALL ON public.lgpd_solicitacoes_titular TO service_role;

ALTER TABLE public.lgpd_solicitacoes_titular ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master/admin da imobiliária vê solicitações"
  ON public.lgpd_solicitacoes_titular FOR SELECT
  TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE POLICY "Master/admin da imobiliária atualiza solicitações"
  ON public.lgpd_solicitacoes_titular FOR UPDATE
  TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

-- 2) Consentimentos por lead captado
CREATE TABLE public.lgpd_consentimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  lista_proprietario_id UUID,
  lead_id UUID,
  finalidade TEXT NOT NULL,
  base_legal TEXT NOT NULL DEFAULT 'legitimo_interesse'
    CHECK (base_legal IN ('consentimento','legitimo_interesse','cumprimento_obrigacao_legal','execucao_contrato','exercicio_direitos','protecao_credito','tutela_saude','politicas_publicas','pesquisa','protecao_vida')),
  origem_dado TEXT NOT NULL DEFAULT 'coleta_publica',
  consentimento_ativo BOOLEAN NOT NULL DEFAULT true,
  revogado_em TIMESTAMPTZ,
  revogado_por TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lgpd_consent_lista ON public.lgpd_consentimentos(lista_proprietario_id);
CREATE INDEX idx_lgpd_consent_imob ON public.lgpd_consentimentos(imobiliaria_id, consentimento_ativo);

GRANT SELECT, INSERT, UPDATE ON public.lgpd_consentimentos TO authenticated;
GRANT ALL ON public.lgpd_consentimentos TO service_role;

ALTER TABLE public.lgpd_consentimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Imobiliária gerencia consentimentos próprios"
  ON public.lgpd_consentimentos FOR ALL
  TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

-- 3) Verificações de identidade (tokens)
CREATE TABLE public.lgpd_titular_verificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id UUID REFERENCES public.lgpd_solicitacoes_titular(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  canal TEXT NOT NULL CHECK (canal IN ('email','whatsapp')),
  destino TEXT NOT NULL,
  tentativas INT NOT NULL DEFAULT 0,
  verificado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lgpd_verif_token ON public.lgpd_titular_verificacoes(token_hash);
CREATE INDEX idx_lgpd_verif_sol ON public.lgpd_titular_verificacoes(solicitacao_id);

GRANT SELECT ON public.lgpd_titular_verificacoes TO authenticated;
GRANT ALL ON public.lgpd_titular_verificacoes TO service_role;

ALTER TABLE public.lgpd_titular_verificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Imobiliária vê próprias verificações"
  ON public.lgpd_titular_verificacoes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lgpd_solicitacoes_titular s
    WHERE s.id = solicitacao_id AND s.imobiliaria_id = auth.uid()
  ));

-- 4) updated_at trigger reusar util existente ou criar local
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_lgpd_sol_updated BEFORE UPDATE ON public.lgpd_solicitacoes_titular
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lgpd_consent_updated BEFORE UPDATE ON public.lgpd_consentimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RPC para localizar leads/proprietários por documento/e-mail/telefone (uso interno da edge function)
CREATE OR REPLACE FUNCTION public.lgpd_localizar_registros_titular(
  _email TEXT,
  _telefone TEXT,
  _documento TEXT
) RETURNS TABLE (
  imobiliaria_id UUID,
  lista_proprietario_id UUID,
  fonte TEXT,
  titulo TEXT,
  criado_em TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT lp.imobiliaria_id, lp.id, 'lista_proprietarios_captacao'::text,
         COALESCE(lp.titulo_imovel, lp.nome_proprietario, 'Anúncio')::text,
         lp.created_at
  FROM public.lista_proprietarios_captacao lp
  WHERE (_email IS NOT NULL AND lower(lp.nome_proprietario) = lower(_email))
     OR (_telefone IS NOT NULL AND regexp_replace(coalesce(lp.telefone,''), '\D', '', 'g') LIKE '%' || regexp_replace(_telefone, '\D', '', 'g') || '%');
END; $$;

REVOKE ALL ON FUNCTION public.lgpd_localizar_registros_titular(TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lgpd_localizar_registros_titular(TEXT,TEXT,TEXT) TO service_role;

-- 6) RPC para contagem/dashboard LGPD do painel admin
CREATE OR REPLACE FUNCTION public.lgpd_metricas_imobiliaria(_imobiliaria_id UUID)
RETURNS TABLE (
  total_recebidas INT,
  pendentes INT,
  atendidas INT,
  proximas_do_prazo INT,
  vencidas INT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status IN ('recebida','em_verificacao','em_analise'))::int,
    COUNT(*) FILTER (WHERE status = 'atendida')::int,
    COUNT(*) FILTER (WHERE status IN ('recebida','em_verificacao','em_analise') AND prazo_legal_em < now() + interval '3 days' AND prazo_legal_em >= now())::int,
    COUNT(*) FILTER (WHERE status IN ('recebida','em_verificacao','em_analise') AND prazo_legal_em < now())::int
  FROM public.lgpd_solicitacoes_titular
  WHERE imobiliaria_id = _imobiliaria_id;
$$;

GRANT EXECUTE ON FUNCTION public.lgpd_metricas_imobiliaria(UUID) TO authenticated, service_role;
