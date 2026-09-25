ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.leads SET created_by = imobiliaria_id WHERE created_by IS NULL;

CREATE OR REPLACE FUNCTION public.set_lead_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_lead_created_by ON public.leads;
CREATE TRIGGER trg_set_lead_created_by
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_lead_created_by();

CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);