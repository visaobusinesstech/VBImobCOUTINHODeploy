
CREATE OR REPLACE FUNCTION public.radarzap_criar_lead_crm_on_aprovar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_nome text;
  v_telefone text;
  v_tipo_op text;
  v_interesse text;
  v_valor numeric;
BEGIN
  -- Só age em transição para 'aprovado' e quando ainda não há lead vinculado
  IF NEW.status IS DISTINCT FROM 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF NEW.lead_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_nome := coalesce(nullif(btrim(NEW.proprietario_nome), ''), 'Lead RadarZAP');
  v_telefone := nullif(regexp_replace(coalesce(NEW.contato, ''), '\D', '', 'g'), '');

  v_tipo_op := CASE lower(coalesce(NEW.operacao, ''))
    WHEN 'venda' THEN 'venda'
    WHEN 'aluguel' THEN 'aluguel'
    WHEN 'temporada' THEN 'aluguel'
    ELSE 'venda'
  END;

  v_valor := coalesce(NEW.preco, 0);

  v_interesse := btrim(
    concat_ws(' · ',
      nullif(NEW.tipo_imovel, ''),
      nullif(NEW.bairro, ''),
      nullif(NEW.cidade, ''),
      nullif(NEW.resumo, '')
    )
  );

  INSERT INTO public.leads (
    imobiliaria_id, nome, telefone, interesse, valor,
    estagio, tipo_operacao, canal_origem,
    bairro_interesse, tipo_imovel_interesse,
    observacoes, created_by
  ) VALUES (
    NEW.imobiliaria_id,
    v_nome,
    v_telefone,
    nullif(v_interesse, ''),
    v_valor,
    'novos',
    v_tipo_op,
    'RadarZAP',
    nullif(NEW.bairro, ''),
    nullif(NEW.tipo_imovel, ''),
    concat_ws(E'\n',
      'Origem: RadarZAP (grupo público WhatsApp)',
      'Score: ' || coalesce(NEW.score::text, '0'),
      CASE WHEN NEW.mensagem_id IS NOT NULL THEN 'Mensagem: ' || NEW.mensagem_id::text ELSE NULL END,
      CASE WHEN NEW.revisao_notas IS NOT NULL THEN 'Notas: ' || NEW.revisao_notas ELSE NULL END
    ),
    NEW.aprovado_por
  ) RETURNING id INTO v_lead_id;

  -- Vincula CRM lead ao radarzap_lead
  NEW.lead_id := v_lead_id;

  -- Atividade no CRM (histórico do lead)
  INSERT INTO public.lead_atividades (
    lead_id, imobiliaria_id, tipo, titulo, descricao
  ) VALUES (
    v_lead_id,
    NEW.imobiliaria_id,
    'sistema',
    'Lead criado automaticamente via RadarZAP',
    concat_ws(E'\n',
      'Aprovado em: ' || to_char(coalesce(NEW.aprovado_em, now()), 'DD/MM/YYYY HH24:MI'),
      'Score final: ' || coalesce(NEW.score::text, '0'),
      'Detalhes do score: ' || coalesce(NEW.score_detalhes::text, '{}'),
      'Operação: ' || coalesce(NEW.operacao, '—'),
      'Tipo: ' || coalesce(NEW.tipo_imovel, '—'),
      'Local: ' || coalesce(nullif(concat_ws(' / ', NEW.bairro, NEW.cidade), ''), '—'),
      'Preço: ' || coalesce(NEW.preco::text, '—'),
      'Contato: ' || coalesce(NEW.contato, '—')
    )
  );

  -- Auditoria do RadarZAP
  INSERT INTO public.radarzap_leads_auditoria (
    lead_id, imobiliaria_id, acao, actor_user_id,
    status_anterior, status_novo, campos_alterados, revisao_notas
  ) VALUES (
    NEW.id,
    NEW.imobiliaria_id,
    'crm_lead_criado',
    NEW.aprovado_por,
    OLD.status,
    NEW.status,
    jsonb_build_object(
      'crm_lead_id', v_lead_id,
      'nome', v_nome,
      'contato', v_telefone,
      'canal_origem', 'RadarZAP',
      'score', NEW.score,
      'score_detalhes', NEW.score_detalhes,
      'operacao', v_tipo_op,
      'preco', NEW.preco,
      'bairro', NEW.bairro,
      'cidade', NEW.cidade,
      'tipo_imovel', NEW.tipo_imovel,
      'mensagem_id', NEW.mensagem_id
    ),
    NEW.revisao_notas
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_radarzap_criar_lead_crm ON public.radarzap_leads;
CREATE TRIGGER trg_radarzap_criar_lead_crm
BEFORE UPDATE OF status ON public.radarzap_leads
FOR EACH ROW
EXECUTE FUNCTION public.radarzap_criar_lead_crm_on_aprovar();
