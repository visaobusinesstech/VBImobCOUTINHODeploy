
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
  -- Só atribui quando o lead ainda não tem corretor
  IF NEW.corretor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

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
