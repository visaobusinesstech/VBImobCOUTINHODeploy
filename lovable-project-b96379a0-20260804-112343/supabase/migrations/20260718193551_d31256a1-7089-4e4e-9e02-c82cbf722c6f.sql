
CREATE TABLE public.firecrawl_captacao_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  cidade TEXT,
  bairro TEXT,
  tipo_imovel TEXT,
  operacao TEXT,
  payload JSONB NOT NULL,
  hits INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

CREATE INDEX idx_firecrawl_cache_expires ON public.firecrawl_captacao_cache(expires_at);

GRANT ALL ON public.firecrawl_captacao_cache TO service_role;

ALTER TABLE public.firecrawl_captacao_cache ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon => only service_role (edge functions) can read/write.
