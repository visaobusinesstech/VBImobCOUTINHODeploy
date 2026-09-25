
-- 1) Normalizador de telefone para E.164 (BR-default)
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
  has_plus boolean;
  ddd text;
  sub text;
BEGIN
  IF _raw IS NULL OR btrim(_raw) = '' THEN
    RETURN NULL;
  END IF;

  IF _raw !~ '^[\d+\s().\-\u00A0]+$' THEN
    RETURN NULL;
  END IF;

  has_plus := left(btrim(_raw), 1) = '+';
  digits := regexp_replace(_raw, '\D', '', 'g');

  IF digits = '' THEN
    RETURN NULL;
  END IF;

  IF NOT has_plus THEN
    IF digits ~ '^55' AND (length(digits) = 12 OR length(digits) = 13) THEN
      NULL;
    ELSIF length(digits) IN (10, 11) THEN
      digits := '55' || digits;
    ELSE
      digits := '55' || digits;
    END IF;
  END IF;

  IF length(digits) < 8 OR length(digits) > 15 THEN
    RETURN NULL;
  END IF;

  -- Validação BR
  IF left(digits, 2) = '55' THEN
    IF length(digits) NOT IN (12, 13) THEN
      RETURN NULL;
    END IF;
    ddd := substring(digits, 3, 2);
    sub := substring(digits, 5);
    IF ddd::int < 11 OR ddd::int > 99 THEN
      RETURN NULL;
    END IF;
    IF length(sub) = 9 AND left(sub, 1) <> '9' THEN
      RETURN NULL;
    END IF;
    IF length(sub) NOT IN (8, 9) THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN '+' || digits;
END;
$$;

-- 2) Coluna telefone_e164 + coluna dedup_ignored_group_hash + trigger para manter sincronizado
ALTER TABLE public.lista_proprietarios_captacao
  ADD COLUMN IF NOT EXISTS telefone_e164 text,
  ADD COLUMN IF NOT EXISTS dedup_ignored_group_hash text;

