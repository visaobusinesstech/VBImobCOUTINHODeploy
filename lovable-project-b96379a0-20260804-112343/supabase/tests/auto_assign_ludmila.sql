-- Testes de validação do trigger auto_assign_lead_ludmila
-- Executa 4 cenários em savepoints e faz ROLLBACK ao final para não sujar dados.
-- Uso:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/auto_assign_ludmila.sql
--
-- Cenários:
--   1. Lead "novos" criado hoje  -> deve receber corretor_id da Ludmila
--   2. Lead "novos" com created_at de ontem (BRT) -> NÃO deve ser reatribuído
--   3. Lead em outro estágio ("qualificados") criado hoje -> NÃO deve ser reatribuído
--   4. Lead "novos" hoje já com outro corretor -> DEVE ser sobrescrito para Ludmila

BEGIN;

DO $test$
DECLARE
  v_imob uuid := '0f78835c-9aa7-411d-97d3-33d499953a1f';
  v_ludmila uuid := '039dd5fa-4135-427b-a3c8-d178c086901e';
  v_outro uuid;
  v_id uuid;
  v_result uuid;
  v_ontem_br timestamptz := ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  -- Pegar um corretor qualquer da mesma imobiliária que não seja a Ludmila
  SELECT id INTO v_outro
  FROM public.corretores
  WHERE imobiliaria_id = v_imob AND id <> v_ludmila AND status = 'ativo'
  LIMIT 1;

  -- ============ CENÁRIO 1: novos + hoje ============
  INSERT INTO public.leads (imobiliaria_id, nome, estagio, canal_origem)
  VALUES (v_imob, '__TEST_1_novos_hoje__', 'novos', 'teste')
  RETURNING id, corretor_id INTO v_id, v_result;
  IF v_result IS DISTINCT FROM v_ludmila THEN
    RAISE EXCEPTION 'FALHA cenário 1: esperava corretor=% mas veio %', v_ludmila, v_result;
  END IF;
  RAISE NOTICE 'OK cenário 1: lead novos+hoje atribuído à Ludmila';

  -- ============ CENÁRIO 2: novos + ontem (BRT) ============
  INSERT INTO public.leads (imobiliaria_id, nome, estagio, canal_origem, created_at)
  VALUES (v_imob, '__TEST_2_novos_ontem__', 'novos', 'teste', v_ontem_br)
  RETURNING id, corretor_id INTO v_id, v_result;
  IF v_result IS NOT NULL THEN
    RAISE EXCEPTION 'FALHA cenário 2: lead de ontem NÃO deveria ter corretor, veio %', v_result;
  END IF;
  RAISE NOTICE 'OK cenário 2: lead novos+ontem NÃO foi reatribuído';

  -- ============ CENÁRIO 3: estágio diferente + hoje ============
  INSERT INTO public.leads (imobiliaria_id, nome, estagio, canal_origem)
  VALUES (v_imob, '__TEST_3_qualificados_hoje__', 'qualificados', 'teste')
  RETURNING id, corretor_id INTO v_id, v_result;
  IF v_result IS NOT NULL THEN
    RAISE EXCEPTION 'FALHA cenário 3: lead em "qualificados" não deveria receber Ludmila, veio %', v_result;
  END IF;
  RAISE NOTICE 'OK cenário 3: estágio "qualificados" NÃO foi reatribuído';

  -- ============ CENÁRIO 4: novos + hoje + já com corretor ============
  IF v_outro IS NOT NULL THEN
    INSERT INTO public.leads (imobiliaria_id, nome, estagio, canal_origem, corretor_id)
    VALUES (v_imob, '__TEST_4_novos_hoje_com_corretor__', 'novos', 'teste', v_outro)
    RETURNING id, corretor_id INTO v_id, v_result;
    IF v_result IS DISTINCT FROM v_ludmila THEN
      RAISE EXCEPTION 'FALHA cenário 4: esperava corretor=Ludmila (%), veio %', v_ludmila, v_result;
    END IF;
    RAISE NOTICE 'OK cenário 4: corretor anterior foi sobrescrito para Ludmila';
  ELSE
    RAISE NOTICE 'SKIP cenário 4: nenhum outro corretor disponível para teste';
  END IF;

  RAISE NOTICE '✅ Todos os cenários passaram';
END
$test$;

ROLLBACK;
