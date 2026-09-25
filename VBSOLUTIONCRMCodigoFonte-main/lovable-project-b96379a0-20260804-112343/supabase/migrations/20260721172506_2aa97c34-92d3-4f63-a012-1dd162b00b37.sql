ALTER TABLE public.conteudos_seo ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS conteudos_seo_tags_gin ON public.conteudos_seo USING GIN (tags);