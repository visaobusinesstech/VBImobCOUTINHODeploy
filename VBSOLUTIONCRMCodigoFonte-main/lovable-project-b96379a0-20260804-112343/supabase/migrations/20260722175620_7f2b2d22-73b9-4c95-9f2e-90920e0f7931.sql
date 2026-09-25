
-- 1) Nova coluna para rastrear campos verificados pelo usuário
ALTER TABLE public.captacao_pipeline
  ADD COLUMN IF NOT EXISTS campos_verificados jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Trigger BEFORE UPDATE: marca campos alterados manualmente como verificados
CREATE OR REPLACE FUNCTION public.tg_cp_marca_verificados()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skip text := current_setting('rz.merge_in_progress', true);
  v_v jsonb := coalesce(NEW.campos_verificados, '{}'::jsonb);
BEGIN
  -- Se a mudança vem da própria mesclagem automática, não marca nada
  IF v_skip = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.telefone IS DISTINCT FROM OLD.telefone AND NEW.telefone IS NOT NULL AND btrim(NEW.telefone) <> '' THEN
    v_v := v_v || jsonb_build_object('telefone', true);
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    v_v := v_v || jsonb_build_object('email', true);
  END IF;
  IF NEW.nome IS DISTINCT FROM OLD.nome AND NEW.nome IS NOT NULL AND btrim(NEW.nome) <> '' THEN
    v_v := v_v || jsonb_build_object('nome', true);
  END IF;
  IF NEW.imovel_endereco IS DISTINCT FROM OLD.imovel_endereco AND NEW.imovel_endereco IS NOT NULL AND btrim(NEW.imovel_endereco) <> '' THEN
    v_v := v_v || jsonb_build_object('imovel_endereco', true);
  END IF;
  IF NEW.imovel_cidade IS DISTINCT FROM OLD.imovel_cidade AND NEW.imovel_cidade IS NOT NULL AND btrim(NEW.imovel_cidade) <> '' THEN
    v_v := v_v || jsonb_build_object('imovel_cidade', true);
  END IF;
  IF NEW.imovel_bairro IS DISTINCT FROM OLD.imovel_bairro AND NEW.imovel_bairro IS NOT NULL AND btrim(NEW.imovel_bairro) <> '' THEN
    v_v := v_v || jsonb_build_object('imovel_bairro', true);
  END IF;
  IF NEW.imovel_tipo IS DISTINCT FROM OLD.imovel_tipo AND NEW.imovel_tipo IS NOT NULL AND btrim(NEW.imovel_tipo) <> '' THEN
    v_v := v_v || jsonb_build_object('imovel_tipo', true);
  END IF;
  IF NEW.operacao IS DISTINCT FROM OLD.operacao AND NEW.operacao IS NOT NULL AND btrim(NEW.operacao) <> '' THEN
    v_v := v_v || jsonb_build_object('operacao', true);
  END IF;
  IF NEW.valor_estimado IS DISTINCT FROM OLD.valor_estimado AND NEW.valor_estimado IS NOT NULL THEN
    v_v := v_v || jsonb_build_object('valor_estimado', true);
  END IF;

  NEW.campos_verificados := v_v;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cp_marca_verificados ON public.captacao_pipeline;
CREATE TRIGGER trg_cp_marca_verificados
BEFORE UPDATE ON public.captacao_pipeline
FOR EACH ROW EXECUTE FUNCTION public.tg_cp_marca_verificados();

