ALTER TABLE public.nutricao_etapas
  ADD COLUMN IF NOT EXISTS ab_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_titulo_b text,
  ADD COLUMN IF NOT EXISTS ab_mensagem_b text,
  ADD COLUMN IF NOT EXISTS ab_split integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS ab_auto_escolher boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ab_min_envios integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS ab_vencedor text,
  ADD COLUMN IF NOT EXISTS ab_decidido_em timestamptz;

ALTER TABLE public.nutricao_envios
  ADD COLUMN IF NOT EXISTS variante text;

ALTER TABLE public.nutricao_eventos
  ADD COLUMN IF NOT EXISTS variante text;

CREATE INDEX IF NOT EXISTS idx_nutricao_envios_variante ON public.nutricao_envios (etapa_id, variante);
CREATE INDEX IF NOT EXISTS idx_nutricao_eventos_variante ON public.nutricao_eventos (etapa_id, variante);