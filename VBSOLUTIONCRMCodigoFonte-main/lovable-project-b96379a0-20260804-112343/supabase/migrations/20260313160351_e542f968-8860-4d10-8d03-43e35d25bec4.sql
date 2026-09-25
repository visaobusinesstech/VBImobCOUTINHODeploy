
CREATE OR REPLACE FUNCTION public.on_proposta_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  master_id uuid;
  status_label text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT id INTO master_id FROM public.profiles WHERE is_master = true LIMIT 1;
    
    CASE NEW.status
      WHEN 'aceita' THEN status_label := 'Aceita ✅';
      WHEN 'recusada' THEN status_label := 'Recusada ❌';
      WHEN 'cancelada' THEN status_label := 'Cancelada';
      WHEN 'em_negociacao' THEN status_label := 'Em Negociação';
      ELSE status_label := NEW.status;
    END CASE;

    INSERT INTO public.notifications (user_id, title, description)
    VALUES (
      master_id,
      'Proposta atualizada',
      'A proposta de "' || NEW.cliente_nome || '" mudou para: ' || status_label
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proposta_status_changed
  AFTER UPDATE ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.on_proposta_status_changed();
