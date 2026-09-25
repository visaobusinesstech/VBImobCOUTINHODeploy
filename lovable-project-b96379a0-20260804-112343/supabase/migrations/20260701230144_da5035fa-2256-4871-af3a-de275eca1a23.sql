
-- 1) Função BEFORE INSERT: apenas atribui o corretor_id
CREATE OR REPLACE FUNCTION public.auto_assign_lead_ludmila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corretor_id uuid;
  v_today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_created_br date := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF LOWER(COALESCE(NEW.estagio, '')) <> 'novos' OR v_created_br <> v_today_br THEN
    RETURN NEW;
  END IF;

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

-- 2) Nova função AFTER INSERT: registra atividade + log quando a Ludmila foi atribuída
CREATE OR REPLACE FUNCTION public.log_auto_assign_lead_ludmila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ludmila uuid;
  v_regra text := 'auto_assign_ludmila_v4_novos_hoje_tzbr';
  v_today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_created_br date := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF LOWER(COALESCE(NEW.estagio, '')) <> 'novos' OR v_created_br <> v_today_br THEN
    RETURN NEW;
  END IF;

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
    'Lead do pipeline "Novos Leads" (hoje BRT) direcionado à Ludmila. Regra: ' || v_regra
      || ' • Canal: ' || COALESCE(NEW.canal_origem, 'não informado')
  );

  INSERT INTO public.system_logs (level, module, action, message, user_id, metadata)
  VALUES (
    'info', 'LeadsAutoAssign', 'auto_assign',
    'Lead novo (hoje BRT) atribuído automaticamente à Ludmila',
    auth.uid(),
    jsonb_build_object(
      'lead_id', NEW.id, 'lead_nome', NEW.nome, 'estagio', NEW.estagio,
      'corretor_id', v_ludmila, 'regra', v_regra,
      'canal_origem', NEW.canal_origem, 'imobiliaria_id', NEW.imobiliaria_id,
      'today_br', v_today_br, 'created_br', v_created_br
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_auto_assign_lead_ludmila ON public.leads;
CREATE TRIGGER trg_log_auto_assign_lead_ludmila
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_auto_assign_lead_ludmila();
