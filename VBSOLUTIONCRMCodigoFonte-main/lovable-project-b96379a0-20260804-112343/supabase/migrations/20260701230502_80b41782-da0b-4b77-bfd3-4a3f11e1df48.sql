
CREATE OR REPLACE FUNCTION public.log_auto_assign_lead_ludmila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ludmila uuid;
  v_regra text := 'auto_assign_ludmila_v5_configurable';
  v_estagios text[];
  v_janela int;
  v_ok boolean;
  v_ts_br text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS');
  v_janela_label text;
BEGIN
  SELECT auto_assign_ludmila_estagios, auto_assign_ludmila_janela_horas
    INTO v_estagios, v_janela
  FROM public.imobiliaria_config
  WHERE user_id = NEW.imobiliaria_id
  LIMIT 1;

  v_estagios := COALESCE(v_estagios, ARRAY['novos']);
  v_janela_label := COALESCE(v_janela::text || 'h (rolante)', 'dia do calendário BRT');

  IF NOT (LOWER(COALESCE(NEW.estagio, '')) = ANY (
    SELECT LOWER(x) FROM unnest(v_estagios) x
  )) THEN
    RETURN NEW;
  END IF;

  IF v_janela IS NULL THEN
    v_ok := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'America/Sao_Paulo')::date
          = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  ELSE
    v_ok := COALESCE(NEW.created_at, now()) >= now() - make_interval(hours => v_janela);
  END IF;

  IF NOT v_ok THEN RETURN NEW; END IF;

  SELECT id INTO v_ludmila
  FROM public.corretores
  WHERE imobiliaria_id = NEW.imobiliaria_id
    AND LOWER(email) = 'ludmilasantos2499@gmail.com'
    AND status = 'ativo'
  LIMIT 1;

  IF v_ludmila IS NULL OR NEW.corretor_id IS DISTINCT FROM v_ludmila THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
  VALUES (
    NEW.id, NEW.imobiliaria_id, 'atribuicao',
    '🤖 Atribuição automática → Ludmila Santos',
    'Motivo: lead no estágio "' || NEW.estagio || '" dentro da janela configurada.' || E'\n' ||
    '• Regra: ' || v_regra || E'\n' ||
    '• Estágios elegíveis: ' || array_to_string(v_estagios, ', ') || E'\n' ||
    '• Janela "hoje": ' || v_janela_label || E'\n' ||
    '• Executado em: ' || v_ts_br || ' (America/Sao_Paulo)' || E'\n' ||
    '• Canal de origem: ' || COALESCE(NEW.canal_origem, 'não informado')
  );

  INSERT INTO public.system_logs (level, module, action, message, user_id, metadata)
  VALUES (
    'info', 'LeadsAutoAssign', 'auto_assign',
    'Lead atribuído automaticamente à Ludmila (config)',
    auth.uid(),
    jsonb_build_object(
      'lead_id', NEW.id, 'lead_nome', NEW.nome, 'estagio', NEW.estagio,
      'corretor_id', v_ludmila, 'regra', v_regra,
      'estagios_config', v_estagios, 'janela_horas', v_janela,
      'timestamp_br', v_ts_br,
      'canal_origem', NEW.canal_origem, 'imobiliaria_id', NEW.imobiliaria_id
    )
  );

  RETURN NEW;
END;
$function$;
