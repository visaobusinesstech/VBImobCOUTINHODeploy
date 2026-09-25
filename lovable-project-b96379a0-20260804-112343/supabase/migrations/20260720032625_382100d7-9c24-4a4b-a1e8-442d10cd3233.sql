
-- ============ CONFIG ============
CREATE TABLE IF NOT EXISTS public.alertas_captacao_config (
  imobiliaria_id uuid PRIMARY KEY,
  enabled_app boolean NOT NULL DEFAULT true,
  enabled_whatsapp boolean NOT NULL DEFAULT true,
  score_min_alerta integer NOT NULL DEFAULT 75,
  niveis_monitorados text[] NOT NULL DEFAULT ARRAY['morno','quente','fervendo'],
  only_on_upgrade boolean NOT NULL DEFAULT true,
  whatsapp_grupo_numero text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_captacao_config TO authenticated;
GRANT ALL ON public.alertas_captacao_config TO service_role;

ALTER TABLE public.alertas_captacao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own alertas config"
  ON public.alertas_captacao_config FOR ALL
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_alertas_captacao_config_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_alertas_captacao_config_updated_at ON public.alertas_captacao_config;
CREATE TRIGGER trg_alertas_captacao_config_updated_at
  BEFORE UPDATE ON public.alertas_captacao_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_alertas_captacao_config_updated_at();

-- ============ LOG ============
CREATE TABLE IF NOT EXISTS public.alertas_captacao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  proprietario_id uuid NOT NULL,
  proprietario_nome text,
  imovel_ref text,
  tipo_evento text NOT NULL, -- 'upgrade_nivel' | 'score_threshold' | 'novo_quente'
  nivel_anterior text,
  nivel_novo text,
  score_anterior integer,
  score_novo integer,
  corretor_id uuid,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  link text,
  delivered_app boolean NOT NULL DEFAULT false,
  delivered_whatsapp boolean NOT NULL DEFAULT false,
  whatsapp_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_captacao_log_imob_created
  ON public.alertas_captacao_log (imobiliaria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_captacao_log_corretor
  ON public.alertas_captacao_log (corretor_id, created_at DESC);

GRANT SELECT ON public.alertas_captacao_log TO authenticated;
GRANT ALL ON public.alertas_captacao_log TO service_role;

ALTER TABLE public.alertas_captacao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant reads own alertas log"
  ON public.alertas_captacao_log FOR SELECT
  USING (imobiliaria_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_captacao_log;

-- ============ TRIGGER PRINCIPAL ============
CREATE OR REPLACE FUNCTION public.tg_lpc_alertas_captacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg public.alertas_captacao_config%ROWTYPE;
  v_corretor_id uuid;
  v_tipo text;
  v_should_alert boolean := false;
  v_alert_id uuid;
  v_nivel_rank_new int;
  v_nivel_rank_old int;
  v_link text;
BEGIN
  -- carrega config (ou defaults implícitos)
  SELECT * INTO v_cfg FROM public.alertas_captacao_config WHERE imobiliaria_id = NEW.imobiliaria_id;
  IF NOT FOUND THEN
    v_cfg.imobiliaria_id := NEW.imobiliaria_id;
    v_cfg.enabled_app := true;
    v_cfg.enabled_whatsapp := true;
    v_cfg.score_min_alerta := 75;
    v_cfg.niveis_monitorados := ARRAY['morno','quente','fervendo'];
    v_cfg.only_on_upgrade := true;
  END IF;

  IF NOT v_cfg.enabled_app AND NOT v_cfg.enabled_whatsapp THEN
    RETURN NEW;
  END IF;

  v_nivel_rank_new := CASE COALESCE(NEW.motivacao_nivel,'frio')
    WHEN 'frio' THEN 0 WHEN 'morno' THEN 1 WHEN 'quente' THEN 2 WHEN 'fervendo' THEN 3 ELSE 0 END;
  v_nivel_rank_old := CASE COALESCE(OLD.motivacao_nivel,'frio')
    WHEN 'frio' THEN 0 WHEN 'morno' THEN 1 WHEN 'quente' THEN 2 WHEN 'fervendo' THEN 3 ELSE 0 END;

  -- upgrade de nível monitorado
  IF v_nivel_rank_new > v_nivel_rank_old
     AND NEW.motivacao_nivel = ANY(v_cfg.niveis_monitorados) THEN
    v_should_alert := true;
    v_tipo := 'upgrade_nivel';
  -- cruzou threshold de score (subindo)
  ELSIF COALESCE(NEW.motivacao_score,0) >= v_cfg.score_min_alerta
        AND COALESCE(OLD.motivacao_score,0) < v_cfg.score_min_alerta THEN
    v_should_alert := true;
    v_tipo := 'score_threshold';
  ELSIF NOT v_cfg.only_on_upgrade
        AND COALESCE(NEW.motivacao_score,0) >= v_cfg.score_min_alerta
        AND NEW.motivacao_nivel = ANY(v_cfg.niveis_monitorados) THEN
    v_should_alert := true;
    v_tipo := 'score_threshold';
  END IF;

  IF NOT v_should_alert THEN
    RETURN NEW;
  END IF;

  -- corretor atualmente atribuído (via fila de distribuição, se houver)
  SELECT corretor_id INTO v_corretor_id
  FROM public.lead_distribution_queue
  WHERE imobiliaria_id = NEW.imobiliaria_id
    AND source = 'lista_proprietarios_captacao'
    AND source_ref = NEW.id::text
    AND corretor_id IS NOT NULL
  ORDER BY assigned_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  v_link := '/captacao?proprietario=' || NEW.id::text;

  INSERT INTO public.alertas_captacao_log (
    imobiliaria_id, proprietario_id, proprietario_nome, imovel_ref,
    tipo_evento, nivel_anterior, nivel_novo, score_anterior, score_novo,
    corretor_id, detalhes, link
  ) VALUES (
    NEW.imobiliaria_id, NEW.id, NEW.nome_proprietario, NEW.imovel_id_ref,
    v_tipo, OLD.motivacao_nivel, NEW.motivacao_nivel,
    OLD.motivacao_score, NEW.motivacao_score,
    v_corretor_id,
    jsonb_build_object(
      'operacao', NEW.operacao,
      'cidade', NEW.cidade,
      'bairro', NEW.bairro,
      'titulo', NEW.titulo_imovel,
      'preco', NEW.preco,
      'sinais', NEW.motivacao_sinais,
      'telefone', NEW.telefone_e164
    ),
    v_link
  ) RETURNING id INTO v_alert_id;

  -- notificação in-app para o dono (imobiliaria_id = auth uid pattern)
  IF v_cfg.enabled_app THEN
    INSERT INTO public.notifications (user_id, title, description)
    VALUES (
      NEW.imobiliaria_id,
      CASE v_tipo
        WHEN 'upgrade_nivel' THEN '🔥 Proprietário subiu para ' || UPPER(NEW.motivacao_nivel)
        ELSE '🎯 Score ' || NEW.motivacao_score || ' — ' || COALESCE(NEW.nome_proprietario,'Proprietário')
      END,
      COALESCE(NEW.nome_proprietario,'Proprietário') ||
      ' · ' || COALESCE(NEW.cidade,'') ||
      ' · Score ' || COALESCE(NEW.motivacao_score,0)::text ||
      ' · ' || v_link
    );

    -- notifica corretor responsável, se houver e for usuário
    IF v_corretor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, description)
      SELECT c.id,
        '🔥 Seu lead subiu de prioridade: ' || COALESCE(NEW.nome_proprietario,'Proprietário'),
        'Nível: ' || UPPER(COALESCE(NEW.motivacao_nivel,'')) ||
        ' · Score ' || COALESCE(NEW.motivacao_score,0)::text ||
        ' · ' || v_link
      FROM public.corretores c
      WHERE c.id = v_corretor_id;
    END IF;
    UPDATE public.alertas_captacao_log SET delivered_app = true WHERE id = v_alert_id;
  END IF;

  -- dispara edge function assíncrona para WhatsApp
  IF v_cfg.enabled_whatsapp THEN
    PERFORM net.http_post(
      url := 'https://ugxnxztecfsklijmhhmo.supabase.co/functions/v1/enviar-alerta-captacao',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneG54enRlY2Zza2xpam1oaG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTkyNTYsImV4cCI6MjA4ODA3NTI1Nn0.yk0nsCjYOuRnwTWaR5iQaiOrn936eb_l4DuBolzVBIM'
      ),
      body := jsonb_build_object('alert_id', v_alert_id)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- não bloqueia o UPDATE por falha no alerta
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_lpc_alertas_captacao ON public.lista_proprietarios_captacao;
CREATE TRIGGER trg_lpc_alertas_captacao
  AFTER UPDATE OF motivacao_score, motivacao_nivel ON public.lista_proprietarios_captacao
  FOR EACH ROW
  WHEN (
    NEW.motivacao_score IS DISTINCT FROM OLD.motivacao_score
    OR NEW.motivacao_nivel IS DISTINCT FROM OLD.motivacao_nivel
  )
  EXECUTE FUNCTION public.tg_lpc_alertas_captacao();
