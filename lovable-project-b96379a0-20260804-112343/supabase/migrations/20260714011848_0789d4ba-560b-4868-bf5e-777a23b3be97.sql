
ALTER TABLE public.webhook_alerts
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS resolution_source text
    CHECK (resolution_source IN ('manual','auto'));

-- Permitir que membros do tenant reconheçam/resolvam seus alertas.
DROP POLICY IF EXISTS "Tenants can ack/resolve own webhook alerts" ON public.webhook_alerts;
CREATE POLICY "Tenants can ack/resolve own webhook alerts"
  ON public.webhook_alerts
  FOR UPDATE
  TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id))
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));

-- Ack: idempotente. Se já reconhecido, retorna o registro atual.
CREATE OR REPLACE FUNCTION public.ack_webhook_alert(_alert_id uuid)
RETURNS public.webhook_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.webhook_alerts;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.webhook_alerts WHERE id = _alert_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'alerta_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_imobiliaria(v_row.imobiliaria_id) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  IF v_row.acknowledged_at IS NULL THEN
    UPDATE public.webhook_alerts
       SET acknowledged_at = now(),
           acknowledged_by = auth.uid(),
           updated_at = now()
     WHERE id = _alert_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ack_webhook_alert(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ack_webhook_alert(uuid) TO authenticated;

-- Resolve manual: registra quem, quando e nota. Se já resolvido, no-op.
CREATE OR REPLACE FUNCTION public.resolve_webhook_alert(_alert_id uuid, _note text DEFAULT NULL)
RETURNS public.webhook_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.webhook_alerts;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.webhook_alerts WHERE id = _alert_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'alerta_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_imobiliaria(v_row.imobiliaria_id) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  IF v_row.resolved_at IS NULL THEN
    UPDATE public.webhook_alerts
       SET resolved_at = now(),
           resolved_by = auth.uid(),
           resolution_note = NULLIF(TRIM(COALESCE(_note, '')), ''),
           resolution_source = 'manual',
           acknowledged_at = COALESCE(v_row.acknowledged_at, now()),
           acknowledged_by = COALESCE(v_row.acknowledged_by, auth.uid()),
           updated_at = now()
     WHERE id = _alert_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_webhook_alert(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_webhook_alert(uuid, text) TO authenticated;
