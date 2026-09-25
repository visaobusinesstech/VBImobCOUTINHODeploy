-- 1) Novas colunas em proprietarios
ALTER TABLE public.proprietarios
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS data_casamento date,
  ADD COLUMN IF NOT EXISTS data_compra_imovel date,
  ADD COLUMN IF NOT EXISTS conjuge_data_nascimento date;

-- 2) Tabela de familiares
CREATE TABLE IF NOT EXISTS public.proprietario_familiares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid NOT NULL REFERENCES public.proprietarios(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  nome text NOT NULL,
  data_nascimento date,
  relacao text NOT NULL DEFAULT 'filho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proprietario_familiares TO authenticated;
GRANT ALL ON public.proprietario_familiares TO service_role;

ALTER TABLE public.proprietario_familiares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "familiares_select" ON public.proprietario_familiares FOR SELECT TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));
CREATE POLICY "familiares_insert" ON public.proprietario_familiares FOR INSERT TO authenticated
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));
CREATE POLICY "familiares_update" ON public.proprietario_familiares FOR UPDATE TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()))
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));
CREATE POLICY "familiares_delete" ON public.proprietario_familiares FOR DELETE TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_familiares_proprietario ON public.proprietario_familiares(proprietario_id);
CREATE INDEX IF NOT EXISTS idx_familiares_imobiliaria ON public.proprietario_familiares(imobiliaria_id);

CREATE TRIGGER trg_familiares_updated_at BEFORE UPDATE ON public.proprietario_familiares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Config: ativar lembretes e escolher antecedências (dias antes; 0 = no dia)
ALTER TABLE public.imobiliaria_config
  ADD COLUMN IF NOT EXISTS lembretes_datas_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lembretes_datas_antecedencias integer[] NOT NULL DEFAULT ARRAY[7,1,0];

