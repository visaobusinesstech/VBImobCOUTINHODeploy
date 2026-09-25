
CREATE TABLE IF NOT EXISTS public.seo_monitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_urls INT NOT NULL DEFAULT 0,
  ok_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  new_urls_count INT NOT NULL DEFAULT 0,
  removed_urls_count INT NOT NULL DEFAULT 0,
  avg_ms INT NOT NULL DEFAULT 0,
  p95_ms INT NOT NULL DEFAULT 0,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_seo_snap_created ON public.seo_monitor_snapshots(created_at DESC);

GRANT SELECT ON public.seo_monitor_snapshots TO authenticated;
GRANT ALL ON public.seo_monitor_snapshots TO service_role;
ALTER TABLE public.seo_monitor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo snap read auth" ON public.seo_monitor_snapshots FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.seo_monitor_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo TEXT NOT NULL,          -- http_error | slow | new_route | removed_route | missing_seo | timeout
  severity TEXT NOT NULL DEFAULT 'warn', -- info | warn | error
  url TEXT NOT NULL,
  status_code INT,
  response_ms INT,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  snapshot_id UUID REFERENCES public.seo_monitor_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_alertas_created ON public.seo_monitor_alertas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_alertas_open ON public.seo_monitor_alertas(resolved_at) WHERE resolved_at IS NULL;

GRANT SELECT, UPDATE ON public.seo_monitor_alertas TO authenticated;
GRANT ALL ON public.seo_monitor_alertas TO service_role;
ALTER TABLE public.seo_monitor_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo alertas read auth" ON public.seo_monitor_alertas FOR SELECT TO authenticated USING (true);
CREATE POLICY "seo alertas resolve auth" ON public.seo_monitor_alertas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
