
DROP FUNCTION IF EXISTS public.simulate_data_retention_policies(integer, integer);

CREATE OR REPLACE FUNCTION public.list_retention_exceptions()
RETURNS TABLE(nome text, entidade text, criterio text, justificativa text, acao text, exemplo jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public' STABLE
AS $$
  SELECT * FROM (VALUES
    ('Proprietário com Contrato Ativo','lista_proprietarios_captacao / proprietarios',
     'EXISTS contrato com status IN (''ativo'',''em_andamento'',''vigente'') vinculado ao mesmo telefone ou nome do proprietário',
     'Obrigação contratual vigente (locação/venda). Necessário para repasses, cobrança e auditoria fiscal.',
     'Não excluir enquanto o contrato estiver ativo. Reavaliar após término.',
     jsonb_build_object('nome_proprietario','João da Silva','telefone','+55 61 99999-0000','contrato','LOC-042','status_contrato','ativo')),
    ('Proprietário com Lead em Negociação','lista_proprietarios_captacao',
     'EXISTS lead com estagio NOT IN (''fechado'',''perdido'',''descartado'',''inativo'') com mesmo telefone',
     'Captação em andamento — valor comercial contínuo.',
     'Não excluir enquanto houver lead ativo vinculado.',
     jsonb_build_object('nome_proprietario','Maria Souza','telefone','+55 61 98888-1111','lead_estagio','proposta')),
    ('Proprietário com Proposta Aberta','proprietarios / propostas',
     'EXISTS proposta com status IN (''em_negociacao'',''enviada'',''aceita_condicional'')',
     'Obrigação comercial/legal enquanto proposta estiver em análise.',
     'Não excluir enquanto houver proposta em aberto.',
     jsonb_build_object('proprietario','Carlos Almeida','proposta','PROP-2026-018','status','em_negociacao')),
    ('Proprietário com Imóvel Publicado','proprietarios / imoveis',
     'EXISTS imóvel vinculado com status IN (''ativo'',''publicado'',''destaque'')',
     'Imóvel público em portais/site exige rastreabilidade LGPD e responsabilidade civil.',
     'Não excluir enquanto o imóvel estiver publicado.',
     jsonb_build_object('proprietario','Ana Ribeiro','imovel','IMV-3120','status','ativo')),
    ('Transação Financeira dentro do Prazo Legal','transacoes',
     'created_at >= now() - interval ''5 years'' OR status = ''pendente''',
     'Legislação fiscal (Receita Federal) exige guarda mínima de 5 anos.',
     'Manter por, no mínimo, 5 anos a partir da criação.',
     jsonb_build_object('descricao','Aluguel LOC-042','valor',3500,'data','2024-11-01','status','pago')),
    ('Contrato Vigente ou Recente','contratos',
     'status IN (''ativo'',''em_andamento'') OR data_fim >= CURRENT_DATE - interval ''5 years''',
     'Obrigação contratual e prazo prescricional civil/tributário.',
     'Nunca excluir contratos ativos; guardar por 5 anos após término.',
     jsonb_build_object('codigo','LOC-042','status','ativo','data_fim','2027-05-30')),
    ('Lead com Compromisso Futuro','leads / compromissos',
     'EXISTS compromisso do lead com data >= CURRENT_DATE e status <> ''cancelado''',
     'Agenda comercial ativa — exclusão causaria perda de atendimento.',
     'Não excluir enquanto houver compromisso futuro.',
     jsonb_build_object('lead','Paulo Mendes','compromisso','Visita','data','2026-12-05')),
    ('Cache Firecrawl Recentemente Utilizado','firecrawl_captacao_cache',
     'hits > 0 AND updated_at >= now() - interval ''3 days''',
     'Cache com uso recente reduz custo de API e latência.',
     'Não excluir cache com hits nos últimos 3 dias. Reavaliar quando ficar frio.',
     jsonb_build_object('cache_key','venda:df:asa-sul','hits',12,'updated_at','2026-07-17T10:20:00Z')),
    ('Registro sob Legal Hold / Auditoria','qualquer entidade com campo metadata',
     'metadata->>''legal_hold'' = ''true''',
     'Retenção judicial ou auditoria em curso (obrigação legal).',
     'Manter indefinidamente até a flag ser removida por autorização formal.',
     jsonb_build_object('legal_hold', true, 'motivo', 'processo 0001234-56.2026.8.07.0001')),
    ('Solicitação LGPD em Aberto','leads / clientes_relacionamento',
     'metadata->>''lgpd_request_status'' IN (''aberta'',''em_analise'')',
     'Direitos do titular (LGPD Art. 18) exigem preservação até resposta final.',
     'Manter até conclusão formal da solicitação.',
     jsonb_build_object('titular','Fernanda Lima','tipo','portabilidade','status','em_analise')),
    ('Métricas de Webhook Ligadas a Alerta Aberto','webhook_metrics / webhook_metrics_daily',
     'EXISTS webhook_alerts com resolved_at IS NULL para o mesmo tenant/período',
     'Investigação de segurança em andamento — evidência não pode ser removida.',
     'Não excluir enquanto houver alerta relacionado não resolvido.',
     jsonb_build_object('imobiliaria_id','...','alert_id','...','resolved_at', null))
  ) AS t(nome, entidade, criterio, justificativa, acao, exemplo);
$$;

REVOKE ALL ON FUNCTION public.list_retention_exceptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_retention_exceptions() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_lista_proprietario_retention_exception(_row_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lista_proprietarios_captacao lp
    WHERE lp.id = _row_id AND (
      EXISTS (
        SELECT 1 FROM public.contratos c
        WHERE c.imobiliaria_id = lp.imobiliaria_id
          AND LOWER(COALESCE(c.status,'')) IN ('ativo','em_andamento','vigente')
          AND (
            (lp.telefone IS NOT NULL AND c.proprietario_telefone = lp.telefone)
            OR (lp.nome_proprietario IS NOT NULL
                AND LOWER(TRIM(c.proprietario)) = LOWER(TRIM(lp.nome_proprietario)))
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.imobiliaria_id = lp.imobiliaria_id
          AND LOWER(COALESCE(l.estagio,'')) NOT IN ('fechado','perdido','descartado','inativo')
          AND lp.telefone IS NOT NULL AND l.telefone = lp.telefone
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_lista_proprietario_retention_exception(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_lista_proprietario_retention_exception(uuid) TO service_role;

CREATE FUNCTION public.simulate_data_retention_policies(
  _webhook_raw_retention_days integer DEFAULT 90,
  _webhook_daily_retention_days integer DEFAULT 730
)
RETURNS TABLE(
  politica text, entidade text, tenant_id uuid, criterio text,
  quantidade integer, protegidos integer, exemplos jsonb, simulated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  cfg RECORD; v_now timestamptz := now();
  v_count integer; v_protegidos integer; v_examples jsonb; v_fc_days integer;
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;

  FOR cfg IN SELECT user_id, retention_lista_proprietarios_dias AS lp_days FROM public.imobiliaria_config LOOP
    WITH candidatos AS (
      SELECT id, public.is_lista_proprietario_retention_exception(id) AS protegido
      FROM public.lista_proprietarios_captacao
      WHERE imobiliaria_id = cfg.user_id
        AND created_at < v_now - make_interval(days => cfg.lp_days)
    )
    SELECT count(*) FILTER (WHERE NOT protegido)::integer,
           count(*) FILTER (WHERE protegido)::integer
    INTO v_count, v_protegidos FROM candidatos;

    IF v_count > 0 THEN
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_examples FROM (
        SELECT id, created_at, nome_proprietario
          FROM public.lista_proprietarios_captacao
         WHERE imobiliaria_id = cfg.user_id
           AND created_at < v_now - make_interval(days => cfg.lp_days)
           AND NOT public.is_lista_proprietario_retention_exception(id)
         ORDER BY created_at ASC LIMIT 5
      ) x;
    ELSE
      v_examples := '[]'::jsonb;
    END IF;

    politica := 'Retenção de Lista de Proprietários';
    entidade := 'lista_proprietarios_captacao';
    tenant_id := cfg.user_id;
    criterio := 'created_at < now() - ' || cfg.lp_days || ' dias (respeitando exceções)';
    quantidade := v_count; protegidos := v_protegidos;
    exemplos := v_examples; simulated_at := v_now;
    RETURN NEXT;
  END LOOP;

  v_fc_days := COALESCE((SELECT MIN(retention_firecrawl_cache_dias) FROM public.imobiliaria_config), 7);

  WITH candidatos AS (
    SELECT id, (hits > 0 AND updated_at >= v_now - interval '3 days') AS protegido
    FROM public.firecrawl_captacao_cache
    WHERE created_at < v_now - make_interval(days => v_fc_days)
  )
  SELECT count(*) FILTER (WHERE NOT protegido)::integer,
         count(*) FILTER (WHERE protegido)::integer
  INTO v_count, v_protegidos FROM candidatos;

  IF v_count > 0 THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_examples FROM (
      SELECT id, created_at, cache_key, hits
        FROM public.firecrawl_captacao_cache
       WHERE created_at < v_now - make_interval(days => v_fc_days)
         AND NOT (hits > 0 AND updated_at >= v_now - interval '3 days')
       ORDER BY created_at ASC LIMIT 5
    ) x;
  ELSE
    v_examples := '[]'::jsonb;
  END IF;

  politica := 'Retenção de Cache Firecrawl';
  entidade := 'firecrawl_captacao_cache'; tenant_id := NULL;
  criterio := 'created_at < now() - ' || v_fc_days || ' dias; protegidos: hits > 0 nos últimos 3 dias';
  quantidade := v_count; protegidos := v_protegidos;
  exemplos := v_examples; simulated_at := v_now;
  RETURN NEXT;

  SELECT count(*)::integer INTO v_count FROM public.webhook_metrics
   WHERE created_at < v_now - make_interval(days => _webhook_raw_retention_days);
  politica := 'Retenção de Métricas de Webhook (raw)';
  entidade := 'webhook_metrics'; tenant_id := NULL;
  criterio := 'created_at < now() - ' || _webhook_raw_retention_days || ' dias';
  quantidade := v_count; protegidos := 0; exemplos := '[]'::jsonb; simulated_at := v_now;
  RETURN NEXT;

  SELECT count(*)::integer INTO v_count FROM public.webhook_metrics_daily
   WHERE bucket_date < (v_now - make_interval(days => _webhook_daily_retention_days))::date;
  politica := 'Retenção de Métricas de Webhook (daily)';
  entidade := 'webhook_metrics_daily'; tenant_id := NULL;
  criterio := 'bucket_date < today - ' || _webhook_daily_retention_days || ' dias';
  quantidade := v_count; protegidos := 0; exemplos := '[]'::jsonb; simulated_at := v_now;
  RETURN NEXT;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_data_retention_policies()
RETURNS TABLE(tenant_id uuid, firecrawl_deleted integer, proprietarios_deleted integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE
  cfg RECORD; v_fc_del integer; v_lp_del integer;
  v_lp_protegidos integer; v_fc_protegidos integer;
  v_total_fc integer := 0; v_total_lp integer := 0; v_total_protegidos integer := 0;
  v_tenants integer := 0; v_cron_id uuid; v_fc_days integer;
BEGIN
  v_cron_id := public.cron_log_start('apply_data_retention_policies', 'pg_cron');
  BEGIN
    FOR cfg IN SELECT user_id, retention_lista_proprietarios_dias AS lp_days FROM public.imobiliaria_config LOOP
      SELECT count(*)::integer INTO v_lp_protegidos
        FROM public.lista_proprietarios_captacao lp
       WHERE lp.imobiliaria_id = cfg.user_id
         AND lp.created_at < now() - make_interval(days => cfg.lp_days)
         AND public.is_lista_proprietario_retention_exception(lp.id);

      WITH del AS (
        DELETE FROM public.lista_proprietarios_captacao lp
         WHERE lp.imobiliaria_id = cfg.user_id
           AND lp.created_at < now() - make_interval(days => cfg.lp_days)
           AND NOT public.is_lista_proprietario_retention_exception(lp.id)
         RETURNING 1
      ) SELECT count(*) INTO v_lp_del FROM del;

      IF v_lp_del > 0 THEN
        INSERT INTO public.retention_deletion_log (
          entidade, quantidade, politica, criterio, mecanismo, tenant_id, cron_execucao_id, metadata
        ) VALUES (
          'lista_proprietarios_captacao', v_lp_del,
          'Retenção de Lista de Proprietários',
          'mais antigos que ' || cfg.lp_days || ' dias (respeitando exceções)',
          'Sistema de Retenção Automática', cfg.user_id, v_cron_id,
          jsonb_build_object('retention_days', cfg.lp_days, 'protegidos_por_excecao', v_lp_protegidos));
      END IF;

      v_total_lp := v_total_lp + v_lp_del;
      v_total_protegidos := v_total_protegidos + v_lp_protegidos;
      v_tenants := v_tenants + 1;

      tenant_id := cfg.user_id; firecrawl_deleted := 0; proprietarios_deleted := v_lp_del;
      RETURN NEXT;
    END LOOP;

    v_fc_days := COALESCE((SELECT MIN(retention_firecrawl_cache_dias) FROM public.imobiliaria_config), 7);

    SELECT count(*)::integer INTO v_fc_protegidos
      FROM public.firecrawl_captacao_cache
     WHERE created_at < now() - make_interval(days => v_fc_days)
       AND hits > 0 AND updated_at >= now() - interval '3 days';

    WITH del_fc AS (
      DELETE FROM public.firecrawl_captacao_cache
       WHERE created_at < now() - make_interval(days => v_fc_days)
         AND NOT (hits > 0 AND updated_at >= now() - interval '3 days')
       RETURNING 1
    ) SELECT count(*) INTO v_fc_del FROM del_fc;
    v_total_fc := v_fc_del;
    v_total_protegidos := v_total_protegidos + v_fc_protegidos;

    IF v_fc_del > 0 THEN
      INSERT INTO public.retention_deletion_log (
        entidade, quantidade, politica, criterio, mecanismo, cron_execucao_id, metadata
      ) VALUES (
        'firecrawl_captacao_cache', v_fc_del,
        'Retenção de Cache Firecrawl',
        'mais antigos que ' || v_fc_days || ' dias; protegidos hits recentes',
        'Sistema de Retenção Automática', v_cron_id,
        jsonb_build_object('retention_days', v_fc_days, 'protegidos_por_excecao', v_fc_protegidos));
    END IF;

    INSERT INTO public.system_logs (level, module, action, message, metadata)
    VALUES ('info','DataRetention','apply_policies',
      'Rotina de retenção de dados executada (com exceções)',
      jsonb_build_object(
        'tenants_processed', v_tenants,
        'firecrawl_deleted_total', v_total_fc,
        'lista_proprietarios_deleted_total', v_total_lp,
        'protegidos_por_excecao_total', v_total_protegidos,
        'executed_at', now()));

    PERFORM public.cron_log_finish(
      v_cron_id, 'sucesso',
      'Tenants: ' || v_tenants || ' · Firecrawl: ' || v_total_fc
        || ' · Proprietários: ' || v_total_lp
        || ' · Protegidos por exceção: ' || v_total_protegidos,
      jsonb_build_object(
        'tenants_processed', v_tenants,
        'firecrawl_deleted_total', v_total_fc,
        'lista_proprietarios_deleted_total', v_total_lp,
        'protegidos_por_excecao_total', v_total_protegidos));
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.cron_log_finish(v_cron_id, 'falha', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
    RAISE;
  END;
END;
$function$;
