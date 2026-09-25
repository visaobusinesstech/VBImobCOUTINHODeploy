ALTER TABLE public.conteudo_seo_autopublish_config
ADD COLUMN IF NOT EXISTS bloquear_publicacao_seo_critico BOOLEAN NOT NULL DEFAULT false;