
ALTER TABLE public.imobiliaria_config
  ADD COLUMN IF NOT EXISTS auto_assign_ludmila_estagios text[] NOT NULL DEFAULT ARRAY['novos'],
  ADD COLUMN IF NOT EXISTS auto_assign_ludmila_janela_horas integer;

-- janela_horas: NULL = usa dia do calendário em America/Sao_Paulo; >0 = janela rolante em horas
ALTER TABLE public.imobiliaria_config
  DROP CONSTRAINT IF EXISTS auto_assign_janela_horas_check;
ALTER TABLE public.imobiliaria_config
  ADD CONSTRAINT auto_assign_janela_horas_check
  CHECK (auto_assign_ludmila_janela_horas IS NULL OR (auto_assign_ludmila_janela_horas BETWEEN 1 AND 168));

-- BEFORE INSERT: atribui corretor conforme config
CREATE OR REPLACE FUNCTION public.auto_assign_lead_ludmila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corretor_id uuid;
  v_estagios text[];
  v_janela int;
  v_ok boolean;
BEGIN
  SELECT auto_assign_ludmila_estagios, auto_assign_ludmila_janela_horas
    INTO v_estagios, v_janela
  FROM public.imobiliaria_config
  WHERE user_id = NEW.imobiliaria_id
  LIMIT 1;

  v_estagios := COALESCE(v_estagios, ARRAY['novos']);

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

  SELECT id INTO v_corretor_id
  FROM public.corretores
  WHERE imobiliaria_id = NEW.imobiliaria_id
    AND LOWER(email) = 'ludmilasantos2499@gmail.com'
    AND status = 'ativo'
  LIMIT 1;

  IF v_corretor_id IS NOT NULL THEN
    NEW.corretor_id := v_corretor_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- AFTER INSERT: registra atividade + log
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
BEGIN
  SELECT auto_assign_ludmila_estagios, auto_assign_ludmila_janela_horas
    INTO v_estagios, v_janela
  FROM public.imobiliaria_config
  WHERE user_id = NEW.imobiliaria_id
  LIMIT 1;

  v_estagios := COALESCE(v_estagios, ARRAY['novos']);

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
    NEW.id, NEW.imobiliaria_id, 'atribuicao', 'Atribuição automática',
    'Lead atribuído à Ludmila. Regra: ' || v_regra
      || ' • Estágio: ' || NEW.estagio
      || ' • Janela: ' || COALESCE(v_janela::text || 'h', 'dia BRT')
      || ' • Canal: ' || COALESCE(NEW.canal_origem, 'não informado')
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
      'canal_origem', NEW.canal_origem, 'imobiliaria_id', NEW.imobiliaria_id
    )
  );

  RETURN NEW;
END;
$function$;
