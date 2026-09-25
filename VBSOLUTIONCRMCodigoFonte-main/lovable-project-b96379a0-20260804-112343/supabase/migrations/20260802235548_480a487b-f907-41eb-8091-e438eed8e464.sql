-- 1) Função de migração: converte avaliações "link" em carteira/manual preservando histórico
CREATE OR REPLACE FUNCTION public.migrar_avaliacoes_link()
RETURNS TABLE(total integer, para_carteira integer, para_manual integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_imovel_id uuid;
  v_link text;
  v_total integer := 0;
  v_carteira integer := 0;
  v_manual integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.avaliacoes_historico
    WHERE lower(coalesce(modo, '')) IN ('link', 'url', 'anuncio', 'anúncio')
  LOOP
    v_total := v_total + 1;

    v_link := nullif(trim(coalesce(
      r.dados_completos->>'link_imovel',
      r.dados_completos->>'url_anuncio',
      r.dados_completos->>'link',
      r.dados_completos->'imovel'->>'link_imovel',
      ''
    )), '');

    v_imovel_id := r.imovel_id;

    -- Match 1: pelo link do anúncio na carteira
    IF v_imovel_id IS NULL AND v_link IS NOT NULL THEN
      SELECT i.id INTO v_imovel_id
      FROM public.imoveis i
      WHERE i.imobiliaria_id = r.imobiliaria_id
        AND i.url_anuncio IS NOT NULL
        AND regexp_replace(lower(i.url_anuncio), '^https?://(www\.)?', '') =
            regexp_replace(lower(v_link), '^https?://(www\.)?', '')
      LIMIT 1;
    END IF;

    -- Match 2: por título + área aproximada (+ bairro quando houver)
    IF v_imovel_id IS NULL THEN
      SELECT i.id INTO v_imovel_id
      FROM public.imoveis i
      WHERE i.imobiliaria_id = r.imobiliaria_id
        AND lower(trim(i.titulo)) = lower(trim(r.titulo))
        AND (r.area = 0 OR i.area = 0 OR abs(i.area - r.area) <= greatest(r.area * 0.05, 1))
        AND (r.bairro IS NULL OR i.bairro IS NULL OR lower(i.bairro) = lower(r.bairro))
      LIMIT 1;
    END IF;

    UPDATE public.avaliacoes_historico
    SET modo = CASE WHEN v_imovel_id IS NOT NULL THEN 'carteira' ELSE 'manual' END,
        imovel_id = COALESCE(v_imovel_id, imovel_id),
        dados_completos = coalesce(dados_completos, '{}'::jsonb) || jsonb_build_object(
          'modo_original', r.modo,
          'link_origem', v_link,
          'migrado_em', now(),
          'migracao', 'avaliacao-link-para-carteira-manual'
        )
    WHERE id = r.id;

    IF v_imovel_id IS NOT NULL THEN
      v_carteira := v_carteira + 1;
    ELSE
      v_manual := v_manual + 1;
    END IF;

    INSERT INTO public.system_logs (module, action, level, message, metadata)
    VALUES (
      'avaliacao',
      'migracao-avaliacao-link',
      'info',
      format('Avaliação "%s" migrada de link para %s',
             r.titulo,
             CASE WHEN v_imovel_id IS NOT NULL THEN 'carteira' ELSE 'manual' END),
      jsonb_build_object(
        'avaliacao_id', r.id,
        'imobiliaria_id', r.imobiliaria_id,
        'modo_original', r.modo,
        'modo_novo', CASE WHEN v_imovel_id IS NOT NULL THEN 'carteira' ELSE 'manual' END,
        'imovel_id', v_imovel_id,
        'link_origem', v_link
      )
    );
  END LOOP;

  RETURN QUERY SELECT v_total, v_carteira, v_manual;
END;
$$;

REVOKE ALL ON FUNCTION public.migrar_avaliacoes_link() FROM public;
GRANT EXECUTE ON FUNCTION public.migrar_avaliacoes_link() TO service_role;

-- 2) Executa a migração para os registros existentes
SELECT public.migrar_avaliacoes_link();

-- 3) Impede que novas avaliações sejam gravadas no modo link
CREATE OR REPLACE FUNCTION public.avaliacoes_historico_normaliza_modo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.modo, '')) IN ('link', 'url', 'anuncio', 'anúncio') THEN
    NEW.dados_completos := coalesce(NEW.dados_completos, '{}'::jsonb)
      || jsonb_build_object('modo_original', NEW.modo, 'migrado_em', now());
    NEW.modo := CASE WHEN NEW.imovel_id IS NOT NULL THEN 'carteira' ELSE 'manual' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avaliacoes_historico_normaliza_modo ON public.avaliacoes_historico;
CREATE TRIGGER trg_avaliacoes_historico_normaliza_modo
BEFORE INSERT OR UPDATE ON public.avaliacoes_historico
FOR EACH ROW EXECUTE FUNCTION public.avaliacoes_historico_normaliza_modo();