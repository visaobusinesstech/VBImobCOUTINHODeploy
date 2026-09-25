
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
  v_nome text;
  v_status text := lower(coalesce(NEW.status, ''));
  v_grupo record;
  v_msg record;
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

  IF (SELECT count(*) FROM public.corretores
      WHERE imobiliaria_id = NEW.imobiliaria_id AND status = 'ativo') = 1 THEN
    SELECT id INTO v_corretor FROM public.corretores
     WHERE imobiliaria_id = NEW.imobiliaria_id AND status = 'ativo' LIMIT 1;
  END IF;

  SELECT id, nome, cidade, uf, bairro, categoria, invite_url
    INTO v_grupo
    FROM public.radarzap_grupos WHERE id = NEW.grupo_id;

  SELECT id, data_mensagem, autor_contato
    INTO v_msg
    FROM public.radarzap_mensagens WHERE id = NEW.mensagem_id;

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

-- Backfill: enrich existing pipeline cards created from RadarZAP with source group data
UPDATE public.captacao_pipeline cp
SET dados = coalesce(cp.dados, '{}'::jsonb) || jsonb_build_object(
  'origem_canal', 'WhatsApp',
  'radarzap_mensagem_id', l.mensagem_id,
  'origem_grupo_nome', g.nome,
  'origem_grupo_cidade', g.cidade,
  'origem_grupo_uf', g.uf,
  'origem_grupo_bairro', g.bairro,
  'origem_grupo_categoria', g.categoria,
  'origem_grupo_link', g.invite_url,
  'origem_mensagem_em', m.data_mensagem
)
FROM public.radarzap_leads l
LEFT JOIN public.radarzap_grupos g ON g.id = l.grupo_id
LEFT JOIN public.radarzap_mensagens m ON m.id = l.mensagem_id
WHERE cp.radarzap_lead_id = l.id
  AND (cp.dados IS NULL OR NOT (cp.dados ? 'origem_grupo_nome'));
