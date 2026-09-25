
CREATE OR REPLACE FUNCTION public.on_contrato_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  master_id uuid;
  tipo_label text;
BEGIN
  SELECT id INTO master_id FROM public.profiles WHERE is_master = true LIMIT 1;

  CASE NEW.tipo
    WHEN 'Venda' THEN tipo_label := '🏠 Venda';
    WHEN 'Locação' THEN tipo_label := '🔑 Locação';
    ELSE tipo_label := NEW.tipo;
  END CASE;

  INSERT INTO public.notifications (user_id, title, description)
  VALUES (
    master_id,
    'Novo contrato criado',
    'Contrato "' || NEW.titulo || '" (' || tipo_label || ') - Cliente: ' || NEW.cliente
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contrato_created
  AFTER INSERT ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.on_contrato_created();
