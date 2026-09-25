
-- 1) Tabela de log
CREATE TABLE IF NOT EXISTS public.radarzap_dedup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  radarzap_lead_id uuid,
  radarzap_mensagem_id uuid,
  radarzap_grupo_id uuid,
  decisao text NOT NULL,
  motivo text,
  match_por text,
  campos_batidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  destino_pipeline_id uuid,
  destino_radarzap_lead_id uuid,
  dedup_key text,
  dedup_group_id uuid,
  score int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rz_dedup_log_imob ON public.radarzap_dedup_log (imobiliaria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rz_dedup_log_lead ON public.radarzap_dedup_log (radarzap_lead_id);
CREATE INDEX IF NOT EXISTS idx_rz_dedup_log_dest ON public.radarzap_dedup_log (destino_pipeline_id);

GRANT SELECT ON public.radarzap_dedup_log TO authenticated;
GRANT ALL ON public.radarzap_dedup_log TO service_role;

ALTER TABLE public.radarzap_dedup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rz_dedup_log_own_select" ON public.radarzap_dedup_log
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));

-- 2) Nova função com logging detalhado
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

  -- Busca card existente por telefone, e-mail ou documento
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

  -- Match interno via dedup_group_id (mesmo grupo, outro lead já convertido)
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

  -- Cria novo card
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
