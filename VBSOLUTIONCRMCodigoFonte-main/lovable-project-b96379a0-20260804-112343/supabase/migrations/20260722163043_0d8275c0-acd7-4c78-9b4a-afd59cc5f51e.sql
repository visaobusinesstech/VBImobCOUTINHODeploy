
-- Helper: normaliza telefone (mantém últimos 11 dígitos)
CREATE OR REPLACE FUNCTION public.normalize_phone_digits(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    ELSE right(regexp_replace(p, '\D', '', 'g'), 11)
  END
$$;

-- Índice para acelerar dedup por telefone/e-mail dentro da imobiliária
CREATE INDEX IF NOT EXISTS idx_cp_dedup_tel
  ON public.captacao_pipeline (imobiliaria_id, (public.normalize_phone_digits(telefone)));
CREATE INDEX IF NOT EXISTS idx_cp_dedup_email
  ON public.captacao_pipeline (imobiliaria_id, (lower(email)));

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
BEGIN
  v_op := lower(coalesce(NEW.operacao, ''));
  IF v_op NOT IN ('venda','aluguel','temporada') THEN RETURN NEW; END IF;
  IF NEW.lead_id IS NOT NULL THEN RETURN NEW; END IF;
  IF v_status NOT IN ('aprovado','novo','contato') THEN RETURN NEW; END IF;
  IF NEW.is_principal IS FALSE THEN RETURN NEW; END IF;
  IF NEW.score < 40 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.captacao_pipeline WHERE radarzap_lead_id = NEW.id) THEN
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

  -- Busca card existente por telefone, e-mail ou documento (mesma imobiliária, não perdido)
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
    -- Deduplicado: enriquecer card existente com origem e registrar atividade
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
        'match_por', CASE
          WHEN v_tel IS NOT NULL THEN 'telefone'
          WHEN v_email IS NOT NULL THEN 'email'
          WHEN v_doc IS NOT NULL THEN 'documento'
          ELSE 'desconhecido'
        END,
        'score', NEW.score,
        'resumo', NEW.resumo
      )
    );

    UPDATE public.radarzap_leads
       SET lead_id = v_existing_id, status = 'duplicado', updated_at = now()
     WHERE id = NEW.id;

    RETURN NEW;
  END IF;

  -- Não é duplicado: criar novo card normalmente
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

  RETURN NEW;
END;
$$;
