
CREATE OR REPLACE FUNCTION public.whatsapp_contatos_captacao_exige_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st text;
BEGIN
  SELECT status_revisao INTO st
  FROM public.lista_proprietarios_captacao
  WHERE id = NEW.lista_proprietario_id;

  IF st IS DISTINCT FROM 'aprovado' THEN
    RAISE EXCEPTION 'Contato bloqueado: candidato % ainda não teve a fonte LGPD aprovada (status=%).',
      NEW.lista_proprietario_id, COALESCE(st, 'sem registro')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_captacao_lgpd ON public.whatsapp_contatos_captacao;
CREATE TRIGGER trg_whatsapp_captacao_lgpd
BEFORE INSERT ON public.whatsapp_contatos_captacao
FOR EACH ROW EXECUTE FUNCTION public.whatsapp_contatos_captacao_exige_aprovacao();
