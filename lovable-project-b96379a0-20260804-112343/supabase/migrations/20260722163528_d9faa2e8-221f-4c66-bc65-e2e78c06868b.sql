
-- 1) Config: dias de follow-up e liga/desliga
ALTER TABLE public.captacao_pipeline_config
  ADD COLUMN IF NOT EXISTS sla_followup_dias_json jsonb NOT NULL DEFAULT '[1,3,7,14]'::jsonb,
  ADD COLUMN IF NOT EXISTS followup_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS followup_atraso_horas integer NOT NULL DEFAULT 24;

-- 2) Tabela de follow-ups do pipeline de captação
CREATE TABLE IF NOT EXISTS public.captacao_pipeline_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  pipeline_id uuid NOT NULL REFERENCES public.captacao_pipeline(id) ON DELETE CASCADE,
  corretor_id uuid,
  dia_offset integer NOT NULL,
  agendado_para timestamptz NOT NULL,
  canal text NOT NULL DEFAULT 'whatsapp',
  tipo text NOT NULL DEFAULT 'lembrete',
  status text NOT NULL DEFAULT 'pendente',
  notificado_em timestamptz,
  executado_em timestamptz,
  executado_por uuid,
  resultado text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpf_tenant_status ON public.captacao_pipeline_followups(imobiliaria_id, status, agendado_para);
CREATE INDEX IF NOT EXISTS idx_cpf_pipeline ON public.captacao_pipeline_followups(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_cpf_due ON public.captacao_pipeline_followups(status, agendado_para) WHERE status = 'pendente';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacao_pipeline_followups TO authenticated;
GRANT ALL ON public.captacao_pipeline_followups TO service_role;

ALTER TABLE public.captacao_pipeline_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpf tenant select" ON public.captacao_pipeline_followups
  FOR SELECT TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "cpf tenant insert" ON public.captacao_pipeline_followups
  FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "cpf tenant update" ON public.captacao_pipeline_followups
  FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id))
  WITH CHECK (can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "cpf tenant delete" ON public.captacao_pipeline_followups
  FOR DELETE TO authenticated
  USING (imobiliaria_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_cpf_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cpf_touch ON public.captacao_pipeline_followups;
CREATE TRIGGER trg_cpf_touch BEFORE UPDATE ON public.captacao_pipeline_followups
FOR EACH ROW EXECUTE FUNCTION public.tg_cpf_touch();

-- 3) Trigger: ao criar card, gerar follow-ups conforme config
CREATE OR REPLACE FUNCTION public.tg_captacao_seed_followups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dias jsonb;
  v_ativo boolean;
  v_dia int;
BEGIN
  IF NEW.estagio IN ('Contrato Assinado','Perdido') THEN RETURN NEW; END IF;

  SELECT COALESCE(sla_followup_dias_json,'[1,3,7,14]'::jsonb), COALESCE(followup_ativo,true)
    INTO v_dias, v_ativo
  FROM public.captacao_pipeline_config
  WHERE imobiliaria_id = NEW.imobiliaria_id;

  IF v_dias IS NULL THEN v_dias := '[1,3,7,14]'::jsonb; v_ativo := true; END IF;
  IF NOT v_ativo THEN RETURN NEW; END IF;

  FOR v_dia IN SELECT (value)::int FROM jsonb_array_elements_text(v_dias)
  LOOP
    INSERT INTO public.captacao_pipeline_followups(
      imobiliaria_id, pipeline_id, corretor_id, dia_offset, agendado_para, canal, tipo, status
    ) VALUES (
      NEW.imobiliaria_id, NEW.id, NEW.corretor_id, v_dia,
      NEW.created_at + make_interval(days => v_dia),
      CASE WHEN v_dia <= 1 THEN 'whatsapp' WHEN v_dia <= 7 THEN 'ligacao' ELSE 'email' END,
      'lembrete', 'pendente'
    );
  END LOOP;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_captacao_seed_followups ON public.captacao_pipeline;
CREATE TRIGGER trg_captacao_seed_followups
AFTER INSERT ON public.captacao_pipeline
FOR EACH ROW EXECUTE FUNCTION public.tg_captacao_seed_followups();

-- 4) Trigger: quando card fecha (Contrato/Perdido), cancela pendentes
CREATE OR REPLACE FUNCTION public.tg_captacao_cancel_followups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.estagio IN ('Contrato Assinado','Perdido')
     AND (OLD.estagio IS DISTINCT FROM NEW.estagio) THEN
    UPDATE public.captacao_pipeline_followups
       SET status = 'cancelado', observacao = COALESCE(observacao,'') || ' [auto-cancelado: estagio=' || NEW.estagio::text || ']'
     WHERE pipeline_id = NEW.id AND status = 'pendente';
  END IF;
  -- sincroniza corretor
  IF NEW.corretor_id IS DISTINCT FROM OLD.corretor_id THEN
    UPDATE public.captacao_pipeline_followups
       SET corretor_id = NEW.corretor_id
     WHERE pipeline_id = NEW.id AND status = 'pendente';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_captacao_cancel_followups ON public.captacao_pipeline;
CREATE TRIGGER trg_captacao_cancel_followups
AFTER UPDATE ON public.captacao_pipeline
FOR EACH ROW EXECUTE FUNCTION public.tg_captacao_cancel_followups();

-- 5) Rotina de processamento: notifica pendentes vencidos e marca atrasados
CREATE OR REPLACE FUNCTION public.processar_captacao_followups()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_notificados int := 0;
  v_atrasados int := 0;
  r record;
  v_atraso_h int;
BEGIN
  -- Notificar quem venceu e ainda não foi notificado
  FOR r IN
    SELECT f.id, f.imobiliaria_id, f.corretor_id, f.canal, f.dia_offset, f.agendado_para,
           cp.nome AS lead_nome, cp.telefone, cp.imovel_cidade, cp.imovel_bairro
    FROM public.captacao_pipeline_followups f
    JOIN public.captacao_pipeline cp ON cp.id = f.pipeline_id
    WHERE f.status = 'pendente'
      AND f.notificado_em IS NULL
      AND f.agendado_para <= now()
    LIMIT 500
  LOOP
    INSERT INTO public.notifications(user_id, title, description, type)
    VALUES (
      COALESCE(r.corretor_id, r.imobiliaria_id),
      'Follow-up D+' || r.dia_offset || ' — ' || r.lead_nome,
      'Contato via ' || r.canal || COALESCE(' • ' || r.imovel_bairro,'') || COALESCE(' / ' || r.imovel_cidade,''),
      'captacao_followup'
    );
    UPDATE public.captacao_pipeline_followups SET notificado_em = now() WHERE id = r.id;
    v_notificados := v_notificados + 1;
  END LOOP;

  -- Marcar atrasados
  FOR r IN
    SELECT f.id, COALESCE(cfg.followup_atraso_horas, 24) AS atraso_h
    FROM public.captacao_pipeline_followups f
    LEFT JOIN public.captacao_pipeline_config cfg ON cfg.imobiliaria_id = f.imobiliaria_id
    WHERE f.status = 'pendente'
      AND f.agendado_para <= now() - make_interval(hours => COALESCE(cfg.followup_atraso_horas,24))
    LIMIT 500
  LOOP
    UPDATE public.captacao_pipeline_followups
       SET status = 'atrasado'
     WHERE id = r.id;
    v_atrasados := v_atrasados + 1;
  END LOOP;

  RETURN jsonb_build_object('notificados', v_notificados, 'atrasados', v_atrasados, 'executado_em', now());
END; $$;

GRANT EXECUTE ON FUNCTION public.processar_captacao_followups() TO authenticated, service_role;