CREATE OR REPLACE FUNCTION public.tg_lista_proprietarios_captacao_e164()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.telefone_e164 := public.normalize_phone_e164(NEW.telefone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lista_prop_capt_e164 ON public.lista_proprietarios_captacao;
CREATE TRIGGER trg_lista_prop_capt_e164
  BEFORE INSERT OR UPDATE OF telefone ON public.lista_proprietarios_captacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_lista_proprietarios_captacao_e164();

-- Backfill
UPDATE public.lista_proprietarios_captacao
   SET telefone_e164 = public.normalize_phone_e164(telefone)
 WHERE telefone IS NOT NULL AND telefone_e164 IS NULL;

CREATE INDEX IF NOT EXISTS idx_lista_prop_capt_dedup
  ON public.lista_proprietarios_captacao (imobiliaria_id, telefone_e164)
  WHERE telefone_e164 IS NOT NULL;

-- 3) RPC: buscar grupos de duplicados por telefone
CREATE OR REPLACE FUNCTION public.find_dedup_groups_by_phone(_limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS TABLE (
  telefone_e164 text,
  total bigint,
  registros jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _imob uuid;
BEGIN
  _imob := public.get_user_imobiliaria_id();
  IF _imob IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    lp.telefone_e164,
    count(*)::bigint AS total,
    jsonb_agg(
      jsonb_build_object(
        'id', lp.id,
        'nome_proprietario', lp.nome_proprietario,
        'telefone', lp.telefone,
        'email', lp.email,
        'operacao', lp.operacao,
        'titulo_imovel', lp.titulo_imovel,
        'bairro', lp.bairro,
        'cidade', lp.cidade,
        'preco', lp.preco,
        'q_score', lp.q_score,
        'origem', lp.origem,
        'url_anuncio', lp.url_anuncio,
        'status_revisao', lp.status_revisao,
        'created_at', lp.created_at
      ) ORDER BY lp.created_at ASC
    ) AS registros
  FROM public.lista_proprietarios_captacao lp
  WHERE lp.imobiliaria_id = _imob
    AND lp.telefone_e164 IS NOT NULL
    AND (lp.dedup_ignored_group_hash IS DISTINCT FROM lp.telefone_e164)
  GROUP BY lp.telefone_e164
  HAVING count(*) > 1
  ORDER BY count(*) DESC, lp.telefone_e164
  LIMIT _limit OFFSET _offset;
END;
$$;

-- 4) RPC: ignorar grupo
CREATE OR REPLACE FUNCTION public.ignore_dedup_group(_telefone_e164 text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _imob uuid;
  _count int;
BEGIN
  _imob := public.get_user_imobiliaria_id();
  IF _imob IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.lista_proprietarios_captacao
     SET dedup_ignored_group_hash = _telefone_e164
   WHERE imobiliaria_id = _imob
     AND telefone_e164 = _telefone_e164;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- 5) RPC: mesclar grupo (merge não-destrutivo no mestre + deletar duplicados)
CREATE OR REPLACE FUNCTION public.merge_dedup_group(_master_id uuid, _duplicate_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _imob uuid;
  _master public.lista_proprietarios_captacao%ROWTYPE;
  _dup public.lista_proprietarios_captacao%ROWTYPE;
  _deleted int := 0;
BEGIN
  _imob := public.get_user_imobiliaria_id();
  IF _imob IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO _master
    FROM public.lista_proprietarios_captacao
   WHERE id = _master_id AND imobiliaria_id = _imob
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'master record not found for tenant';
  END IF;

  FOR _dup IN
    SELECT * FROM public.lista_proprietarios_captacao
     WHERE id = ANY(_duplicate_ids)
       AND imobiliaria_id = _imob
       AND id <> _master_id
     FOR UPDATE
  LOOP
    -- Merge não-destrutivo: preenche apenas campos vazios do mestre
    _master.email             := COALESCE(NULLIF(_master.email,''), _dup.email);
    _master.telefone          := COALESCE(NULLIF(_master.telefone,''), _dup.telefone);
    _master.titulo_imovel     := COALESCE(NULLIF(_master.titulo_imovel,''), _dup.titulo_imovel);
    _master.bairro            := COALESCE(NULLIF(_master.bairro,''), _dup.bairro);
    _master.cidade            := COALESCE(NULLIF(_master.cidade,''), _dup.cidade);
    _master.preco             := COALESCE(_master.preco, _dup.preco);
    _master.q_score           := COALESCE(_master.q_score, _dup.q_score);
    _master.observacoes       := COALESCE(NULLIF(_master.observacoes,''), _dup.observacoes);
    _master.origem            := COALESCE(NULLIF(_master.origem,''), _dup.origem);
    _master.imovel_id_ref     := COALESCE(NULLIF(_master.imovel_id_ref,''), _dup.imovel_id_ref);
    _master.url_anuncio       := COALESCE(NULLIF(_master.url_anuncio,''), _dup.url_anuncio);
    _master.status_revisao    := COALESCE(NULLIF(_master.status_revisao,''), _dup.status_revisao);
    _master.motivo_revisao    := COALESCE(NULLIF(_master.motivo_revisao,''), _dup.motivo_revisao);
    _master.dados_extraidos_raw := COALESCE(_master.dados_extraidos_raw, _dup.dados_extraidos_raw);

    DELETE FROM public.lista_proprietarios_captacao WHERE id = _dup.id;
    _deleted := _deleted + 1;
  END LOOP;

  UPDATE public.lista_proprietarios_captacao
     SET email = _master.email,
         telefone = _master.telefone,
         titulo_imovel = _master.titulo_imovel,
         bairro = _master.bairro,
         cidade = _master.cidade,
         preco = _master.preco,
         q_score = _master.q_score,
         observacoes = _master.observacoes,
         origem = _master.origem,
         imovel_id_ref = _master.imovel_id_ref,
         url_anuncio = _master.url_anuncio,
         status_revisao = _master.status_revisao,
         motivo_revisao = _master.motivo_revisao,
         dados_extraidos_raw = _master.dados_extraidos_raw,
         updated_at = now()
   WHERE id = _master.id;

  -- Log de auditoria (best-effort)
  BEGIN
    INSERT INTO public.system_logs (imobiliaria_id, tipo, mensagem, metadata)
    VALUES (
      _imob,
      'dedup_merge',
      'Mesclagem de duplicados por telefone E.164',
      jsonb_build_object(
        'master_id', _master.id,
        'telefone_e164', _master.telefone_e164,
        'deleted_count', _deleted,
        'duplicate_ids', to_jsonb(_duplicate_ids)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- se system_logs tiver schema diferente, apenas ignora
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'master_id', _master.id, 'deleted', _deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_dedup_groups_by_phone(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ignore_dedup_group(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_dedup_group(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_phone_e164(text) TO authenticated;