-- 3) Função que mescla dados complementares sem sobrescrever verificados
CREATE OR REPLACE FUNCTION public.rz_mesclar_dados_complementares(_pipeline_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.captacao_pipeline%ROWTYPE;
  v_ver jsonb;
  v_new_tel text;
  v_new_email text;
  v_new_end text;
  v_new_cidade text;
  v_new_bairro text;
  v_new_tipo text;
  v_new_op text;
  v_new_valor numeric;
  v_tels_alt text[] := ARRAY[]::text[];
  v_emails_alt text[] := ARRAY[]::text[];
  v_summary jsonb := '{}'::jsonb;
  v_applied jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_card FROM public.captacao_pipeline WHERE id = _pipeline_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'card_not_found');
  END IF;
  IF v_card.imobiliaria_id <> auth.uid() AND NOT public.is_master(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_ver := coalesce(v_card.campos_verificados, '{}'::jsonb);

  -- Coleta candidatos: leads RadarZAP vinculados (principal + duplicados) desta imobiliária
  WITH src AS (
    SELECT contato, proprietario_nome, bairro, cidade, tipo_imovel, operacao, preco, score_detalhes, score, created_at
      FROM public.radarzap_leads
     WHERE imobiliaria_id = v_card.imobiliaria_id
       AND lead_id = _pipeline_id
     ORDER BY score DESC NULLS LAST, created_at DESC
  )
  SELECT
    (SELECT contato FROM src WHERE contato IS NOT NULL AND btrim(contato) <> '' LIMIT 1),
    (SELECT lower(nullif(btrim(coalesce(score_detalhes->>'email','')), ''))
       FROM src WHERE coalesce(score_detalhes->>'email','') <> '' LIMIT 1),
    NULL::text,
    (SELECT cidade FROM src WHERE cidade IS NOT NULL AND btrim(cidade) <> '' LIMIT 1),
    (SELECT bairro FROM src WHERE bairro IS NOT NULL AND btrim(bairro) <> '' LIMIT 1),
    (SELECT tipo_imovel FROM src WHERE tipo_imovel IS NOT NULL AND btrim(tipo_imovel) <> '' LIMIT 1),
    (SELECT initcap(operacao) FROM src WHERE operacao IS NOT NULL AND btrim(operacao) <> '' LIMIT 1),
    (SELECT preco FROM src WHERE preco IS NOT NULL AND preco > 0 LIMIT 1),
    coalesce(array_agg(DISTINCT contato) FILTER (WHERE contato IS NOT NULL AND btrim(contato) <> ''), '{}'),
    coalesce(array_agg(DISTINCT lower(nullif(btrim(coalesce(score_detalhes->>'email','')), '')))
      FILTER (WHERE coalesce(score_detalhes->>'email','') <> ''), '{}')
  INTO
    v_new_tel, v_new_email, v_new_end, v_new_cidade, v_new_bairro,
    v_new_tipo, v_new_op, v_new_valor, v_tels_alt, v_emails_alt
  FROM src;

  -- Decide o que aplicar: só onde campo está vazio E não foi verificado pelo usuário
  IF (v_card.telefone IS NULL OR btrim(v_card.telefone) = '')
     AND coalesce((v_ver->>'telefone')::boolean, false) = false
     AND v_new_tel IS NOT NULL THEN
    v_applied := v_applied || jsonb_build_object('telefone', v_new_tel);
  ELSE
    v_new_tel := v_card.telefone;
  END IF;

  IF (v_card.email IS NULL OR btrim(v_card.email) = '')
     AND coalesce((v_ver->>'email')::boolean, false) = false
     AND v_new_email IS NOT NULL THEN
    v_applied := v_applied || jsonb_build_object('email', v_new_email);
  ELSE
    v_new_email := v_card.email;
  END IF;

  IF (v_card.imovel_cidade IS NULL OR btrim(v_card.imovel_cidade) = '')
     AND coalesce((v_ver->>'imovel_cidade')::boolean, false) = false
     AND v_new_cidade IS NOT NULL THEN
    v_applied := v_applied || jsonb_build_object('imovel_cidade', v_new_cidade);
  ELSE
    v_new_cidade := v_card.imovel_cidade;
  END IF;

  IF (v_card.imovel_bairro IS NULL OR btrim(v_card.imovel_bairro) = '')
     AND coalesce((v_ver->>'imovel_bairro')::boolean, false) = false
     AND v_new_bairro IS NOT NULL THEN
    v_applied := v_applied || jsonb_build_object('imovel_bairro', v_new_bairro);
  ELSE
    v_new_bairro := v_card.imovel_bairro;
  END IF;

  IF (v_card.imovel_tipo IS NULL OR btrim(v_card.imovel_tipo) = '')
     AND coalesce((v_ver->>'imovel_tipo')::boolean, false) = false
     AND v_new_tipo IS NOT NULL THEN
    v_applied := v_applied || jsonb_build_object('imovel_tipo', v_new_tipo);
  ELSE
    v_new_tipo := v_card.imovel_tipo;
  END IF;

  IF (v_card.operacao IS NULL OR btrim(v_card.operacao) = '')
     AND coalesce((v_ver->>'operacao')::boolean, false) = false
     AND v_new_op IS NOT NULL THEN
    v_applied := v_applied || jsonb_build_object('operacao', v_new_op);
  ELSE
    v_new_op := v_card.operacao;
  END IF;

  IF v_card.valor_estimado IS NULL
     AND coalesce((v_ver->>'valor_estimado')::boolean, false) = false
     AND v_new_valor IS NOT NULL THEN
    v_applied := v_applied || jsonb_build_object('valor_estimado', v_new_valor);
  ELSE
    v_new_valor := v_card.valor_estimado;
  END IF;

  -- Executa a atualização marcando session GUC para evitar marcar como verificado
  PERFORM set_config('rz.merge_in_progress', 'on', true);

  UPDATE public.captacao_pipeline
     SET telefone = v_new_tel,
         email = v_new_email,
         imovel_cidade = v_new_cidade,
         imovel_bairro = v_new_bairro,
         imovel_tipo = v_new_tipo,
         operacao = v_new_op,
         valor_estimado = v_new_valor,
         dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
           'telefones_alternativos', to_jsonb(v_tels_alt),
           'emails_alternativos', to_jsonb(v_emails_alt),
           'ultima_mesclagem_em', now(),
           'ultima_mesclagem_aplicou', v_applied
         ),
         updated_at = now()
   WHERE id = _pipeline_id;

  PERFORM set_config('rz.merge_in_progress', 'off', true);

  v_summary := jsonb_build_object(
    'pipeline_id', _pipeline_id,
    'aplicado', v_applied,
    'preservados_verificados', v_ver,
    'telefones_alternativos', to_jsonb(v_tels_alt),
    'emails_alternativos', to_jsonb(v_emails_alt)
  );

  -- Registra atividade
  IF v_applied <> '{}'::jsonb OR array_length(v_tels_alt, 1) > 1 OR array_length(v_emails_alt, 1) > 1 THEN
    INSERT INTO public.captacao_pipeline_atividades (
      pipeline_id, imobiliaria_id, tipo, descricao, metadata
    ) VALUES (
      _pipeline_id, v_card.imobiliaria_id, 'radarzap_mesclagem_auto',
      'Dados complementares mesclados automaticamente a partir de leads duplicados',
      v_summary
    );
  END IF;

  RETURN v_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rz_mesclar_dados_complementares(uuid) TO authenticated;

