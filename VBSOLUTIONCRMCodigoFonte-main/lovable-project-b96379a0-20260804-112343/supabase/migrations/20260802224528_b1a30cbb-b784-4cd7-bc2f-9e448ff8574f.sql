DROP TRIGGER IF EXISTS trg_guard_lead_corretor_assignment ON public.leads;

CREATE OR REPLACE FUNCTION public.guard_lead_corretor_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_self uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW; -- service_role / jobs internos
  END IF;

  IF public.is_master(v_uid) OR v_uid = NEW.imobiliaria_id THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_self
  FROM public.corretores
  WHERE user_id = v_uid
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

-- Roda ANTES da atribuição automática (ordem alfabética dos triggers),
-- para validar apenas o valor enviado pelo usuário.
CREATE TRIGGER trg_a_guard_lead_corretor_assignment
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.guard_lead_corretor_assignment();