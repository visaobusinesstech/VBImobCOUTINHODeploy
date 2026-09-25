
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count int;
  is_first boolean := false;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;

  IF user_count = 0 THEN
    is_first := true;
    INSERT INTO public.profiles (id, nome, email, approved, is_master, trial_start, plano)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email, true, true, now(), 'gratuito');
  ELSE
    INSERT INTO public.profiles (id, nome, email, approved, is_master, trial_start, plano)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email, true, false, now(), 'gratuito');
  END IF;

  INSERT INTO public.modulo_config (imobiliaria_id, modulo, ativo)
  VALUES (NEW.id, 'whatsapp', false)
  ON CONFLICT (imobiliaria_id, modulo) DO NOTHING;

  -- Notificar todos os masters sobre novo cadastro no plano gratuito
  IF NOT is_first THEN
    INSERT INTO public.notifications (user_id, title, description)
    SELECT
      p.id,
      '🆕 Novo cadastro no plano gratuito',
      'Nome: ' || COALESCE(NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'nome','')), ''), '—') ||
      ' • E-mail: ' || NEW.email ||
      ' • Em: ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
    FROM public.profiles p
    WHERE p.is_master = true;
  END IF;

  RETURN NEW;
END;
$function$;
