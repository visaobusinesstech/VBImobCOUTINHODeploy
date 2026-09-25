
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
  v_tel_suf text;
  v_tipo_op text;
  v_interesse text;
  v_valor numeric;
  v_existing_id uuid;
  v_err text;
  v_err_detail text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF NEW.lead_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_nome := coalesce(nullif(btrim(NEW.proprietario_nome), ''), 'Lead RadarZAP');
    v_telefone := nullif(regexp_replace(coalesce(NEW.contato, ''), '\D', '', 'g'), '');

    IF v_telefone IS NOT NULL AND length(v_telefone) >= 8 THEN
      v_tel_suf := right(v_telefone, 8);
      SELECT l.id INTO v_existing_id
        FROM public.leads l
       WHERE l.imobiliaria_id = NEW.imobiliaria_id
         AND l.telefone IS NOT NULL
         AND length(regexp_replace(l.telefone, '\D', '', 'g')) >= 8
         AND right(regexp_replace(l.telefone, '\D', '', 'g'), 8) = v_tel_suf
       ORDER BY l.created_at DESC
       LIMIT 1;
    END IF;

    v_tipo_op := CASE lower(coalesce(NEW.operacao, ''))
      WHEN 'venda' THEN 'venda'
      WHEN 'aluguel' THEN 'aluguel'
      WHEN 'temporada' THEN 'aluguel'
      ELSE 'venda'
    END;
    v_valor := coalesce(NEW.preco, 0);
    v_interesse := btrim(concat_ws(' · ',
      nullif(NEW.tipo_imovel, ''), nullif(NEW.bairro, ''),
      nullif(NEW.cidade, ''), nullif(NEW.resumo, '')));

    IF v_existing_id IS NOT NULL THEN
      v_lead_id := v_existing_id;
      NEW.lead_id := v_lead_id;

      INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
      VALUES (v_lead_id, NEW.imobiliaria_id, 'sistema',
        'Nova aprovação RadarZAP vinculada a este lead (dedup por telefone)',
        concat_ws(E'\n',
          'Telefone (normalizado): ' || coalesce(v_telefone, '—'),
          'Aprovado em: ' || to_char(coalesce(NEW.aprovado_em, now()), 'DD/MM/YYYY HH24:MI'),
          'Score: ' || coalesce(NEW.score::text, '0')
        ));

      INSERT INTO public.radarzap_leads_auditoria (
        lead_id, imobiliaria_id, acao, actor_user_id,
        status_anterior, status_novo, campos_alterados, revisao_notas
      ) VALUES (
        NEW.id, NEW.imobiliaria_id, 'crm_lead_dedup_vinculado', NEW.aprovado_por,
        OLD.status, NEW.status,
        jsonb_build_object('crm_lead_id', v_lead_id, 'motivo', 'telefone_match_suffix8', 'telefone', v_telefone),
        NEW.revisao_notas
      );
      RETURN NEW;
    END IF;

    INSERT INTO public.leads (
      imobiliaria_id, nome, telefone, interesse, valor,
      estagio, tipo_operacao, canal_origem,
      bairro_interesse, tipo_imovel_interesse, observacoes, created_by
    ) VALUES (
      NEW.imobiliaria_id, v_nome, v_telefone, nullif(v_interesse, ''), v_valor,
      'novos', v_tipo_op, 'RadarZAP',
      nullif(NEW.bairro, ''), nullif(NEW.tipo_imovel, ''),
      concat_ws(E'\n',
        'Origem: RadarZAP (grupo público WhatsApp)',
        'Score: ' || coalesce(NEW.score::text, '0'),
        CASE WHEN NEW.mensagem_id IS NOT NULL THEN 'Mensagem: ' || NEW.mensagem_id::text ELSE NULL END,
        CASE WHEN NEW.revisao_notas IS NOT NULL THEN 'Notas: ' || NEW.revisao_notas ELSE NULL END
      ),
      NEW.aprovado_por
    ) RETURNING id INTO v_lead_id;

    NEW.lead_id := v_lead_id;

    INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
    VALUES (v_lead_id, NEW.imobiliaria_id, 'sistema',
      'Lead criado automaticamente via RadarZAP',
      concat_ws(E'\n',
        'Aprovado em: ' || to_char(coalesce(NEW.aprovado_em, now()), 'DD/MM/YYYY HH24:MI'),
        'Score final: ' || coalesce(NEW.score::text, '0'),
        'Operação: ' || coalesce(NEW.operacao, '—'),
        'Local: ' || coalesce(nullif(concat_ws(' / ', NEW.bairro, NEW.cidade), ''), '—'),
        'Preço: ' || coalesce(NEW.preco::text, '—'),
        'Contato: ' || coalesce(NEW.contato, '—')
      ));

    INSERT INTO public.radarzap_leads_auditoria (
      lead_id, imobiliaria_id, acao, actor_user_id,
      status_anterior, status_novo, campos_alterados, revisao_notas
    ) VALUES (
      NEW.id, NEW.imobiliaria_id, 'crm_lead_criado', NEW.aprovado_por,
      OLD.status, NEW.status,
      jsonb_build_object(
        'crm_lead_id', v_lead_id, 'nome', v_nome, 'contato', v_telefone,
        'canal_origem', 'RadarZAP', 'score', NEW.score,
        'operacao', v_tipo_op, 'preco', NEW.preco,
        'bairro', NEW.bairro, 'cidade', NEW.cidade, 'tipo_imovel', NEW.tipo_imovel
      ),
      NEW.revisao_notas
    );

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    v_err_detail := SQLSTATE;
    BEGIN
      INSERT INTO public.radarzap_leads_auditoria (
        lead_id, imobiliaria_id, acao, actor_user_id,
        status_anterior, status_novo, campos_alterados, revisao_notas
      ) VALUES (
        NEW.id, NEW.imobiliaria_id, 'crm_lead_falha', NEW.aprovado_por,
        OLD.status, NEW.status,
        jsonb_build_object(
          'error_message', v_err,
          'sqlstate', v_err_detail,
          'contato', NEW.contato,
          'proprietario_nome', NEW.proprietario_nome
        ),
        NEW.revisao_notas
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RETURN NEW;
  END;
END;
$$;
