
CREATE TABLE public.whatsapp_termos_consentimento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  versao TEXT NOT NULL,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  finalidades TEXT[] NOT NULL DEFAULT ARRAY['comunicacao_transacional','marketing_imobiliario']::text[],
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_termos_consentimento TO authenticated;
GRANT SELECT ON public.whatsapp_termos_consentimento TO anon;
GRANT ALL ON public.whatsapp_termos_consentimento TO service_role;
ALTER TABLE public.whatsapp_termos_consentimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Imobiliaria gerencia seus termos" ON public.whatsapp_termos_consentimento FOR ALL TO authenticated USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "Publico le termos ativos" ON public.whatsapp_termos_consentimento FOR SELECT TO anon USING (ativo = true);

CREATE TABLE public.whatsapp_consentimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  telefone TEXT NOT NULL,
  telefone_norm TEXT NOT NULL,
  nome_contato TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','revogado','bloqueado','expirado')),
  canal_origem TEXT NOT NULL CHECK (canal_origem IN ('landing_page','formulario_captacao','crm_corretor','double_optin','importacao','api')),
  origem_referencia TEXT,
  termo_id UUID REFERENCES public.whatsapp_termos_consentimento(id) ON DELETE SET NULL,
  termo_versao TEXT,
  finalidades TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ip_origem INET,
  user_agent TEXT,
  token_publico TEXT NOT NULL UNIQUE,
  double_optin_token TEXT,
  double_optin_enviado_em TIMESTAMPTZ,
  double_optin_confirmado_em TIMESTAMPTZ,
  aceito_em TIMESTAMPTZ,
  revogado_em TIMESTAMPTZ,
  revogado_por TEXT,
  motivo_revogacao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, telefone_norm)
);
CREATE INDEX idx_wa_cons_imob_status ON public.whatsapp_consentimentos(imobiliaria_id, status);
CREATE INDEX idx_wa_cons_telefone ON public.whatsapp_consentimentos(telefone_norm);
CREATE INDEX idx_wa_cons_token ON public.whatsapp_consentimentos(token_publico);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_consentimentos TO authenticated;
GRANT SELECT, UPDATE ON public.whatsapp_consentimentos TO anon;
GRANT ALL ON public.whatsapp_consentimentos TO service_role;
ALTER TABLE public.whatsapp_consentimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Imobiliaria gerencia seus consentimentos" ON public.whatsapp_consentimentos FOR ALL TO authenticated USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "Titular consulta via token" ON public.whatsapp_consentimentos FOR SELECT TO anon USING (token_publico IS NOT NULL);
CREATE POLICY "Titular revoga via token" ON public.whatsapp_consentimentos FOR UPDATE TO anon USING (token_publico IS NOT NULL AND status IN ('ativo','pendente')) WITH CHECK (status = 'revogado');

CREATE TABLE public.whatsapp_consentimento_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consentimento_id UUID NOT NULL REFERENCES public.whatsapp_consentimentos(id) ON DELETE CASCADE,
  imobiliaria_id UUID NOT NULL,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('optin_solicitado','optin_confirmado','optin_reenviado','mensagem_enviada','mensagem_bloqueada','optout_solicitado','optout_palavra_chave','optout_manual','optout_admin','reativacao','importacao','termo_atualizado','acesso_portal_titular','export_dados')),
  descricao TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_origem INET,
  user_agent TEXT,
  ator_tipo TEXT CHECK (ator_tipo IN ('titular','corretor','sistema','admin','api_externa')),
  ator_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_eventos_cons ON public.whatsapp_consentimento_eventos(consentimento_id, created_at DESC);
CREATE INDEX idx_wa_eventos_imob_tipo ON public.whatsapp_consentimento_eventos(imobiliaria_id, tipo_evento, created_at DESC);
GRANT SELECT, INSERT ON public.whatsapp_consentimento_eventos TO authenticated;
GRANT SELECT ON public.whatsapp_consentimento_eventos TO anon;
GRANT ALL ON public.whatsapp_consentimento_eventos TO service_role;
ALTER TABLE public.whatsapp_consentimento_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Imobiliaria le seus eventos" ON public.whatsapp_consentimento_eventos FOR SELECT TO authenticated USING (imobiliaria_id = auth.uid());
CREATE POLICY "Imobiliaria insere eventos" ON public.whatsapp_consentimento_eventos FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "Titular le seus eventos via consentimento" ON public.whatsapp_consentimento_eventos FOR SELECT TO anon USING (consentimento_id IN (SELECT id FROM public.whatsapp_consentimentos WHERE token_publico IS NOT NULL));

