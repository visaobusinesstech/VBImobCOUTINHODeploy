-- 1) Revoga execução anônima de funções SECURITY DEFINER no schema public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, pg_get_function_result(p.oid) AS res
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.res <> 'trigger' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
  END LOOP;
END $$;

-- 2) Alertas SEO: resolução restrita ao Master
DROP POLICY IF EXISTS "seo alertas resolve auth" ON public.seo_monitor_alertas;
CREATE POLICY "seo alertas resolve master"
ON public.seo_monitor_alertas
FOR UPDATE TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

-- 3) Limites de plano aplicados no servidor
CREATE OR REPLACE FUNCTION public.plano_limite(_plano text, _recurso text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plano
    WHEN 'gratuito'    THEN CASE _recurso WHEN 'imoveis' THEN 10   WHEN 'leads' THEN 50    WHEN 'corretores' THEN 1  END
    WHEN 'lite'        THEN CASE _recurso WHEN 'imoveis' THEN 50   WHEN 'leads' THEN 200   WHEN 'corretores' THEN 1  END
    WHEN 'basico'      THEN CASE _recurso WHEN 'imoveis' THEN 200  WHEN 'leads' THEN 1000  WHEN 'corretores' THEN 3  END
    WHEN 'profissional'THEN CASE _recurso WHEN 'imoveis' THEN 1000 WHEN 'leads' THEN 5000  WHEN 'corretores' THEN 7  END
    WHEN 'premium'     THEN CASE _recurso WHEN 'imoveis' THEN 5000 WHEN 'leads' THEN 10000 WHEN 'corretores' THEN 15 END
    ELSE NULL -- imobiliaria / master / desconhecido = ilimitado
  END;
$$;

REVOKE ALL ON FUNCTION public.plano_limite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plano_limite(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_plano_limite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recurso text := TG_ARGV[0];
  v_plano text;
  v_master boolean;
  v_limite integer;
  v_total integer;
BEGIN
  IF NEW.imobiliaria_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plano, COALESCE(is_master, false) INTO v_plano, v_master
  FROM public.profiles WHERE id = NEW.imobiliaria_id;

  IF v_master OR v_plano IS NULL THEN
    RETURN NEW;
  END IF;

  v_limite := public.plano_limite(v_plano, v_recurso);
  IF v_limite IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT count(*) FROM public.%I WHERE imobiliaria_id = $1', TG_TABLE_NAME)
    INTO v_total USING NEW.imobiliaria_id;

  IF v_total >= v_limite THEN
    RAISE EXCEPTION 'Limite do plano atingido: % de % % permitidos no plano %. Faça upgrade para continuar.',
      v_total, v_limite, v_recurso, v_plano
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.enforce_plano_limite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_plano_limite() TO service_role;

DROP TRIGGER IF EXISTS trg_limite_plano_imoveis ON public.imoveis;
CREATE TRIGGER trg_limite_plano_imoveis
BEFORE INSERT ON public.imoveis
FOR EACH ROW EXECUTE FUNCTION public.enforce_plano_limite('imoveis');

DROP TRIGGER IF EXISTS trg_limite_plano_leads ON public.leads;
CREATE TRIGGER trg_limite_plano_leads
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.enforce_plano_limite('leads');

DROP TRIGGER IF EXISTS trg_limite_plano_corretores ON public.corretores;
CREATE TRIGGER trg_limite_plano_corretores
BEFORE INSERT ON public.corretores
FOR EACH ROW EXECUTE FUNCTION public.enforce_plano_limite('corretores');