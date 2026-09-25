
CREATE OR REPLACE FUNCTION public.on_lead_created_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  master_id uuid;
  canal_label text;
BEGIN
  SELECT id INTO master_id FROM public.profiles WHERE is_master = true LIMIT 1;

  IF master_id IS NULL THEN
    RETURN NEW;
  END IF;

  canal_label := COALESCE(NEW.canal_origem, 'Não informado');

  INSERT INTO public.notifications (user_id, title, description)
  VALUES (
    master_id,
    '🟢 Novo Lead captado',
    'Lead "' || NEW.nome || '" adicionado ao pipeline. Canal: ' || canal_label
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_created_notification
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.on_lead_created_notification();
