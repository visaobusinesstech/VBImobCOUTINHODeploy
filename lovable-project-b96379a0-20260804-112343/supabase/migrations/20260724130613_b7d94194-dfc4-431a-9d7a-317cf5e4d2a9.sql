
CREATE TABLE IF NOT EXISTS public.photo_extraction_cache (
  url_hash TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
  strategy_stats JSONB,
  blocked BOOLEAN NOT NULL DEFAULT false,
  block_reason TEXT,
  total_candidates INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS photo_extraction_cache_expires_at_idx
  ON public.photo_extraction_cache (expires_at);

GRANT ALL ON public.photo_extraction_cache TO service_role;

ALTER TABLE public.photo_extraction_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages photo cache"
  ON public.photo_extraction_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
