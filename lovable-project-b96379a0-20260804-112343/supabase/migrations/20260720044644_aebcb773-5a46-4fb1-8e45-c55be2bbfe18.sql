
CREATE TABLE public.lighthouse_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('mobile','desktop')),
  performance_score INTEGER,
  seo_score INTEGER,
  accessibility_score INTEGER,
  best_practices_score INTEGER,
  pwa_score INTEGER,
  lcp_ms INTEGER,
  fcp_ms INTEGER,
  cls NUMERIC(6,3),
  tbt_ms INTEGER,
  tti_ms INTEGER,
  speed_index_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error')),
  error_message TEXT,
  raw JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lighthouse_audits_path_created ON public.lighthouse_audits (path, created_at DESC);
CREATE INDEX idx_lighthouse_audits_created ON public.lighthouse_audits (created_at DESC);

GRANT SELECT ON public.lighthouse_audits TO authenticated;
GRANT ALL ON public.lighthouse_audits TO service_role;

ALTER TABLE public.lighthouse_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read lighthouse audits"
  ON public.lighthouse_audits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manage lighthouse audits"
  ON public.lighthouse_audits FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