-- 4) Log de lembretes disparados (deduplicação anual)
CREATE TABLE IF NOT EXISTS public.proprietario_lembretes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid NOT NULL REFERENCES public.proprietarios(id) ON DELETE CASCADE,
  familiar_id uuid REFERENCES public.proprietario_familiares(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  tipo text NOT NULL,
  data_referencia date NOT NULL,
  antecedencia_dias integer NOT NULL,
  ano_ocorrencia integer NOT NULL,
  notification_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.proprietario_lembretes_log TO authenticated;
GRANT ALL ON public.proprietario_lembretes_log TO service_role;

ALTER TABLE public.proprietario_lembretes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lembretes_log_select" ON public.proprietario_lembretes_log FOR SELECT TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id) AND public.is_approved(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS uq_lembretes_log_ciclo
  ON public.proprietario_lembretes_log(
    proprietario_id,
    COALESCE(familiar_id, '00000000-0000-0000-0000-000000000000'::uuid),
    tipo,
    ano_ocorrencia,
    antecedencia_dias
  );

CREATE INDEX IF NOT EXISTS idx_lembretes_log_imob ON public.proprietario_lembretes_log(imobiliaria_id, sent_at DESC);

-- 5) Função de processamento diário
CREATE OR REPLACE FUNCTION public.process_proprietario_lembretes_datas()
RETURNS TABLE(imobiliaria_id uuid, lembretes_criados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  cfg RECORD;
  antec integer;
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_criados integer;
  v_total integer := 0;
  v_cron_id uuid;
  r RECORD;
  target_date date;
  diff_days integer;
  years_completed integer;
  notif_id uuid;
  titulo text;
  descricao text;
  ordinal_txt text;
BEGIN
  v_cron_id := public.cron_log_start('process_proprietario_lembretes_datas', 'pg_cron');
  BEGIN
    FOR cfg IN
      SELECT user_id, COALESCE(lembretes_datas_antecedencias, ARRAY[7,1,0]) AS janelas
      FROM public.imobiliaria_config
      WHERE lembretes_datas_ativo = true
    LOOP
      v_criados := 0;

      -- Coleta todas as datas relevantes (proprietário + cônjuge + casamento + compra imóvel + familiares)
      FOR r IN
        SELECT p.id AS proprietario_id, NULL::uuid AS familiar_id, p.nome AS pessoa_nome,
               'aniversario_proprietario' AS tipo, p.data_nascimento AS d
          FROM public.proprietarios p
         WHERE p.imobiliaria_id = cfg.user_id AND p.data_nascimento IS NOT NULL
        UNION ALL
        SELECT p.id, NULL::uuid, COALESCE(p.conjuge_nome, 'Cônjuge de ' || p.nome),
               'aniversario_conjuge', p.conjuge_data_nascimento
          FROM public.proprietarios p
         WHERE p.imobiliaria_id = cfg.user_id AND p.conjuge_data_nascimento IS NOT NULL
        UNION ALL
        SELECT p.id, NULL::uuid, p.nome,
               'aniversario_casamento', p.data_casamento
          FROM public.proprietarios p
         WHERE p.imobiliaria_id = cfg.user_id AND p.data_casamento IS NOT NULL
        UNION ALL
        SELECT p.id, NULL::uuid, p.nome,
               'aniversario_compra_imovel', p.data_compra_imovel
          FROM public.proprietarios p
         WHERE p.imobiliaria_id = cfg.user_id AND p.data_compra_imovel IS NOT NULL
        UNION ALL
        SELECT f.proprietario_id, f.id, f.nome,
               'aniversario_familiar_' || COALESCE(NULLIF(lower(f.relacao),''), 'familiar'),
               f.data_nascimento
          FROM public.proprietario_familiares f
         WHERE f.imobiliaria_id = cfg.user_id AND f.data_nascimento IS NOT NULL
      LOOP
        -- Próxima ocorrência anual (mesmo dia/mês) >= hoje
        BEGIN
          target_date := make_date(EXTRACT(YEAR FROM today)::int,
                                   EXTRACT(MONTH FROM r.d)::int,
                                   EXTRACT(DAY FROM r.d)::int);
        EXCEPTION WHEN OTHERS THEN
          -- 29/fev em ano não bissexto → usa 28/fev
          target_date := make_date(EXTRACT(YEAR FROM today)::int,
                                   EXTRACT(MONTH FROM r.d)::int, 28);
        END;
        IF target_date < today THEN
          BEGIN
            target_date := make_date(EXTRACT(YEAR FROM today)::int + 1,
                                     EXTRACT(MONTH FROM r.d)::int,
                                     EXTRACT(DAY FROM r.d)::int);
          EXCEPTION WHEN OTHERS THEN
            target_date := make_date(EXTRACT(YEAR FROM today)::int + 1,
                                     EXTRACT(MONTH FROM r.d)::int, 28);
          END;
        END IF;

        diff_days := target_date - today;
        years_completed := EXTRACT(YEAR FROM target_date)::int - EXTRACT(YEAR FROM r.d)::int;

        FOREACH antec IN ARRAY cfg.janelas LOOP
          IF diff_days = antec THEN
            -- Rótulos
            CASE r.tipo
              WHEN 'aniversario_proprietario' THEN
                titulo := '🎂 Aniversário do proprietário';
                descricao := r.pessoa_nome || ' faz ' || years_completed || ' anos em '
                          || to_char(target_date, 'DD/MM')
                          || CASE WHEN antec = 0 THEN ' (hoje)'
                                  WHEN antec = 1 THEN ' (amanhã)'
                                  ELSE ' (em ' || antec || ' dias)' END;
              WHEN 'aniversario_conjuge' THEN
                titulo := '🎂 Aniversário do cônjuge';
                descricao := r.pessoa_nome || ' faz ' || years_completed || ' anos em '
                          || to_char(target_date, 'DD/MM')
                          || CASE WHEN antec = 0 THEN ' (hoje)' WHEN antec = 1 THEN ' (amanhã)'
                                  ELSE ' (em ' || antec || ' dias)' END;
              WHEN 'aniversario_casamento' THEN
                titulo := '💍 Aniversário de casamento';
                descricao := r.pessoa_nome || ' comemora ' || years_completed || ' anos de casamento em '
                          || to_char(target_date, 'DD/MM')
                          || CASE WHEN antec = 0 THEN ' (hoje)' WHEN antec = 1 THEN ' (amanhã)'
                                  ELSE ' (em ' || antec || ' dias)' END;
              WHEN 'aniversario_compra_imovel' THEN
                ordinal_txt := years_completed || 'º';
                titulo := '🏠 Aniversário da compra do imóvel';
                descricao := r.pessoa_nome || ' — ' || ordinal_txt || ' ano do imóvel em '
                          || to_char(target_date, 'DD/MM')
                          || CASE WHEN antec = 0 THEN ' (hoje)' WHEN antec = 1 THEN ' (amanhã)'
                                  ELSE ' (em ' || antec || ' dias)' END;
              ELSE
                titulo := '🎉 Aniversário de familiar';
                descricao := r.pessoa_nome || ' faz ' || years_completed || ' anos em '
                          || to_char(target_date, 'DD/MM')
                          || CASE WHEN antec = 0 THEN ' (hoje)' WHEN antec = 1 THEN ' (amanhã)'
                                  ELSE ' (em ' || antec || ' dias)' END;
            END CASE;

            BEGIN
              INSERT INTO public.notifications (user_id, title, description)
              VALUES (cfg.user_id, titulo, descricao)
              RETURNING id INTO notif_id;

              INSERT INTO public.proprietario_lembretes_log (
                proprietario_id, familiar_id, imobiliaria_id, tipo,
                data_referencia, antecedencia_dias, ano_ocorrencia, notification_id
              ) VALUES (
                r.proprietario_id, r.familiar_id, cfg.user_id, r.tipo,
                target_date, antec, EXTRACT(YEAR FROM target_date)::int, notif_id
              );
              v_criados := v_criados + 1;
            EXCEPTION WHEN unique_violation THEN
              -- Já disparado neste ciclo; ignora silenciosamente
              NULL;
            END;
          END IF;
        END LOOP;
      END LOOP;

      imobiliaria_id := cfg.user_id;
      lembretes_criados := v_criados;
      v_total := v_total + v_criados;
      RETURN NEXT;
    END LOOP;

    PERFORM public.cron_log_finish(
      v_cron_id, 'sucesso',
      'Lembretes criados: ' || v_total,
      jsonb_build_object('total_lembretes', v_total, 'data_referencia', today)
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.cron_log_finish(v_cron_id, 'falha', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
    RAISE;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.process_proprietario_lembretes_datas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_proprietario_lembretes_datas() TO service_role;
