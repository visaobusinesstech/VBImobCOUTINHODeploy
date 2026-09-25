
CREATE TABLE IF NOT EXISTS public.corretor_atribuicao_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  corretor_id uuid NOT NULL REFERENCES public.corretores(id) ON DELETE CASCADE,
  cidade text,
  bairro text,
  prioridade int NOT NULL DEFAULT 100,
  peso int NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_car_imob ON public.corretor_atribuicao_regras(imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_car_corretor ON public.corretor_atribuicao_regras(corretor_id);
CREATE INDEX IF NOT EXISTS idx_car_lookup
  ON public.corretor_atribuicao_regras(imobiliaria_id, ativo, lower(cidade), lower(bairro));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corretor_atribuicao_regras TO authenticated;
GRANT ALL ON public.corretor_atribuicao_regras TO service_role;
ALTER TABLE public.corretor_atribuicao_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "car_select" ON public.corretor_atribuicao_regras
  FOR SELECT TO authenticated USING (imobiliaria_id = auth.uid());
CREATE POLICY "car_insert" ON public.corretor_atribuicao_regras
  FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "car_update" ON public.corretor_atribuicao_regras
  FOR UPDATE TO authenticated USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "car_delete" ON public.corretor_atribuicao_regras
  FOR DELETE TO authenticated USING (imobiliaria_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_car_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_car_touch ON public.corretor_atribuicao_regras;
CREATE TRIGGER trg_car_touch BEFORE UPDATE ON public.corretor_atribuicao_regras
FOR EACH ROW EXECUTE FUNCTION public.tg_car_touch();

-- Escolha do corretor: prioridade > match_score (bairro+cidade > bairro > cidade > default) > menor carga
CREATE OR REPLACE FUNCTION public.pick_corretor_para_captacao(
  p_imobiliaria_id uuid, p_cidade text, p_bairro text
) RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_cidade text := lower(trim(coalesce(p_cidade, '')));
  v_bairro text := lower(trim(coalesce(p_bairro, '')));
BEGIN
  WITH ativos AS (
    SELECT c.id
      FROM public.corretores c
     WHERE c.imobiliaria_id = p_imobiliaria_id AND c.status = 'ativo'
  ),
  carga AS (
    SELECT ativos.id,
           (SELECT count(*)
              FROM public.captacao_pipeline cp
             WHERE cp.corretor_id = ativos.id
               AND cp.estagio NOT IN ('Perdido','Contrato Assinado')) AS abertos
      FROM ativos
  ),
  regras AS (
    SELECT r.corretor_id,
           r.prioridade,
           CASE
             WHEN lower(coalesce(r.bairro,'')) = v_bairro
              AND lower(coalesce(r.cidade,'')) = v_cidade
              AND v_bairro <> '' THEN 4
             WHEN lower(coalesce(r.bairro,'')) = v_bairro AND v_bairro <> '' THEN 3
             WHEN lower(coalesce(r.cidade,'')) = v_cidade AND v_cidade <> ''
              AND coalesce(r.bairro,'') = '' THEN 2
             WHEN coalesce(r.cidade,'') = '' AND coalesce(r.bairro,'') = '' THEN 1
             ELSE 0
           END AS match_score
      FROM public.corretor_atribuicao_regras r
     WHERE r.imobiliaria_id = p_imobiliaria_id
       AND r.ativo
       AND r.corretor_id IN (SELECT id FROM ativos)
  ),
  candidatos AS (
    SELECT regras.corretor_id, max(regras.match_score) AS score, min(regras.prioridade) AS prio
      FROM regras
     WHERE regras.match_score > 0
     GROUP BY regras.corretor_id
  )
  SELECT c.corretor_id INTO v_id
    FROM candidatos c
    JOIN carga ON carga.id = c.corretor_id
   ORDER BY c.score DESC, c.prio ASC, carga.abertos ASC, c.corretor_id
   LIMIT 1;

  -- Fallback: corretor ativo com menor carga
  IF v_id IS NULL THEN
    SELECT carga.id INTO v_id FROM (
      SELECT ativos.id,
             (SELECT count(*)
                FROM public.captacao_pipeline cp
               WHERE cp.corretor_id = ativos.id
                 AND cp.estagio NOT IN ('Perdido','Contrato Assinado')) AS abertos
        FROM (SELECT id FROM public.corretores
               WHERE imobiliaria_id = p_imobiliaria_id AND status = 'ativo') ativos
    ) carga
    ORDER BY carga.abertos ASC, carga.id
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pick_corretor_para_captacao(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pick_corretor_para_captacao(uuid, text, text) TO authenticated, service_role;

-- Trigger usa a nova função de escolha
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
    INTO v_grupo FROM public.radarzap_grupos WHERE id = NEW.grupo_id;
  SELECT id, data_mensagem, autor_contato
    INTO v_msg FROM public.radarzap_mensagens WHERE id = NEW.mensagem_id;

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

  -- Escolha avançada de corretor (regras por cidade/bairro + carga)
  v_corretor := public.pick_corretor_para_captacao(NEW.imobiliaria_id, NEW.cidade, NEW.bairro);

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
      'origem_mensagem_em', v_msg.data_mensagem,
      'atribuicao_auto', v_corretor IS NOT NULL
    )
  )
  RETURNING id INTO v_new_id;

  UPDATE public.radarzap_leads
     SET lead_id = v_new_id, status = 'convertido', updated_at = now()
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
