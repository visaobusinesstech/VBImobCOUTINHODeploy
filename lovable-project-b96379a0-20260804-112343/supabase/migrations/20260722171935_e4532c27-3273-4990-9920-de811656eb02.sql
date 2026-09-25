
ALTER TABLE public.mensagens_whatsapp
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.tg_wa_msg_check_consent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_norm TEXT; v_status TEXT; v_cons_id UUID; v_is_optin_msg BOOLEAN;
BEGIN
  IF COALESCE(NEW.direcao, 'saida') <> 'saida' THEN RETURN NEW; END IF;

  v_is_optin_msg := COALESCE((NEW.metadata->>'is_double_optin')::boolean, false);
  IF v_is_optin_msg THEN RETURN NEW; END IF;

  v_norm := public.normalize_phone(NEW.telefone_destino);
  IF v_norm IS NULL THEN RETURN NEW; END IF;

  SELECT id, status INTO v_cons_id, v_status
    FROM public.whatsapp_consentimentos
   WHERE imobiliaria_id = NEW.imobiliaria_id AND telefone_norm = v_norm LIMIT 1;

  IF v_status IS NULL OR v_status <> 'ativo' THEN
    IF v_cons_id IS NOT NULL THEN
      INSERT INTO public.whatsapp_consentimento_eventos
        (consentimento_id, imobiliaria_id, tipo_evento, descricao, ator_tipo, metadata)
      VALUES (v_cons_id, NEW.imobiliaria_id, 'mensagem_bloqueada',
              'Envio bloqueado: consentimento ' || COALESCE(v_status,'inexistente'),
              'sistema',
              jsonb_build_object('telefone', v_norm, 'preview', LEFT(COALESCE(NEW.mensagem,''), 120)));
    END IF;
    RAISE EXCEPTION 'WHATSAPP_CONSENTIMENTO_AUSENTE: envio bloqueado para % (status=%)',
      v_norm, COALESCE(v_status,'sem_registro') USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.whatsapp_consentimento_eventos
    (consentimento_id, imobiliaria_id, tipo_evento, descricao, ator_tipo, metadata)
  VALUES (v_cons_id, NEW.imobiliaria_id, 'mensagem_enviada', 'Envio autorizado', 'sistema',
          jsonb_build_object('telefone', v_norm, 'preview', LEFT(COALESCE(NEW.mensagem,''), 120)));
  RETURN NEW;
END; $$;
