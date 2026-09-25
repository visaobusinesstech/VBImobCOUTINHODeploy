
-- 1) Colunas de status em conteudos_seo
ALTER TABLE public.conteudos_seo
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS publicado_em timestamptz,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS auto_publicado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conteudos_seo_status_created
  ON public.conteudos_seo (imobiliaria_id, status, created_at);

-- 2) Tabela de configuração de auto-publicação
CREATE TABLE IF NOT EXISTS public.conteudo_seo_autopublish_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT false,
  tipos_permitidos text[] NOT NULL DEFAULT ARRAY['blog','descricao','metatags']::text[],
  min_palavras integer NOT NULL DEFAULT 300,
  exigir_meta_description boolean NOT NULL DEFAULT true,
  exigir_titulo_min integer NOT NULL DEFAULT 30,
  atraso_horas integer NOT NULL DEFAULT 24,
  max_por_dia integer NOT NULL DEFAULT 5,
  janela_inicio smallint NOT NULL DEFAULT 8,
  janela_fim smallint NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conteudo_seo_autopublish_config TO authenticated;
GRANT ALL ON public.conteudo_seo_autopublish_config TO service_role;

ALTER TABLE public.conteudo_seo_autopublish_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own imobiliaria read autopublish"
  ON public.conteudo_seo_autopublish_config FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE POLICY "own imobiliaria insert autopublish"
  ON public.conteudo_seo_autopublish_config FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "own imobiliaria update autopublish"
  ON public.conteudo_seo_autopublish_config FOR UPDATE TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "own imobiliaria delete autopublish"
  ON public.conteudo_seo_autopublish_config FOR DELETE TO authenticated
  USING (imobiliaria_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_autopublish_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_autopublish_updated_at ON public.conteudo_seo_autopublish_config;
CREATE TRIGGER trg_autopublish_updated_at
  BEFORE UPDATE ON public.conteudo_seo_autopublish_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_autopublish_updated_at();

-- 3) Função que aplica as regras e promove rascunhos elegíveis
CREATE OR REPLACE FUNCTION public.aplicar_autopublicacao_seo()
RETURNS TABLE(publicados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT c.id
    FROM public.conteudos_seo c
    JOIN public.conteudo_seo_autopublish_config cfg
      ON cfg.imobiliaria_id = c.imobiliaria_id
    WHERE cfg.ativo = true
      AND c.status = 'rascunho'
      AND c.tipo = ANY (cfg.tipos_permitidos)
      AND c.created_at <= now() - make_interval(hours => cfg.atraso_horas)
      AND length(coalesce(c.titulo,'')) >= cfg.exigir_titulo_min
      AND (cfg.exigir_meta_description = false OR coalesce(length(c.meta_description),0) >= 50)
      AND array_length(regexp_split_to_array(coalesce(c.conteudo::text,''), '\s+'), 1) >= cfg.min_palavras
      AND extract(hour from now() at time zone 'America/Sao_Paulo') BETWEEN cfg.janela_inicio AND cfg.janela_fim
      AND (
        SELECT count(*) FROM public.conteudos_seo x
        WHERE x.imobiliaria_id = c.imobiliaria_id
          AND x.auto_publicado = true
          AND x.publicado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo')
      ) < cfg.max_por_dia
    ORDER BY c.created_at ASC
    LIMIT 200
  LOOP
    UPDATE public.conteudos_seo
       SET status = 'publicado',
           publicado_em = now(),
           auto_publicado = true
     WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_autopublicacao_seo() FROM public;
GRANT EXECUTE ON FUNCTION public.aplicar_autopublicacao_seo() TO authenticated, service_role;
