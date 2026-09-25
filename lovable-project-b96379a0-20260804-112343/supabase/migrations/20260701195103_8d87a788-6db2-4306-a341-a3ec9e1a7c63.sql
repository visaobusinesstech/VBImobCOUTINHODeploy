
CREATE OR REPLACE FUNCTION public.get_followup_counts(
  _include_inactive boolean DEFAULT false,
  _sem_contato_days integer DEFAULT 7
)
RETURNS TABLE(hoje bigint, atrasados bigint, semana bigint, sem_contato bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imob uuid := public.get_user_imobiliaria_id();
  v_today date := CURRENT_DATE;
  -- Week: Sunday (DOW=0) to Saturday, matching date-fns ptBR default
  v_week_start date := (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::integer)::date;
  v_week_end date := ((CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::integer) + 6)::date;
  v_lead_inativo text[] := ARRAY['fechado','perdido','descartado','inativo'];
  v_contrato_inativo text[] := ARRAY['inativo','cancelado','encerrado','finalizado','distratado'];
BEGIN
  IF v_imob IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT f.data_followup
    FROM public.followups f
    LEFT JOIN public.leads l     ON l.id = f.lead_id
    LEFT JOIN public.contratos c ON c.id = f.contrato_id
    WHERE f.imobiliaria_id = v_imob
      AND f.status = 'pendente'
      AND (
        _include_inactive
        OR (
          CASE
            WHEN f.contrato_id IS NOT NULL THEN
              c.status IS NULL OR NOT (LOWER(c.status) = ANY(v_contrato_inativo))
            WHEN f.lead_id IS NOT NULL THEN
              l.estagio IS NULL OR NOT (LOWER(l.estagio) = ANY(v_lead_inativo))
            ELSE false
          END
        )
      )
  ),
  contagens AS (
    SELECT
      COUNT(*) FILTER (WHERE data_followup = v_today)                                AS hoje,
      COUNT(*) FILTER (WHERE data_followup < v_today)                                AS atrasados,
      COUNT(*) FILTER (WHERE data_followup BETWEEN v_week_start AND v_week_end)      AS semana
    FROM base
  ),
  leads_scope AS (
    SELECT l.id, l.created_at,
      (SELECT MAX(f2.data_followup) FROM public.followups f2 WHERE f2.lead_id = l.id) AS ultimo_fu
    FROM public.leads l
    WHERE l.imobiliaria_id = v_imob
      AND (_include_inactive OR LOWER(COALESCE(l.estagio,'')) NOT IN ('perdido','fechado'))
  ),
  sc AS (
    SELECT COUNT(*)::bigint AS sem_contato
    FROM leads_scope
    WHERE (v_today - COALESCE(ultimo_fu, created_at::date)) > _sem_contato_days
  )
  SELECT contagens.hoje, contagens.atrasados, contagens.semana, sc.sem_contato
  FROM contagens, sc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_followup_counts(boolean, integer) TO authenticated;
