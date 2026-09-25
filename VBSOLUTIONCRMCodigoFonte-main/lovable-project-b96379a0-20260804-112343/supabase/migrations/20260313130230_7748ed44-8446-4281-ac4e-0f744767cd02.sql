-- Ensure propostas rows always carry the correct workspace ID expected by RLS
CREATE OR REPLACE FUNCTION public.set_proposta_imobiliaria_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.imobiliaria_id := public.get_master_user_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_proposta_imobiliaria_id ON public.propostas;

CREATE TRIGGER trg_set_proposta_imobiliaria_id
BEFORE INSERT OR UPDATE OF imobiliaria_id
ON public.propostas
FOR EACH ROW
EXECUTE FUNCTION public.set_proposta_imobiliaria_id();