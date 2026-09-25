
-- Notificações de prospecção de condomínios: fila + configuração + triggers

CREATE TABLE IF NOT EXISTS public.condominio_notificacoes_config (
  imobiliaria_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wa_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  destinatarios_wa text[] NOT NULL DEFAULT ARRAY[]::text[],
  destinatarios_email text[] NOT NULL DEFAULT ARRAY[]::text[],
  tipos_habilitados text[] NOT NULL DEFAULT ARRAY['etapa_avancada','resposta_recebida','sem_contato_max']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominio_notificacoes_config TO authenticated;
GRANT ALL ON public.condominio_notificacoes_config TO service_role;
ALTER TABLE public.condominio_notificacoes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "condo_notif_cfg_owner_all" ON public.condominio_notificacoes_config
  FOR ALL USING (auth.uid() = imobiliaria_id) WITH CHECK (auth.uid() = imobiliaria_id);

CREATE TRIGGER condo_notif_cfg_touch
  BEFORE UPDATE ON public.condominio_notificacoes_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.condominio_notificacoes_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  prospeccao_id uuid,
  condominio_nome text,
  tipo text NOT NULL CHECK (tipo IN ('etapa_avancada','resposta_recebida','sem_contato_max')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','skipped','failed')),
  tentativas int NOT NULL DEFAULT 0,
  ultimo_erro text,
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS condo_notif_eventos_pending_idx
  ON public.condominio_notificacoes_eventos (status, created_at)
  WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS condo_notif_eventos_imob_idx
  ON public.condominio_notificacoes_eventos (imobiliaria_id, created_at DESC);

GRANT SELECT ON public.condominio_notificacoes_eventos TO authenticated;
GRANT ALL ON public.condominio_notificacoes_eventos TO service_role;
ALTER TABLE public.condominio_notificacoes_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "condo_notif_ev_owner_read" ON public.condominio_notificacoes_eventos
  FOR SELECT USING (auth.uid() = imobiliaria_id);

-- Trigger: etapa avançada (etapas_concluidas cresceu)
CREATE OR REPLACE FUNCTION public.condo_notif_on_prospeccao_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_len int := COALESCE(array_length(OLD.etapas_concluidas, 1), 0);
  new_len int := COALESCE(array_length(NEW.etapas_concluidas, 1), 0);
  nova_etapa text;
BEGIN
  IF new_len > old_len THEN
    nova_etapa := NEW.etapas_concluidas[new_len];
    INSERT INTO public.condominio_notificacoes_eventos
      (imobiliaria_id, prospeccao_id, condominio_nome, tipo, payload)
    VALUES (
      NEW.imobiliaria_id,
      NEW.id,
      NEW.condominio_nome,
      'etapa_avancada',
      jsonb_build_object(
        'etapa', nova_etapa,
        'progresso', NEW.progresso,
        'status', NEW.status,
        'bairro', NEW.bairro
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS condo_notif_prospeccao_upd ON public.condominio_prospeccoes;
CREATE TRIGGER condo_notif_prospeccao_upd
  AFTER UPDATE ON public.condominio_prospeccoes
  FOR EACH ROW EXECUTE FUNCTION public.condo_notif_on_prospeccao_update();

-- Trigger: agendamento concluído (resposta) ou pausado por limite (sem contato)
CREATE OR REPLACE FUNCTION public.condo_notif_on_agendamento_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cond_nome text;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT condominio_nome INTO cond_nome
  FROM public.condominio_prospeccoes WHERE id = NEW.prospeccao_id;

  IF NEW.status = 'concluida' THEN
    INSERT INTO public.condominio_notificacoes_eventos
      (imobiliaria_id, prospeccao_id, condominio_nome, tipo, payload)
    VALUES (
      NEW.imobiliaria_id, NEW.prospeccao_id, cond_nome, 'resposta_recebida',
      jsonb_build_object(
        'etapa', NEW.etapa,
        'tentativa', NEW.tentativa_num,
        'observacao', NEW.observacao,
        'concluido_em', NEW.concluido_em
      )
    );
  ELSIF NEW.status = 'pausada' AND NEW.tentativa_num >= NEW.max_tentativas THEN
    INSERT INTO public.condominio_notificacoes_eventos
      (imobiliaria_id, prospeccao_id, condominio_nome, tipo, payload)
    VALUES (
      NEW.imobiliaria_id, NEW.prospeccao_id, cond_nome, 'sem_contato_max',
      jsonb_build_object(
        'etapa', NEW.etapa,
        'tentativas', NEW.tentativa_num,
        'max_tentativas', NEW.max_tentativas,
        'motivo', NEW.motivo_pausa,
        'pausado_ate', NEW.pausado_ate
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS condo_notif_agendamento_upd ON public.condominio_prospeccao_agendamentos;
CREATE TRIGGER condo_notif_agendamento_upd
  AFTER UPDATE ON public.condominio_prospeccao_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.condo_notif_on_agendamento_update();
