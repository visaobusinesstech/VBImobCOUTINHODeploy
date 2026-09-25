
CREATE OR REPLACE FUNCTION public.on_lead_closed_complete_followups()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.estagio IS DISTINCT FROM NEW.estagio
     AND NEW.estagio IN ('fechado', 'perdido') THEN
    UPDATE public.followups
    SET status = 'concluido',
        updated_at = now()
    WHERE lead_id = NEW.id
      AND status = 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_closed_complete_followups
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.on_lead_closed_complete_followups();
