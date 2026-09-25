
-- =========================================================
-- AUTOMAÇÕES DE FOLLOW-UP AVANÇADAS
-- =========================================================

-- 1) TABELA DE REGRAS
CREATE TABLE IF NOT EXISTS public.automacao_followup_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  tipo text NOT NULL CHECK (tipo IN ('transicao_etapa','agendamento_expirado')),
  estagio_origem text,
  estagio_destino text,
  acao_titulo text NOT NULL DEFAULT 'Follow-up automático',
  acao_descricao text NOT NULL DEFAULT 'Ação de follow-up para {lead}',
  prazo_tarefa_horas integer NOT NULL DEFAULT 72,
  escalonamento_horas integer NOT NULL DEFAULT 4,
  notificar_gerente boolean NOT NULL DEFAULT true,
  tipo_followup text NOT NULL DEFAULT 'tarefa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacao_followup_regras TO authenticated;
GRANT ALL ON public.automacao_followup_regras TO service_role;
ALTER TABLE public.automacao_followup_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regras: tenant read" ON public.automacao_followup_regras
  FOR SELECT TO authenticated USING (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "regras: tenant insert" ON public.automacao_followup_regras
  FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "regras: tenant update" ON public.automacao_followup_regras
  FOR UPDATE TO authenticated USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "regras: tenant delete" ON public.automacao_followup_regras
  FOR DELETE TO authenticated USING (imobiliaria_id = auth.uid());

CREATE TRIGGER trg_regras_updated_at BEFORE UPDATE ON public.automacao_followup_regras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_regras_imob_tipo ON public.automacao_followup_regras(imobiliaria_id, tipo, ativo);

-- 2) TABELA DE EXECUÇÕES
CREATE TABLE IF NOT EXISTS public.automacao_followup_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  regra_id uuid REFERENCES public.automacao_followup_regras(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  lead_id uuid,
  compromisso_id uuid,
  followup_id uuid,
  estagio_origem text,
  estagio_destino text,
  escalado boolean NOT NULL DEFAULT false,
  escalado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.automacao_followup_execucoes TO authenticated;
GRANT ALL ON public.automacao_followup_execucoes TO service_role;
ALTER TABLE public.automacao_followup_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exec: tenant read" ON public.automacao_followup_execucoes
  FOR SELECT TO authenticated USING (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "exec: service insert" ON public.automacao_followup_execucoes
  FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_exec_imob ON public.automacao_followup_execucoes(imobiliaria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_compromisso ON public.automacao_followup_execucoes(compromisso_id);
CREATE INDEX IF NOT EXISTS idx_exec_escalado ON public.automacao_followup_execucoes(escalado, created_at);

-- 3) FUNÇÃO DE TRANSIÇÃO DE LEAD
CREATE OR REPLACE FUNCTION public.processar_transicao_lead_automacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_desc text;
  v_titulo text;
  v_data date;
  v_fu_id uuid;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.estagio IS NOT DISTINCT FROM NEW.estagio THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT * FROM public.automacao_followup_regras
    WHERE imobiliaria_id = NEW.imobiliaria_id
      AND ativo = true
      AND tipo = 'transicao_etapa'
      AND (estagio_destino IS NULL OR LOWER(estagio_destino) = LOWER(NEW.estagio))
      AND (estagio_origem IS NULL OR LOWER(estagio_origem) = LOWER(COALESCE(OLD.estagio,'')))
  LOOP
    v_titulo := replace(replace(r.acao_titulo, '{lead}', NEW.nome), '{estagio}', NEW.estagio);
    v_desc := replace(replace(replace(r.acao_descricao,
                '{lead}', NEW.nome),
                '{estagio}', NEW.estagio),
                '{prazo}', r.prazo_tarefa_horas::text || 'h');
    v_data := (now() + make_interval(hours => r.prazo_tarefa_horas))::date;

    INSERT INTO public.followups (lead_id, imobiliaria_id, data_followup, tipo, descricao, status)
    VALUES (NEW.id, NEW.imobiliaria_id, v_data, r.tipo_followup,
            '[AUTO] ' || v_titulo || ' — ' || v_desc, 'pendente')
    RETURNING id INTO v_fu_id;

    -- Notificar vendedor (corretor) e/ou imobiliária
    IF NEW.corretor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, description)
      SELECT c.imobiliaria_id, '🔔 ' || v_titulo,
             'Lead "' || NEW.nome || '" mudou para ' || NEW.estagio || '. Tarefa criada com prazo em ' || r.prazo_tarefa_horas || 'h.'
      FROM public.corretores c WHERE c.id = NEW.corretor_id;
    END IF;

    IF r.notificar_gerente THEN
      INSERT INTO public.notifications (user_id, title, description)
      VALUES (NEW.imobiliaria_id, '📋 Automação disparada',
              'Lead "' || NEW.nome || '" → ' || NEW.estagio || '. Tarefa criada (prazo ' || r.prazo_tarefa_horas || 'h).');
    END IF;

    INSERT INTO public.automacao_followup_execucoes
      (imobiliaria_id, regra_id, tipo, lead_id, followup_id, estagio_origem, estagio_destino)
    VALUES (NEW.imobiliaria_id, r.id, 'transicao_etapa', NEW.id, v_fu_id, OLD.estagio, NEW.estagio);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_transicao_automacao ON public.leads;
CREATE TRIGGER trg_lead_transicao_automacao
AFTER UPDATE OF estagio ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.processar_transicao_lead_automacao();

-- 4) SEED por tenant (idempotente) — retorna número inserido
CREATE OR REPLACE FUNCTION public.seed_automacao_followup_defaults(_imob uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.automacao_followup_regras WHERE imobiliaria_id = _imob) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.automacao_followup_regras
    (imobiliaria_id, tipo, estagio_origem, estagio_destino, acao_titulo, acao_descricao, prazo_tarefa_horas, escalonamento_horas, notificar_gerente, tipo_followup)
  VALUES
    (_imob,'transicao_etapa','novos','qualificado','Ligar em 24h para qualificação','Contatar {lead} para qualificar interesse.',24,4,true,'ligacao'),
    (_imob,'transicao_etapa','qualificado','proposta_enviada','Preparar proposta','Preparar e enviar proposta para {lead} em até {prazo}.',4,2,true,'tarefa'),
    (_imob,'transicao_etapa','proposta_enviada','negociacao','Follow-up da proposta','Fazer follow-up da proposta com {lead} em 3 dias.',72,8,true,'whatsapp'),
    (_imob,'agendamento_expirado',NULL,NULL,'Reagendar imediatamente','Agendamento expirado com {lead}. Tentar reagendar ou contatar imediatamente.',2,4,true,'ligacao');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
