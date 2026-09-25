CREATE OR REPLACE FUNCTION public.set_lead_atividade_ator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ator_user_id IS NULL THEN
    NEW.ator_user_id := auth.uid();
  END IF;

  IF NEW.ator_nome IS NULL AND NEW.ator_user_id IS NOT NULL THEN
    NEW.ator_nome := COALESCE(
      (SELECT c.nome FROM public.corretores c
        WHERE lower(c.email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = NEW.ator_user_id))
        LIMIT 1),
      (SELECT p.nome FROM public.profiles p WHERE p.id = NEW.ator_user_id),
      (SELECT p.email FROM public.profiles p WHERE p.id = NEW.ator_user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;