CREATE OR REPLACE FUNCTION public.normalize_phone(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(RIGHT(regexp_replace(COALESCE(p,''), '[^0-9]', '', 'g'), 13), '');
$$;

CREATE OR REPLACE FUNCTION public.gen_secure_token()
RETURNS TEXT LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

CREATE OR REPLACE FUNCTION public.tg_wa_cons_prepare()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.telefone_norm := public.normalize_phone(NEW.telefone);
  IF NEW.telefone_norm IS NULL OR length(NEW.telefone_norm) < 10 THEN
    RAISE EXCEPTION 'Telefone invalido: minimo 10 digitos';
  END IF;
  IF NEW.token_publico IS NULL THEN
    NEW.token_publico := public.gen_secure_token();
  END IF;
  IF NEW.canal_origem = 'double_optin' AND NEW.double_optin_token IS NULL THEN
    NEW.double_optin_token := substring(public.gen_secure_token(), 1, 32);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_wa_cons_prepare BEFORE INSERT OR UPDATE ON public.whatsapp_consentimentos FOR EACH ROW EXECUTE FUNCTION public.tg_wa_cons_prepare();

CREATE OR REPLACE FUNCTION public.tg_wa_cons_audit_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_evento TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_evento := CASE WHEN NEW.status = 'ativo' THEN 'optin_confirmado' ELSE 'optin_solicitado' END;
    INSERT INTO public.whatsapp_consentimento_eventos (consentimento_id, imobiliaria_id, tipo_evento, descricao, ator_tipo, ip_origem, user_agent, metadata)
    VALUES (NEW.id, NEW.imobiliaria_id, v_evento, 'Registro criado via ' || NEW.canal_origem, 'sistema', NEW.ip_origem, NEW.user_agent, jsonb_build_object('canal', NEW.canal_origem, 'termo_versao', NEW.termo_versao));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_evento := CASE NEW.status
      WHEN 'ativo' THEN 'optin_confirmado'
      WHEN 'revogado' THEN COALESCE(CASE WHEN NEW.motivo_revogacao ILIKE '%palavra%' THEN 'optout_palavra_chave' END, 'optout_manual')
      WHEN 'bloqueado' THEN 'optout_admin'
      WHEN 'pendente' THEN 'reativacao'
      ELSE 'optin_solicitado' END;
    INSERT INTO public.whatsapp_consentimento_eventos (consentimento_id, imobiliaria_id, tipo_evento, descricao, ator_tipo, metadata)
    VALUES (NEW.id, NEW.imobiliaria_id, v_evento, 'Status ' || OLD.status || ' -> ' || NEW.status || COALESCE(' (' || NEW.motivo_revogacao || ')', ''), 'sistema', jsonb_build_object('status_anterior', OLD.status, 'status_novo', NEW.status, 'motivo', NEW.motivo_revogacao, 'revogado_por', NEW.revogado_por));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_wa_cons_audit_status AFTER INSERT OR UPDATE OF status ON public.whatsapp_consentimentos FOR EACH ROW EXECUTE FUNCTION public.tg_wa_cons_audit_status();

CREATE OR REPLACE FUNCTION public.tg_wa_msg_check_consent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm TEXT; v_status TEXT; v_cons_id UUID; v_is_optin_msg BOOLEAN;
BEGIN
  IF COALESCE(NEW.direcao, 'saida') <> 'saida' THEN RETURN NEW; END IF;
  v_is_optin_msg := COALESCE((NEW.metadata->>'is_double_optin')::boolean, false);
  IF v_is_optin_msg THEN RETURN NEW; END IF;
  v_norm := public.normalize_phone(NEW.telefone);
  IF v_norm IS NULL THEN RETURN NEW; END IF;
  SELECT id, status INTO v_cons_id, v_status FROM public.whatsapp_consentimentos WHERE imobiliaria_id = NEW.imobiliaria_id AND telefone_norm = v_norm LIMIT 1;
  IF v_status IS NULL OR v_status <> 'ativo' THEN
    IF v_cons_id IS NOT NULL THEN
      INSERT INTO public.whatsapp_consentimento_eventos (consentimento_id, imobiliaria_id, tipo_evento, descricao, ator_tipo, metadata)
      VALUES (v_cons_id, NEW.imobiliaria_id, 'mensagem_bloqueada', 'Envio bloqueado: consentimento ' || COALESCE(v_status,'inexistente'), 'sistema', jsonb_build_object('telefone', v_norm, 'preview', LEFT(COALESCE(NEW.mensagem,''), 120)));
    END IF;
    RAISE EXCEPTION 'WHATSAPP_CONSENTIMENTO_AUSENTE: envio bloqueado para % (status=%)', v_norm, COALESCE(v_status,'sem_registro') USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.whatsapp_consentimento_eventos (consentimento_id, imobiliaria_id, tipo_evento, descricao, ator_tipo, metadata)
  VALUES (v_cons_id, NEW.imobiliaria_id, 'mensagem_enviada', 'Envio autorizado', 'sistema', jsonb_build_object('telefone', v_norm, 'preview', LEFT(COALESCE(NEW.mensagem,''), 120)));
  RETURN NEW;
END; $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mensagens_whatsapp') THEN
    DROP TRIGGER IF EXISTS trg_wa_msg_check_consent ON public.mensagens_whatsapp;
    CREATE TRIGGER trg_wa_msg_check_consent BEFORE INSERT ON public.mensagens_whatsapp FOR EACH ROW EXECUTE FUNCTION public.tg_wa_msg_check_consent();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.wa_processar_optout_keyword(p_imobiliaria_id UUID, p_telefone TEXT, p_mensagem TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm TEXT; v_msg_upper TEXT; v_cons_id UUID;
BEGIN
  v_norm := public.normalize_phone(p_telefone);
  v_msg_upper := UPPER(TRIM(COALESCE(p_mensagem,'')));
  IF v_msg_upper !~ '^(SAIR|PARAR|CANCELAR|DESCADASTRAR|CANCELA|STOP|SAIU|REMOVER|EXCLUIR)( .*)?$' THEN
    RETURN false;
  END IF;
  UPDATE public.whatsapp_consentimentos SET status = 'revogado', revogado_em = now(), revogado_por = 'titular_whatsapp', motivo_revogacao = 'Palavra-chave de saida: ' || v_msg_upper
    WHERE imobiliaria_id = p_imobiliaria_id AND telefone_norm = v_norm AND status IN ('ativo','pendente')
    RETURNING id INTO v_cons_id;
  RETURN v_cons_id IS NOT NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_wa_termo_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_wa_termo_touch BEFORE UPDATE ON public.whatsapp_termos_consentimento FOR EACH ROW EXECUTE FUNCTION public.tg_wa_termo_touch();
