
CREATE OR REPLACE FUNCTION public.auto_assign_lead_ludmila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corretor_id uuid;
  v_prev_corretor_id uuid := NEW.corretor_id;
  v_regra text := 'auto_assign_ludmila_v4_novos_hoje_tzbr';
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

  IF v_corretor_id IS NOT NULL AND (NEW.corretor_id IS DISTINCT FROM v_corretor_id) THEN
    NEW.corretor_id := v_corretor_id;

    INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
    VALUES (
      NEW.id, NEW.imobiliaria_id, 'atribuicao', 'Atribuição automática',
      'Lead do pipeline "Novos Leads" (hoje BRT) direcionado à Ludmila. Regra: ' || v_regra
        || CASE WHEN v_prev_corretor_id IS NOT NULL
                THEN ' • Corretor anterior: ' || v_prev_corretor_id::text
                ELSE ' • Sem corretor anterior' END
        || ' • Canal: ' || COALESCE(NEW.canal_origem, 'não informado')
    );

    INSERT INTO public.system_logs (level, module, action, message, user_id, metadata)
    VALUES (
      'info', 'LeadsAutoAssign', 'auto_assign',
      'Lead novo (hoje BRT) atribuído automaticamente à Ludmila',
      auth.uid(),
      jsonb_build_object(
        'lead_id', NEW.id, 'lead_nome', NEW.nome, 'estagio', NEW.estagio,
        'corretor_id', v_corretor_id, 'corretor_anterior', v_prev_corretor_id,
        'regra', v_regra, 'canal_origem', NEW.canal_origem,
        'imobiliaria_id', NEW.imobiliaria_id,
        'today_br', v_today_br, 'created_br', v_created_br
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;
