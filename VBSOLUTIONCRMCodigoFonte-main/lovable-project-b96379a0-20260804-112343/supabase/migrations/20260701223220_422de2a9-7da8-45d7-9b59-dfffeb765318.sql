
-- 1) Garantir corretor vinculado à Ludmila na imobiliária do admin master
INSERT INTO public.corretores (imobiliaria_id, nome, email, status)
SELECT '0f78835c-9aa7-411d-97d3-33d499953a1f'::uuid, 'Ludmila Santos', 'ludmilasantos2499@gmail.com', 'ativo'
WHERE NOT EXISTS (
  SELECT 1 FROM public.corretores
  WHERE imobiliaria_id = '0f78835c-9aa7-411d-97d3-33d499953a1f'
    AND LOWER(email) = 'ludmilasantos2499@gmail.com'
);

-- 2) Trigger: novos leads sem corretor são atribuídos automaticamente à Ludmila
CREATE OR REPLACE FUNCTION public.auto_assign_lead_ludmila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corretor_id uuid;
BEGIN
  IF NEW.corretor_id IS NULL THEN
    SELECT id INTO v_corretor_id
    FROM public.corretores
    WHERE imobiliaria_id = NEW.imobiliaria_id
      AND LOWER(email) = 'ludmilasantos2499@gmail.com'
      AND status = 'ativo'
    LIMIT 1;

    IF v_corretor_id IS NOT NULL THEN
      NEW.corretor_id := v_corretor_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_lead_ludmila ON public.leads;
CREATE TRIGGER trg_auto_assign_lead_ludmila
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_lead_ludmila();
