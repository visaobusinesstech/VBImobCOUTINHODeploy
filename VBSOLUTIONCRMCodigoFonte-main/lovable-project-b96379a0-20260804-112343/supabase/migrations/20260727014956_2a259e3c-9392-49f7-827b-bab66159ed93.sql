ALTER TABLE public.nutricao_fluxos
  ADD COLUMN IF NOT EXISTS segmento_estagios text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS segmento_perfis text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS segmento_motivos_perda text[] NOT NULL DEFAULT '{}';