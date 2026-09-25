
-- 1) Tighten master_autorizacoes policies: master can only manage rows for their own tenant
DROP POLICY IF EXISTS master_auth_insert ON public.master_autorizacoes;
DROP POLICY IF EXISTS master_auth_update ON public.master_autorizacoes;

CREATE POLICY master_auth_insert ON public.master_autorizacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()) AND master_id = auth.uid());

CREATE POLICY master_auth_update ON public.master_autorizacoes
  FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND master_id = auth.uid())
  WITH CHECK (public.is_master(auth.uid()) AND master_id = auth.uid());

-- 2) Harden profiles: add WITH CHECK on UPDATE and extend trigger to protect customer_id
DROP POLICY IF EXISTS profiles_update ON public.profiles;

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING ((id = auth.uid()) OR public.is_master(auth.uid()))
  WITH CHECK ((id = auth.uid()) OR public.is_master(auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    NEW.is_master := OLD.is_master;
    NEW.approved := OLD.approved;
    NEW.plano := OLD.plano;
    NEW.trial_start := OLD.trial_start;
    NEW.customer_id := OLD.customer_id;
  END IF;
  RETURN NEW;
END;
$function$;