-- 4) Chamada automática dentro do gatilho de conversão RadarZAP → pipeline (após marcar duplicado)
CREATE OR REPLACE FUNCTION public.tg_radarzap_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op text;
  v_corretor uuid;
  v_new_id uuid;
  v_existing_id uuid;
  v_nome text;
  v_status text := lower(coalesce(NEW.status, ''));
  v_grupo record;
  v_msg record;
  v_tel text;
  v_email text;
  v_doc text;
  v_min_score int;
  v_match_por text;
  v_campos jsonb := '{}'::jsonb;
  v_dedup_group_match uuid;
BEGIN
  v_op := lower(coalesce(NEW.operacao, ''));

  IF v_op NOT IN ('venda','aluguel','temporada') THEN
    INSERT INTO public.radarzap_dedup_log (imobiliaria_id, radarzap_lead_id, radarzap_mensagem_id, radarzap_grupo_id, decisao, motivo, score, dedup_key, dedup_group_id)
    VALUES (NEW.imobiliaria_id, NEW.id, NEW.mensagem_id, NEW.grupo_id, 'ignorado', 'operacao_fora_escopo:' || coalesce(v_op,'null'), NEW.score, NEW.dedup_key, NEW.dedup_group_id);
    RETURN NEW;
  END IF;
  IF NEW.lead_id IS NOT NULL THEN RETURN NEW; END IF;
  IF v_status NOT IN ('aprovado','novo','contato') THEN
    INSERT INTO public.radarzap_dedup_log (imobiliaria_id, radarzap_lead_id, radarzap_mensagem_id, radarzap_grupo_id, decisao, motivo, score, dedup_key, dedup_group_id)
    VALUES (NEW.imobiliaria_id, NEW.id, NEW.mensagem_id, NEW.grupo_id, 'ignorado', 'status_nao_elegivel:' || v_status, NEW.score, NEW.dedup_key, NEW.dedup_group_id);
    RETURN NEW;
  END IF;
  IF NEW.is_principal IS FALSE THEN
    INSERT INTO public.radarzap_dedup_log (imobiliaria_id, radarzap_lead_id, radarzap_mensagem_id, radarzap_grupo_id, decisao, motivo, score, dedup_key, dedup_group_id)
    VALUES (NEW.imobiliaria_id, NEW.id, NEW.mensagem_id, NEW.grupo_id, 'ignorado', 'nao_principal', NEW.score, NEW.dedup_key, NEW.dedup_group_id);
    RETURN NEW;
  END IF;

  v_min_score := public.rz_min_score_principal(NEW.imobiliaria_id);
  IF NEW.score < v_min_score THEN
    INSERT INTO public.radarzap_dedup_log (imobiliaria_id, radarzap_lead_id, radarzap_mensagem_id, radarzap_grupo_id, decisao, motivo, score, dedup_key, dedup_group_id)
    VALUES (NEW.imobiliaria_id, NEW.id, NEW.mensagem_id, NEW.grupo_id, 'ignorado', 'score_abaixo_minimo:' || NEW.score || '<' || v_min_score, NEW.score, NEW.dedup_key, NEW.dedup_group_id);
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.captacao_pipeline WHERE radarzap_lead_id = NEW.id) THEN
    INSERT INTO public.radarzap_dedup_log (imobiliaria_id, radarzap_lead_id, radarzap_mensagem_id, radarzap_grupo_id, decisao, motivo, score, dedup_key, dedup_group_id)
    VALUES (NEW.imobiliaria_id, NEW.id, NEW.mensagem_id, NEW.grupo_id, 'ignorado', 'ja_convertido_anteriormente', NEW.score, NEW.dedup_key, NEW.dedup_group_id);
    RETURN NEW;
  END IF;

  SELECT id, nome, cidade, uf, bairro, categoria, invite_url
    INTO v_grupo
    FROM public.radarzap_grupos WHERE id = NEW.grupo_id;

  SELECT id, data_mensagem, autor_contato
    INTO v_msg
    FROM public.radarzap_mensagens WHERE id = NEW.mensagem_id;

  v_tel := public.normalize_phone_digits(NEW.contato);
  v_email := lower(nullif(trim(coalesce((NEW.score_detalhes->>'email'), '')), ''));
  v_doc := regexp_replace(coalesce(NEW.score_detalhes->>'documento',''), '\D', '', 'g');
  IF v_doc = '' THEN v_doc := NULL; END IF;

  SELECT id INTO v_existing_id
    FROM public.captacao_pipeline
   WHERE imobiliaria_id = NEW.imobiliaria_id
     AND estagio <> 'Perdido'
     AND (
       (v_tel IS NOT NULL AND length(v_tel) >= 8
          AND public.normalize_phone_digits(telefone) = v_tel)
       OR (v_email IS NOT NULL AND lower(email) = v_email)
       OR (v_doc IS NOT NULL
             AND regexp_replace(coalesce(dados->>'documento',''), '\D', '', 'g') = v_doc)
     )
   ORDER BY updated_at DESC
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    v_match_por := CASE
      WHEN v_tel IS NOT NULL AND EXISTS (SELECT 1 FROM public.captacao_pipeline WHERE id = v_existing_id AND public.normalize_phone_digits(telefone) = v_tel) THEN 'telefone'
      WHEN v_email IS NOT NULL AND EXISTS (SELECT 1 FROM public.captacao_pipeline WHERE id = v_existing_id AND lower(email) = v_email) THEN 'email'
      WHEN v_doc IS NOT NULL THEN 'documento'
      ELSE 'desconhecido'
    END;

    v_campos := jsonb_build_object(
      'telefone', CASE WHEN v_match_por = 'telefone' THEN v_tel END,
      'email', CASE WHEN v_match_por = 'email' THEN v_email END,
      'documento', CASE WHEN v_match_por = 'documento' THEN v_doc END,
      'nome_novo', NEW.proprietario_nome,
      'bairro', NEW.bairro,
      'cidade', NEW.cidade,
      'tipo_imovel', NEW.tipo_imovel,
      'operacao', NEW.operacao,
      'preco', NEW.preco
    );

    PERFORM set_config('rz.merge_in_progress', 'on', true);
    UPDATE public.captacao_pipeline
       SET dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
             'radarzap_duplicados', coalesce(dados->'radarzap_duplicados','[]'::jsonb) ||
               jsonb_build_array(jsonb_build_object(
                 'radarzap_lead_id', NEW.id,
                 'radarzap_mensagem_id', NEW.mensagem_id,
                 'radarzap_grupo_id', NEW.grupo_id,
                 'origem_grupo_nome', v_grupo.nome,
                 'origem_grupo_link', v_grupo.invite_url,
                 'origem_mensagem_em', v_msg.data_mensagem,
                 'resumo', NEW.resumo,
                 'score', NEW.score,
                 'detectado_em', now()
               )),
             'origem_canal', coalesce(dados->>'origem_canal','WhatsApp'),
             'origem_grupo_nome', coalesce(dados->>'origem_grupo_nome', v_grupo.nome),
             'origem_grupo_link', coalesce(dados->>'origem_grupo_link', v_grupo.invite_url)
           ),
           updated_at = now()
     WHERE id = v_existing_id;
    PERFORM set_config('rz.merge_in_progress', 'off', true);

    INSERT INTO public.captacao_pipeline_atividades (
      pipeline_id, imobiliaria_id, tipo, descricao, metadata
    ) VALUES (
      v_existing_id, NEW.imobiliaria_id, 'radarzap_duplicado',
      'Novo sinal do RadarZAP para proprietário já cadastrado' ||
        CASE WHEN v_grupo.nome IS NOT NULL THEN ' (grupo: ' || v_grupo.nome || ')' ELSE '' END,
      jsonb_build_object(
        'radarzap_lead_id', NEW.id,
        'radarzap_grupo_id', NEW.grupo_id,
        'radarzap_mensagem_id', NEW.mensagem_id,
        'match_por', v_match_por,
        'score', NEW.score,
        'resumo', NEW.resumo
      )
    );

    UPDATE public.radarzap_leads
       SET lead_id = v_existing_id, status = 'duplicado', updated_at = now()
     WHERE id = NEW.id;

    -- Mesclagem automática pós-duplicado
    PERFORM public.rz_mesclar_dados_complementares_internal(v_existing_id, NEW.imobiliaria_id);

    INSERT INTO public.radarzap_dedup_log (
      imobiliaria_id, radarzap_lead_id, radarzap_mensagem_id, radarzap_grupo_id,
      decisao, motivo, match_por, campos_batidos,
      destino_pipeline_id, dedup_key, dedup_group_id, score
    ) VALUES (
      NEW.imobiliaria_id, NEW.id, NEW.mensagem_id, NEW.grupo_id,
      'mesclado', 'contato existente no pipeline', v_match_por, v_campos,
      v_existing_id, NEW.dedup_key, NEW.dedup_group_id, NEW.score
    );

    RETURN NEW;
  END IF;

  SELECT lead_id INTO v_dedup_group_match
    FROM public.radarzap_leads
   WHERE imobiliaria_id = NEW.imobiliaria_id
     AND dedup_group_id = NEW.dedup_group_id
     AND lead_id IS NOT NULL
     AND id <> NEW.id
   ORDER BY updated_at DESC
   LIMIT 1;

  IF v_dedup_group_match IS NOT NULL THEN
    UPDATE public.radarzap_leads
       SET lead_id = v_dedup_group_match, status = 'duplicado', updated_at = now()
     WHERE id = NEW.id;

    PERFORM public.rz_mesclar_dados_complementares_internal(v_dedup_group_match, NEW.imobiliaria_id);

    INSERT INTO public.radarzap_dedup_log (
      imobiliaria_id, radarzap_lead_id, radarzap_mensagem_id, radarzap_grupo_id,
      decisao, motivo, match_por, campos_batidos,
      destino_pipeline_id, dedup_key, dedup_group_id, score
    ) VALUES (
      NEW.imobiliaria_id, NEW.id, NEW.mensagem_id, NEW.grupo_id,
      'mesclado', 'dedup_group_id compartilhado', 'dedup_key',
      jsonb_build_object('dedup_key', NEW.dedup_key),
      v_dedup_group_match, NEW.dedup_key, NEW.dedup_group_id, NEW.score
    );
    RETURN NEW;
  END IF;

  IF (SELECT count(*) FROM public.corretores
      WHERE imobiliaria_id = NEW.imobiliaria_id AND status = 'ativo') = 1 THEN
    SELECT id INTO v_corretor FROM public.corretores
     WHERE imobiliaria_id = NEW.imobiliaria_id AND status = 'ativo' LIMIT 1;
  END IF;

  v_nome := coalesce(
    nullif(trim(NEW.proprietario_nome), ''),
    'Proprietário via RadarZAP' ||
      CASE WHEN NEW.bairro IS NOT NULL THEN ' — ' || NEW.bairro ELSE '' END
  );

  INSERT INTO public.captacao_pipeline (
    imobiliaria_id, corretor_id, nome, telefone,
    imovel_cidade, imovel_bairro, imovel_tipo, operacao,
    valor_estimado, origem, estagio, radarzap_lead_id, dados
  ) VALUES (
    NEW.imobiliaria_id, v_corretor, v_nome, NEW.contato,
    NEW.cidade, NEW.bairro, NEW.tipo_imovel, initcap(v_op),
    NEW.preco, 'RadarZAP', 'Prospectado', NEW.id,
    jsonb_build_object(
      'radarzap_lead_id', NEW.id,
      'radarzap_grupo_id', NEW.grupo_id,
      'radarzap_mensagem_id', NEW.mensagem_id,
      'resumo', NEW.resumo,
      'score', NEW.score,
      'score_detalhes', NEW.score_detalhes,
      'dedup_group_id', NEW.dedup_group_id,
      'aprovado_por', NEW.aprovado_por,
      'aprovado_em', NEW.aprovado_em,
      'origem_canal', 'WhatsApp',
      'origem_grupo_nome', v_grupo.nome,
      'origem_grupo_cidade', v_grupo.cidade,
      'origem_grupo_uf', v_grupo.uf,
      'origem_grupo_bairro', v_grupo.bairro,
      'origem_grupo_categoria', v_grupo.categoria,
      'origem_grupo_link', v_grupo.invite_url,
      'origem_mensagem_em', v_msg.data_mensagem
    )
  )
  RETURNING id INTO v_new_id;

  UPDATE public.radarzap_leads
     SET lead_id = v_new_id, status = 'convertido', updated_at = now()
   WHERE id = NEW.id;

  INSERT INTO public.radarzap_dedup_log (
    imobiliaria_id, radarzap_lead_id, radarzap_mensagem_id, radarzap_grupo_id,
    decisao, motivo, campos_batidos,
    destino_pipeline_id, dedup_key, dedup_group_id, score
  ) VALUES (
    NEW.imobiliaria_id, NEW.id, NEW.mensagem_id, NEW.grupo_id,
    'novo_card', 'nenhum contato existente encontrado',
    jsonb_build_object(
      'telefone', v_tel, 'email', v_email, 'documento', v_doc,
      'bairro', NEW.bairro, 'cidade', NEW.cidade,
      'tipo_imovel', NEW.tipo_imovel, 'operacao', NEW.operacao, 'preco', NEW.preco
    ),
    v_new_id, NEW.dedup_key, NEW.dedup_group_id, NEW.score
  );

  RETURN NEW;
