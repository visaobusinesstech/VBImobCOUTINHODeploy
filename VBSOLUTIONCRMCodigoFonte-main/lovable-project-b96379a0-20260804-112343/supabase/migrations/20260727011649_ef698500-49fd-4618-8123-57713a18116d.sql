ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS area_minima numeric,
  ADD COLUMN IF NOT EXISTS quartos_minimo integer,
  ADD COLUMN IF NOT EXISTS suites_minimo integer,
  ADD COLUMN IF NOT EXISTS banheiros_minimo integer,
  ADD COLUMN IF NOT EXISTS vagas_minimo integer,
  ADD COLUMN IF NOT EXISTS valor_maximo numeric,
  ADD COLUMN IF NOT EXISTS bairros_interesse text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS amenidades_desejadas text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS finalidade text,
  ADD COLUMN IF NOT EXISTS urgencia text;

ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS caracteristicas text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS estado_conservacao text;