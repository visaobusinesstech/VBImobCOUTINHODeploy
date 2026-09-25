
ALTER TABLE public.imobiliaria_config
  ADD COLUMN IF NOT EXISTS sw_cleanup_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sw_cleanup_disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS sw_cleanup_disabled_by uuid,
  ADD COLUMN IF NOT EXISTS sw_cleanup_disabled_reason text;

CREATE OR REPLACE FUNCTION public.set_sw_cleanup_disabled(
  _tenant_id uuid,
  _disabled boolean,
  _reason text DEFAULT NULL
)
RETURNS TABLE(tenant_id uuid, disabled boolean, changed_at timestamptz, changed_by uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_master(v_actor) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.imobiliaria_config (user_id, sw_cleanup_disabled, sw_cleanup_disabled_at, sw_cleanup_disabled_by, sw_cleanup_disabled_reason)
  VALUES (_tenant_id, _disabled, now(), v_actor, NULLIF(TRIM(COALESCE(_reason,'')),''))
  ON CONFLICT (user_id) DO UPDATE
    SET sw_cleanup_disabled = EXCLUDED.sw_cleanup_disabled,
        sw_cleanup_disabled_at = now(),
        sw_cleanup_disabled_by = v_actor,
        sw_cleanup_disabled_reason = NULLIF(TRIM(COALESCE(_reason,'')),''),
        updated_at = now();

  INSERT INTO public.security_audit_log (
    event_type, actor_user_id, tenant_id, actor_tenant_id,
    table_name, record_id, action, outcome, reason, source, metadata
  ) VALUES (
    'sw_cleanup_toggle', v_actor, _tenant_id, v_actor,
    'imobiliaria_config', _tenant_id::text,
    CASE WHEN _disabled THEN 'disable_sw_cleanup' ELSE 'enable_sw_cleanup' END,
    'allowed', NULLIF(TRIM(COALESCE(_reason,'')),''), 'rpc',
    jsonb_build_object('disabled', _disabled, 'reason', _reason)
  );

  RETURN QUERY
  SELECT _tenant_id, _disabled, now(), v_actor;
END;
$$;

REVOKE ALL ON FUNCTION public.set_sw_cleanup_disabled(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_sw_cleanup_disabled(uuid, boolean, text) TO authenticated;
