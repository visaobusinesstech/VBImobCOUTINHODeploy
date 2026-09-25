CREATE OR REPLACE FUNCTION public.guard_lead_corretor_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_self uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_master(v_uid) OR v_uid = NEW.imobiliaria_id THEN
    RETURN NEW;
  END IF;

  SELECT lower(email) INTO v_email FROM public.profiles WHERE id = v_uid;

  SELECT id INTO v_self
  FROM public.corretores
  WHERE imobiliaria_id = NEW.imobiliaria_id
    AND lower(email) = v_email
  LIMIT 1;

  IF TG_OP = 'UPDATE' AND NEW.corretor_id IS DISTINCT FROM OLD.corretor_id THEN
    IF NEW.corretor_id IS DISTINCT FROM v_self THEN
      RAISE EXCEPTION 'Apenas o administrador master pode direcionar leads para corretores';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.corretor_id IS NOT NULL THEN
    IF NEW.corretor_id IS DISTINCT FROM v_self THEN
      RAISE EXCEPTION 'Apenas o administrador master pode direcionar leads para corretores';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;