END;
$$;

-- 5) Versão interna (sem checagem auth.uid) chamada pelo trigger
CREATE OR REPLACE FUNCTION public.rz_mesclar_dados_complementares_internal(_pipeline_id uuid, _imob uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.captacao_pipeline%ROWTYPE;
  v_ver jsonb;
  v_new_tel text; v_new_email text; v_new_cidade text; v_new_bairro text;
  v_new_tipo text; v_new_op text; v_new_valor numeric;
  v_tels_alt text[] := '{}'; v_emails_alt text[] := '{}';
  v_applied jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_card FROM public.captacao_pipeline
   WHERE id = _pipeline_id AND imobiliaria_id = _imob;
  IF NOT FOUND THEN RETURN; END IF;

  v_ver := coalesce(v_card.campos_verificados, '{}'::jsonb);

  WITH src AS (
    SELECT contato, bairro, cidade, tipo_imovel, operacao, preco, score_detalhes, score, created_at
      FROM public.radarzap_leads
     WHERE imobiliaria_id = _imob AND lead_id = _pipeline_id
     ORDER BY score DESC NULLS LAST, created_at DESC
  )
  SELECT
    (SELECT contato FROM src WHERE contato IS NOT NULL AND btrim(contato) <> '' LIMIT 1),
    (SELECT lower(nullif(btrim(coalesce(score_detalhes->>'email','')), ''))
       FROM src WHERE coalesce(score_detalhes->>'email','') <> '' LIMIT 1),
    (SELECT cidade FROM src WHERE cidade IS NOT NULL AND btrim(cidade) <> '' LIMIT 1),
    (SELECT bairro FROM src WHERE bairro IS NOT NULL AND btrim(bairro) <> '' LIMIT 1),
    (SELECT tipo_imovel FROM src WHERE tipo_imovel IS NOT NULL AND btrim(tipo_imovel) <> '' LIMIT 1),
    (SELECT initcap(operacao) FROM src WHERE operacao IS NOT NULL AND btrim(operacao) <> '' LIMIT 1),
    (SELECT preco FROM src WHERE preco IS NOT NULL AND preco > 0 LIMIT 1),
    coalesce(array_agg(DISTINCT contato) FILTER (WHERE contato IS NOT NULL AND btrim(contato) <> ''), '{}'),
    coalesce(array_agg(DISTINCT lower(nullif(btrim(coalesce(score_detalhes->>'email','')), '')))
      FILTER (WHERE coalesce(score_detalhes->>'email','') <> ''), '{}')
  INTO v_new_tel, v_new_email, v_new_cidade, v_new_bairro,
       v_new_tipo, v_new_op, v_new_valor, v_tels_alt, v_emails_alt
  FROM src;

  IF NOT ((v_card.telefone IS NULL OR btrim(v_card.telefone) = '')
     AND coalesce((v_ver->>'telefone')::boolean, false) = false
     AND v_new_tel IS NOT NULL) THEN v_new_tel := v_card.telefone;
  ELSE v_applied := v_applied || jsonb_build_object('telefone', v_new_tel); END IF;

  IF NOT ((v_card.email IS NULL OR btrim(v_card.email) = '')
     AND coalesce((v_ver->>'email')::boolean, false) = false
     AND v_new_email IS NOT NULL) THEN v_new_email := v_card.email;
  ELSE v_applied := v_applied || jsonb_build_object('email', v_new_email); END IF;

  IF NOT ((v_card.imovel_cidade IS NULL OR btrim(v_card.imovel_cidade) = '')
     AND coalesce((v_ver->>'imovel_cidade')::boolean, false) = false
     AND v_new_cidade IS NOT NULL) THEN v_new_cidade := v_card.imovel_cidade;
  ELSE v_applied := v_applied || jsonb_build_object('imovel_cidade', v_new_cidade); END IF;

  IF NOT ((v_card.imovel_bairro IS NULL OR btrim(v_card.imovel_bairro) = '')
     AND coalesce((v_ver->>'imovel_bairro')::boolean, false) = false
     AND v_new_bairro IS NOT NULL) THEN v_new_bairro := v_card.imovel_bairro;
  ELSE v_applied := v_applied || jsonb_build_object('imovel_bairro', v_new_bairro); END IF;

  IF NOT ((v_card.imovel_tipo IS NULL OR btrim(v_card.imovel_tipo) = '')
     AND coalesce((v_ver->>'imovel_tipo')::boolean, false) = false
     AND v_new_tipo IS NOT NULL) THEN v_new_tipo := v_card.imovel_tipo;
  ELSE v_applied := v_applied || jsonb_build_object('imovel_tipo', v_new_tipo); END IF;

  IF NOT ((v_card.operacao IS NULL OR btrim(v_card.operacao) = '')
     AND coalesce((v_ver->>'operacao')::boolean, false) = false
     AND v_new_op IS NOT NULL) THEN v_new_op := v_card.operacao;
  ELSE v_applied := v_applied || jsonb_build_object('operacao', v_new_op); END IF;

  IF NOT (v_card.valor_estimado IS NULL
     AND coalesce((v_ver->>'valor_estimado')::boolean, false) = false
     AND v_new_valor IS NOT NULL) THEN v_new_valor := v_card.valor_estimado;
  ELSE v_applied := v_applied || jsonb_build_object('valor_estimado', v_new_valor); END IF;

  PERFORM set_config('rz.merge_in_progress', 'on', true);
  UPDATE public.captacao_pipeline
     SET telefone = v_new_tel, email = v_new_email,
         imovel_cidade = v_new_cidade, imovel_bairro = v_new_bairro,
         imovel_tipo = v_new_tipo, operacao = v_new_op, valor_estimado = v_new_valor,
         dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
           'telefones_alternativos', to_jsonb(v_tels_alt),
           'emails_alternativos', to_jsonb(v_emails_alt),
           'ultima_mesclagem_em', now(),
           'ultima_mesclagem_aplicou', v_applied
         ),
         updated_at = now()
   WHERE id = _pipeline_id;
  PERFORM set_config('rz.merge_in_progress', 'off', true);

  IF v_applied <> '{}'::jsonb THEN
    INSERT INTO public.captacao_pipeline_atividades (
      pipeline_id, imobiliaria_id, tipo, descricao, metadata
    ) VALUES (
      _pipeline_id, _imob, 'radarzap_mesclagem_auto',
      'Dados complementares mesclados automaticamente a partir de leads duplicados',
      jsonb_build_object('aplicado', v_applied, 'preservados_verificados', v_ver,
        'telefones_alternativos', to_jsonb(v_tels_alt),
        'emails_alternativos', to_jsonb(v_emails_alt))
    );
  END IF;
END;
$$;
