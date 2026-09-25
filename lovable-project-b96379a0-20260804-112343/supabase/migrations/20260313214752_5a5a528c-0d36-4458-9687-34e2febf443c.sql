
CREATE OR REPLACE FUNCTION public.on_transacao_created_notification()
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

  IF master_id IS NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.tipo
    WHEN 'entrada' THEN tipo_label := '💰 Nova Receita';
    WHEN 'saida' THEN tipo_label := '📤 Nova Despesa';
    ELSE tipo_label := '💲 Nova Transação';
  END CASE;

  INSERT INTO public.notifications (user_id, title, description)
  VALUES (
    master_id,
    tipo_label,
    '"' || NEW.descricao || '" - R$ ' || TRIM(TO_CHAR(NEW.valor, 'FM999G999G999D00')) || ' (' || NEW.categoria || ')'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transacao_created_notification
  AFTER INSERT ON public.transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.on_transacao_created_notification();
