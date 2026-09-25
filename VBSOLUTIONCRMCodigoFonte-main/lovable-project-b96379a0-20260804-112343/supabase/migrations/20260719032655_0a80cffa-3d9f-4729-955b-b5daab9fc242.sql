
-- ENUM
DO $$ BEGIN
  CREATE TYPE public.captacao_pipeline_estagio AS ENUM (
    'Prospectado','Contactado','Interessado','Avaliacao Enviada','Autorizacao','Contrato Assinado','Perdido'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CONFIG
CREATE TABLE IF NOT EXISTS public.captacao_pipeline_config (
  imobiliaria_id uuid PRIMARY KEY,
  sla_prospectado_horas int NOT NULL DEFAULT 24,
  sla_contactado_horas int NOT NULL DEFAULT 48,
  sla_interessado_horas int NOT NULL DEFAULT 72,
  sla_avaliacao_horas int NOT NULL DEFAULT 120,
  sla_autorizacao_horas int NOT NULL DEFAULT 168,
  sla_inatividade_horas int NOT NULL DEFAULT 168,
  sla_escalonamento_horas_extra int NOT NULL DEFAULT 24,
  alertas_email_ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacao_pipeline_config TO authenticated;
GRANT ALL ON public.captacao_pipeline_config TO service_role;
ALTER TABLE public.captacao_pipeline_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpc tenant select" ON public.captacao_pipeline_config FOR SELECT TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "cpc tenant insert" ON public.captacao_pipeline_config FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "cpc tenant update" ON public.captacao_pipeline_config FOR UPDATE TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id)) WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "cpc tenant delete" ON public.captacao_pipeline_config FOR DELETE TO authenticated
  USING (imobiliaria_id = auth.uid());

-- MAIN TABLE
CREATE TABLE IF NOT EXISTS public.captacao_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  corretor_id uuid REFERENCES public.corretores(id) ON DELETE SET NULL,
  created_by uuid,
  nome text NOT NULL,
  telefone text,
  telefone_e164 text,
  email text,
  imovel_endereco text,
  imovel_cidade text,
  imovel_bairro text,
  imovel_tipo text,
  operacao text,
  valor_estimado numeric,
  origem text,
  estagio public.captacao_pipeline_estagio NOT NULL DEFAULT 'Prospectado',
  estagio_desde timestamptz NOT NULL DEFAULT now(),
  ultima_atividade_em timestamptz,
  escalonado_em timestamptz,
  perdido_motivo text,
  won_valor numeric,
  won_em timestamptz,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cp_tenant_estagio ON public.captacao_pipeline(imobiliaria_id, estagio);
CREATE INDEX IF NOT EXISTS idx_cp_tenant_corretor ON public.captacao_pipeline(imobiliaria_id, corretor_id);
CREATE INDEX IF NOT EXISTS idx_cp_tenant_estagio_desde ON public.captacao_pipeline(imobiliaria_id, estagio_desde);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacao_pipeline TO authenticated;
GRANT ALL ON public.captacao_pipeline TO service_role;
ALTER TABLE public.captacao_pipeline ENABLE ROW LEVEL SECURITY;

-- Access: tenant + corretor scope
CREATE POLICY "cp select" ON public.captacao_pipeline FOR SELECT TO authenticated
USING (
  public.can_access_imobiliaria(imobiliaria_id)
  AND (
    public.is_master(auth.uid())
    OR imobiliaria_id = auth.uid()
    OR corretor_id IN (SELECT id FROM public.corretores WHERE imobiliaria_id = captacao_pipeline.imobiliaria_id AND email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
  )
);
CREATE POLICY "cp insert" ON public.captacao_pipeline FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() OR public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "cp update" ON public.captacao_pipeline FOR UPDATE TO authenticated
USING (public.can_access_imobiliaria(imobiliaria_id))
WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "cp delete" ON public.captacao_pipeline FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));

-- HISTORICO
CREATE TABLE IF NOT EXISTS public.captacao_pipeline_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.captacao_pipeline(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  de_estagio public.captacao_pipeline_estagio,
  para_estagio public.captacao_pipeline_estagio NOT NULL,
  movido_por uuid,
  duracao_horas numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cph_pipeline ON public.captacao_pipeline_historico(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_cph_tenant ON public.captacao_pipeline_historico(imobiliaria_id, created_at DESC);
GRANT SELECT, INSERT ON public.captacao_pipeline_historico TO authenticated;
GRANT ALL ON public.captacao_pipeline_historico TO service_role;
ALTER TABLE public.captacao_pipeline_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cph select" ON public.captacao_pipeline_historico FOR SELECT TO authenticated
USING (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "cph insert" ON public.captacao_pipeline_historico FOR INSERT TO authenticated
WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));

-- ATIVIDADES
CREATE TABLE IF NOT EXISTS public.captacao_pipeline_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.captacao_pipeline(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  tipo text NOT NULL,
  descricao text,
  data_atividade timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpa_pipeline ON public.captacao_pipeline_atividades(pipeline_id, data_atividade DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captacao_pipeline_atividades TO authenticated;
GRANT ALL ON public.captacao_pipeline_atividades TO service_role;
ALTER TABLE public.captacao_pipeline_atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpa select" ON public.captacao_pipeline_atividades FOR SELECT TO authenticated
USING (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "cpa insert" ON public.captacao_pipeline_atividades FOR INSERT TO authenticated
WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "cpa update" ON public.captacao_pipeline_atividades FOR UPDATE TO authenticated
USING (public.can_access_imobiliaria(imobiliaria_id))
WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));
CREATE POLICY "cpa delete" ON public.captacao_pipeline_atividades FOR DELETE TO authenticated
USING (public.can_access_imobiliaria(imobiliaria_id));

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.tg_captacao_pipeline_biu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dur numeric;
BEGIN
  NEW.updated_at := now();
  IF NEW.telefone IS NOT NULL THEN
    NEW.telefone_e164 := public.normalize_phone_e164(NEW.telefone);
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.estagio_desde := COALESCE(NEW.estagio_desde, now());
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.estagio IS DISTINCT FROM OLD.estagio THEN
    v_dur := EXTRACT(EPOCH FROM (now() - OLD.estagio_desde))/3600.0;
    INSERT INTO public.captacao_pipeline_historico(pipeline_id, imobiliaria_id, de_estagio, para_estagio, movido_por, duracao_horas)
    VALUES (NEW.id, NEW.imobiliaria_id, OLD.estagio, NEW.estagio, auth.uid(), v_dur);
    NEW.estagio_desde := now();
    NEW.escalonado_em := NULL;
    IF NEW.estagio = 'Contrato Assinado' AND NEW.won_em IS NULL THEN
      NEW.won_em := now();
      NEW.won_valor := COALESCE(NEW.won_valor, NEW.valor_estimado);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cp_biu ON public.captacao_pipeline;
CREATE TRIGGER trg_cp_biu BEFORE INSERT OR UPDATE ON public.captacao_pipeline
FOR EACH ROW EXECUTE FUNCTION public.tg_captacao_pipeline_biu();

CREATE OR REPLACE FUNCTION public.tg_captacao_pipeline_atv_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.captacao_pipeline SET ultima_atividade_em = now(), updated_at = now()
   WHERE id = NEW.pipeline_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cpa_touch ON public.captacao_pipeline_atividades;
CREATE TRIGGER trg_cpa_touch AFTER INSERT ON public.captacao_pipeline_atividades
FOR EACH ROW EXECUTE FUNCTION public.tg_captacao_pipeline_atv_touch();

-- RPC: MOVE
CREATE OR REPLACE FUNCTION public.captacao_pipeline_move(_id uuid, _to public.captacao_pipeline_estagio, _motivo text DEFAULT NULL)
RETURNS public.captacao_pipeline LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.captacao_pipeline;
BEGIN
  SELECT * INTO v_row FROM public.captacao_pipeline WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'nao_encontrado' USING ERRCODE='P0002'; END IF;
  IF NOT public.can_access_imobiliaria(v_row.imobiliaria_id) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE='42501';
  END IF;
  UPDATE public.captacao_pipeline
     SET estagio = _to,
         perdido_motivo = CASE WHEN _to = 'Perdido' THEN COALESCE(_motivo, perdido_motivo) ELSE perdido_motivo END
   WHERE id = _id
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- RPC: METRICS
CREATE OR REPLACE FUNCTION public.captacao_pipeline_metricas(_corretor_id uuid DEFAULT NULL, _desde date DEFAULT NULL, _ate date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_imob uuid := public.get_user_imobiliaria_id();
  v_por_estagio jsonb; v_tempo_medio jsonb; v_conversao jsonb;
  v_pipeline_value numeric; v_won_value numeric; v_win_rate numeric;
  v_total_atividades int; v_total int; v_won int;
BEGIN
  IF v_imob IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT jsonb_object_agg(estagio::text, cnt) INTO v_por_estagio
  FROM (
    SELECT estagio, count(*) cnt
    FROM public.captacao_pipeline
    WHERE imobiliaria_id = v_imob
      AND (_corretor_id IS NULL OR corretor_id = _corretor_id)
      AND (_desde IS NULL OR created_at >= _desde)
      AND (_ate IS NULL OR created_at < (_ate + 1))
    GROUP BY estagio
  ) t;

  SELECT jsonb_object_agg(para_estagio::text, avg_h) INTO v_tempo_medio
  FROM (
    SELECT h.para_estagio, ROUND(AVG(h.duracao_horas)::numeric, 2) avg_h
    FROM public.captacao_pipeline_historico h
    JOIN public.captacao_pipeline p ON p.id = h.pipeline_id
    WHERE h.imobiliaria_id = v_imob
      AND (_corretor_id IS NULL OR p.corretor_id = _corretor_id)
      AND (_desde IS NULL OR h.created_at >= _desde)
      AND (_ate IS NULL OR h.created_at < (_ate + 1))
    GROUP BY h.para_estagio
  ) t;

  SELECT COUNT(*) INTO v_total FROM public.captacao_pipeline
   WHERE imobiliaria_id = v_imob
     AND (_corretor_id IS NULL OR corretor_id = _corretor_id)
     AND (_desde IS NULL OR created_at >= _desde)
     AND (_ate IS NULL OR created_at < (_ate + 1));

  SELECT COUNT(*), COALESCE(SUM(won_valor),0) INTO v_won, v_won_value FROM public.captacao_pipeline
   WHERE imobiliaria_id = v_imob AND estagio = 'Contrato Assinado'
     AND (_corretor_id IS NULL OR corretor_id = _corretor_id)
     AND (_desde IS NULL OR won_em >= _desde)
     AND (_ate IS NULL OR won_em < (_ate + 1));

  SELECT COALESCE(SUM(valor_estimado),0) INTO v_pipeline_value FROM public.captacao_pipeline
   WHERE imobiliaria_id = v_imob AND estagio NOT IN ('Contrato Assinado','Perdido')
     AND (_corretor_id IS NULL OR corretor_id = _corretor_id);

  v_win_rate := CASE WHEN v_total > 0 THEN ROUND((v_won::numeric / v_total::numeric) * 100, 2) ELSE 0 END;

  SELECT COUNT(*) INTO v_total_atividades FROM public.captacao_pipeline_atividades a
   JOIN public.captacao_pipeline p ON p.id = a.pipeline_id
   WHERE a.imobiliaria_id = v_imob
     AND (_corretor_id IS NULL OR p.corretor_id = _corretor_id)
     AND (_desde IS NULL OR a.data_atividade >= _desde)
     AND (_ate IS NULL OR a.data_atividade < (_ate + 1));

  RETURN jsonb_build_object(
    'por_estagio', COALESCE(v_por_estagio, '{}'::jsonb),
    'tempo_medio_horas', COALESCE(v_tempo_medio, '{}'::jsonb),
    'pipeline_value', COALESCE(v_pipeline_value,0),
    'won_value', COALESCE(v_won_value,0),
    'win_rate', v_win_rate,
    'total_atividades', COALESCE(v_total_atividades,0),
    'total_leads', v_total,
    'ganhos', v_won
  );
END $$;

-- RPC: SLA PENDENTES
CREATE OR REPLACE FUNCTION public.captacao_pipeline_sla_pendentes()
RETURNS TABLE(
  id uuid, imobiliaria_id uuid, corretor_id uuid, nome text, estagio public.captacao_pipeline_estagio,
  estagio_desde timestamptz, ultima_atividade_em timestamptz, horas_no_estagio numeric,
  sla_horas int, tipo_alerta text, escalonado_em timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_imob uuid := public.get_user_imobiliaria_id();
BEGIN
  IF v_imob IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH cfg AS (
    SELECT * FROM public.captacao_pipeline_config WHERE imobiliaria_id = v_imob
  ), pip AS (
    SELECT p.*, EXTRACT(EPOCH FROM (now()-p.estagio_desde))/3600.0 AS horas
    FROM public.captacao_pipeline p
    WHERE p.imobiliaria_id = v_imob AND p.estagio NOT IN ('Contrato Assinado','Perdido')
  )
  SELECT p.id, p.imobiliaria_id, p.corretor_id, p.nome, p.estagio, p.estagio_desde, p.ultima_atividade_em,
    ROUND(p.horas::numeric,2),
    CASE p.estagio
      WHEN 'Prospectado' THEN COALESCE((SELECT sla_prospectado_horas FROM cfg),24)
      WHEN 'Contactado' THEN COALESCE((SELECT sla_contactado_horas FROM cfg),48)
      WHEN 'Interessado' THEN COALESCE((SELECT sla_interessado_horas FROM cfg),72)
      WHEN 'Avaliacao Enviada' THEN COALESCE((SELECT sla_avaliacao_horas FROM cfg),120)
      WHEN 'Autorizacao' THEN COALESCE((SELECT sla_autorizacao_horas FROM cfg),168)
      ELSE 0 END AS sla_horas,
    CASE
      WHEN p.ultima_atividade_em IS NOT NULL
       AND EXTRACT(EPOCH FROM (now()-p.ultima_atividade_em))/3600.0 > COALESCE((SELECT sla_inatividade_horas FROM cfg),168)
        THEN 'inatividade'
      ELSE 'estagio' END AS tipo_alerta,
    p.escalonado_em
  FROM pip p
  WHERE (
    (p.estagio = 'Prospectado' AND p.horas > COALESCE((SELECT sla_prospectado_horas FROM cfg),24))
 OR (p.estagio = 'Contactado' AND p.horas > COALESCE((SELECT sla_contactado_horas FROM cfg),48))
 OR (p.estagio = 'Interessado' AND p.horas > COALESCE((SELECT sla_interessado_horas FROM cfg),72))
 OR (p.estagio = 'Avaliacao Enviada' AND p.horas > COALESCE((SELECT sla_avaliacao_horas FROM cfg),120))
 OR (p.estagio = 'Autorizacao' AND p.horas > COALESCE((SELECT sla_autorizacao_horas FROM cfg),168))
 OR (p.ultima_atividade_em IS NOT NULL AND EXTRACT(EPOCH FROM (now()-p.ultima_atividade_em))/3600.0 > COALESCE((SELECT sla_inatividade_horas FROM cfg),168))
  )
  ORDER BY p.horas DESC;
END $$;
