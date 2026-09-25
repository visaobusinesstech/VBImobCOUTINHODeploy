
CREATE TABLE IF NOT EXISTS public.post_deploy_audit_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by UUID,
  trigger_source TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual','publish','deploy','cron','ci')),
  release_tag TEXT,
  paths TEXT[] NOT NULL,
  strategies TEXT[] NOT NULL DEFAULT ARRAY['mobile']::text[],
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  total_routes INT NOT NULL DEFAULT 0,
  ok_routes INT NOT NULL DEFAULT 0,
  regressions_count INT NOT NULL DEFAULT 0,
  avg_performance INT,
  avg_seo INT,
  avg_lcp_ms INT,
  avg_cls NUMERIC(4,3),
  avg_tbt_ms INT,
  audit_ids UUID[] NOT NULL DEFAULT '{}',
  summary JSONB,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON public.post_deploy_audit_runs TO authenticated;
GRANT ALL ON public.post_deploy_audit_runs TO service_role;

ALTER TABLE public.post_deploy_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read post deploy audit runs"
  ON public.post_deploy_audit_runs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated insert post deploy audit runs"
  ON public.post_deploy_audit_runs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update post deploy audit runs"
  ON public.post_deploy_audit_runs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages post deploy audit runs"
  ON public.post_deploy_audit_runs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_post_deploy_audit_runs_created
  ON public.post_deploy_audit_runs (created_at DESC);


CREATE TABLE IF NOT EXISTS public.post_deploy_audit_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.post_deploy_audit_runs(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('mobile','desktop')),
  metric TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','critical')),
  previous_value NUMERIC,
  current_value NUMERIC,
  delta NUMERIC,
  threshold NUMERIC,
  probable_cause TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('image','javascript','css','fonts','cache','cdn','html','seo','other')),
  auto_fixable BOOLEAN NOT NULL DEFAULT false,
  applied BOOLEAN NOT NULL DEFAULT false,
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.post_deploy_audit_actions TO authenticated;
GRANT ALL ON public.post_deploy_audit_actions TO service_role;

ALTER TABLE public.post_deploy_audit_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read post deploy actions"
  ON public.post_deploy_audit_actions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated update post deploy actions"
  ON public.post_deploy_audit_actions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages post deploy actions"
  ON public.post_deploy_audit_actions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_post_deploy_actions_run
  ON public.post_deploy_audit_actions (run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_deploy_actions_open
  ON public.post_deploy_audit_actions (applied, severity);
