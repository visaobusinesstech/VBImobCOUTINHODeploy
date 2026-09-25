
CREATE OR REPLACE FUNCTION public.rz_reprocessar_scores(_imob uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_master boolean;
  v_total int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users u
     WHERE u.id = v_caller AND u.email = 'acoutinhoimoveis@gmail.com'
  ) INTO v_master;

  IF NOT v_master AND v_caller <> _imob THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.radarzap_leads
     SET contato = contato
   WHERE imobiliaria_id = _imob;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  RETURN jsonb_build_object('reprocessados', v_total, 'imobiliaria_id', _imob, 'em', now());
END;
$$;

REVOKE ALL ON FUNCTION public.rz_reprocessar_scores(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rz_reprocessar_scores(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rz_reprocessar_scores(uuid) TO service_role;
