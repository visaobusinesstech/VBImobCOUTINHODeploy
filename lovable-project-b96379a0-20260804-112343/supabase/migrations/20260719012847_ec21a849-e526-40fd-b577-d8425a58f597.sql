
-- Simulation execution history (dry-run of retention policies)
CREATE TABLE IF NOT EXISTS public.retention_simulation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_by_email text,
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_removidos integer NOT NULL DEFAULT 0,
  total_protegidos integer NOT NULL DEFAULT 0,
  politicas_count integer NOT NULL DEFAULT 0,
  tenants_impactados integer NOT NULL DEFAULT 0,
  duracao_ms integer,
  resultados jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.retention_simulation_history TO authenticated;
GRANT ALL ON public.retention_simulation_history TO service_role;

ALTER TABLE public.retention_simulation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can view all simulation history"
  ON public.retention_simulation_history
  FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_retention_sim_history_executed_at
  ON public.retention_simulation_history (executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_sim_history_executed_by
  ON public.retention_simulation_history (executed_by);

-- RPC to record a simulation execution. Client passes summary + full result JSON.
-- Master-only. Runs as SECURITY DEFINER to bypass INSERT policy while still gating on is_master.
CREATE OR REPLACE FUNCTION public.record_retention_simulation(
  _parametros jsonb,
  _total_removidos integer,
  _total_protegidos integer,
  _politicas_count integer,
  _tenants_impactados integer,
  _duracao_ms integer,
  _resultados jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_master(v_actor) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

  INSERT INTO public.retention_simulation_history (
    executed_by, executed_by_email, parametros,
    total_removidos, total_protegidos, politicas_count,
    tenants_impactados, duracao_ms, resultados
  ) VALUES (
    v_actor, v_email, COALESCE(_parametros, '{}'::jsonb),
    COALESCE(_total_removidos, 0), COALESCE(_total_protegidos, 0),
    COALESCE(_politicas_count, 0), COALESCE(_tenants_impactados, 0),
    _duracao_ms, COALESCE(_resultados, '[]'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_retention_simulation(jsonb, integer, integer, integer, integer, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_retention_simulation(jsonb, integer, integer, integer, integer, integer, jsonb) TO authenticated;
