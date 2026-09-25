
-- 1) Autor da atividade (para o painel de ações em tempo real)
ALTER TABLE public.lead_atividades
  ADD COLUMN IF NOT EXISTS ator_user_id uuid,
  ADD COLUMN IF NOT EXISTS ator_nome text;

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
        WHERE lower(c.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = NEW.ator_user_id))
        LIMIT 1),
      (SELECT p.nome_completo FROM public.profiles p WHERE p.id = NEW.ator_user_id),
      (SELECT u.email FROM auth.users u WHERE u.id = NEW.ator_user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_atividade_ator ON public.lead_atividades;
CREATE TRIGGER trg_lead_atividade_ator
BEFORE INSERT ON public.lead_atividades
FOR EACH ROW EXECUTE FUNCTION public.set_lead_atividade_ator();

-- 2) Somente o admin master pode direcionar leads a um corretor
CREATE OR REPLACE FUNCTION public.guard_lead_corretor_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW; -- service_role / jobs internos
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.corretor_id IS DISTINCT FROM OLD.corretor_id THEN
    IF NOT (public.is_master(v_uid) OR v_uid = NEW.imobiliaria_id) THEN
      RAISE EXCEPTION 'Apenas o administrador master pode direcionar leads para corretores';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.corretor_id IS NOT NULL THEN
    IF NOT (public.is_master(v_uid) OR v_uid = NEW.imobiliaria_id) THEN
      RAISE EXCEPTION 'Apenas o administrador master pode direcionar leads para corretores';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_lead_corretor_assignment ON public.leads;
CREATE TRIGGER trg_guard_lead_corretor_assignment
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.guard_lead_corretor_assignment();

-- 3) Tempo real no histórico de atividades
ALTER TABLE public.lead_atividades REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_atividades;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
