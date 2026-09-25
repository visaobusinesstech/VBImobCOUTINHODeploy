
-- 1) Colunas de configuração de follow-up automático (RadarZAP)
ALTER TABLE public.radarzap_scoring_config
  ADD COLUMN IF NOT EXISTS followup_auto_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS followup_sla_horas integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS followup_tipo text NOT NULL DEFAULT 'ligacao';

ALTER TABLE public.radarzap_scoring_config
  DROP CONSTRAINT IF EXISTS radarzap_scoring_config_followup_sla_horas_check;
ALTER TABLE public.radarzap_scoring_config
  ADD CONSTRAINT radarzap_scoring_config_followup_sla_horas_check
  CHECK (followup_sla_horas >= 1 AND followup_sla_horas <= 720);

ALTER TABLE public.radarzap_scoring_config
  DROP CONSTRAINT IF EXISTS radarzap_scoring_config_followup_tipo_check;
ALTER TABLE public.radarzap_scoring_config
  ADD CONSTRAINT radarzap_scoring_config_followup_tipo_check
  CHECK (followup_tipo IN ('ligacao','whatsapp','email','visita','outro'));

-- 2) Trigger: cria follow-up automático quando um lead do RadarZAP é inserido
CREATE OR REPLACE FUNCTION public.radarzap_criar_followup_auto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ativo boolean := true;
  v_sla int := 2;
  v_tipo text := 'ligacao';
  v_prazo timestamptz;
  v_data date;
  v_fu_id uuid;
BEGIN
  -- Só age em leads do RadarZAP
  IF coalesce(NEW.canal_origem, '') <> 'RadarZAP' THEN
    RETURN NEW;
  END IF;

  SELECT followup_auto_ativo, followup_sla_horas, followup_tipo
    INTO v_ativo, v_sla, v_tipo
    FROM public.radarzap_scoring_config
   WHERE imobiliaria_id = NEW.imobiliaria_id
   LIMIT 1;

  IF v_ativo IS FALSE THEN
    RETURN NEW;
  END IF;

  v_sla := coalesce(v_sla, 2);
  v_tipo := coalesce(v_tipo, 'ligacao');
  v_prazo := now() + (v_sla || ' hours')::interval;
  v_data := v_prazo::date;

  -- Evita duplicar se já houver follow-up pendente para o lead
  IF EXISTS (
    SELECT 1 FROM public.followups
     WHERE lead_id = NEW.id AND status = 'pendente'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.followups (
    imobiliaria_id, lead_id, data_followup, tipo, status, descricao
  ) VALUES (
    NEW.imobiliaria_id,
    NEW.id,
    v_data,
    v_tipo,
    'pendente',
    concat_ws(E'\n',
      'Follow-up automático (RadarZAP)',
      'SLA: contatar em até ' || v_sla || 'h',
      'Prazo alvo: ' || to_char(v_prazo, 'DD/MM/YYYY HH24:MI'),
      CASE WHEN NEW.corretor_id IS NOT NULL
           THEN 'Responsável (regra do pipeline): corretor_id=' || NEW.corretor_id::text
           ELSE 'Responsável: a atribuir (nenhuma regra do pipeline correspondeu)'
      END
    )
  ) RETURNING id INTO v_fu_id;

  INSERT INTO public.lead_atividades (
    lead_id, imobiliaria_id, tipo, titulo, descricao
  ) VALUES (
    NEW.id,
    NEW.imobiliaria_id,
    'sistema',
    'Follow-up automático agendado (RadarZAP)',
    concat_ws(E'\n',
      'Tipo: ' || v_tipo,
      'SLA: ' || v_sla || 'h',
      'Prazo alvo: ' || to_char(v_prazo, 'DD/MM/YYYY HH24:MI'),
      'Follow-up ID: ' || v_fu_id::text
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_radarzap_criar_followup_auto ON public.leads;
CREATE TRIGGER trg_radarzap_criar_followup_auto
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.radarzap_criar_followup_auto();
