
ALTER TABLE public.conteudos_seo
  ADD COLUMN IF NOT EXISTS agendado_para timestamptz;

CREATE INDEX IF NOT EXISTS idx_conteudos_seo_agendado
  ON public.conteudos_seo (agendado_para)
  WHERE status = 'rascunho' AND agendado_para IS NOT NULL;

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
  -- 1) Publicações AGENDADAS (prioridade, ignoram regras gerais)
  FOR r IN
    SELECT id FROM public.conteudos_seo
    WHERE status = 'rascunho'
      AND agendado_para IS NOT NULL
      AND agendado_para <= now()
    ORDER BY agendado_para ASC
    LIMIT 500
  LOOP
    UPDATE public.conteudos_seo
       SET status = 'publicado',
           publicado_em = now(),
           auto_publicado = true
     WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  -- 2) Regras gerais de auto-publicação
  FOR r IN
    SELECT c.id
    FROM public.conteudos_seo c
    JOIN public.conteudo_seo_autopublish_config cfg
      ON cfg.imobiliaria_id = c.imobiliaria_id
    WHERE cfg.ativo = true
      AND c.status = 'rascunho'
      AND c.agendado_para IS NULL
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
