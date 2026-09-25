
-- 1) Tabela de configuração dos critérios de motivação
CREATE TABLE IF NOT EXISTS public.motivacao_config (
  imobiliaria_id uuid PRIMARY KEY,
  dias_tier1 integer NOT NULL DEFAULT 60,
  dias_tier2 integer NOT NULL DEFAULT 90,
  dias_tier3 integer NOT NULL DEFAULT 180,
  bonus_tempo_tier1 integer NOT NULL DEFAULT 10,
  bonus_tempo_tier2 integer NOT NULL DEFAULT 25,
  bonus_tempo_tier3 integer NOT NULL DEFAULT 40,
  queda_tier1 numeric NOT NULL DEFAULT 5,
  queda_tier2 numeric NOT NULL DEFAULT 10,
  bonus_queda_tier1 integer NOT NULL DEFAULT 25,
  bonus_queda_tier2 integer NOT NULL DEFAULT 35,
  bonus_republicacao integer NOT NULL DEFAULT 20,
  bonus_fsbo integer NOT NULL DEFAULT 10,
  nivel_morno_min integer NOT NULL DEFAULT 25,
  nivel_quente_min integer NOT NULL DEFAULT 50,
  nivel_fervendo_min integer NOT NULL DEFAULT 75,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivacao_config TO authenticated;
GRANT ALL ON public.motivacao_config TO service_role;

ALTER TABLE public.motivacao_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "motivacao_config_owner_select" ON public.motivacao_config;
DROP POLICY IF EXISTS "motivacao_config_owner_insert" ON public.motivacao_config;
DROP POLICY IF EXISTS "motivacao_config_owner_update" ON public.motivacao_config;
DROP POLICY IF EXISTS "motivacao_config_owner_delete" ON public.motivacao_config;

CREATE POLICY "motivacao_config_owner_select" ON public.motivacao_config
  FOR SELECT TO authenticated USING (imobiliaria_id = auth.uid());
CREATE POLICY "motivacao_config_owner_insert" ON public.motivacao_config
  FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "motivacao_config_owner_update" ON public.motivacao_config
  FOR UPDATE TO authenticated USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "motivacao_config_owner_delete" ON public.motivacao_config
  FOR DELETE TO authenticated USING (imobiliaria_id = auth.uid());

CREATE OR REPLACE FUNCTION public.trg_motivacao_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_motivacao_config_updated_at ON public.motivacao_config;
CREATE TRIGGER trg_motivacao_config_updated_at
  BEFORE UPDATE ON public.motivacao_config
  FOR EACH ROW EXECUTE FUNCTION public.trg_motivacao_config_updated_at();

-- 2) Substitui a função de cálculo para aceitar config (jsonb) opcional
DROP FUNCTION IF EXISTS public.calcular_motivacao_proprietario(timestamptz, numeric, jsonb, integer, text) CASCADE;

CREATE OR REPLACE FUNCTION public.calcular_motivacao_proprietario(
  _primeiro_visto timestamptz,
  _ultimo_preco numeric,
  _historico_precos jsonb,
  _republicacoes integer,
  _origem text,
  _config jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cfg jsonb := COALESCE(_config, '{}'::jsonb);
  score integer := 0;
  sinais jsonb := '{}'::jsonb;
  dias_no_mercado integer;
  preco_inicial numeric;
  queda_pct numeric := 0;
  nivel text;
  bonus_tempo integer := 0;
  bonus_queda integer := 0;
  bonus_repub integer := 0;
  bonus_fsbo integer := 0;
  dias_t1 int := COALESCE((cfg->>'dias_tier1')::int, 60);
  dias_t2 int := COALESCE((cfg->>'dias_tier2')::int, 90);
  dias_t3 int := COALESCE((cfg->>'dias_tier3')::int, 180);
  bt1 int := COALESCE((cfg->>'bonus_tempo_tier1')::int, 10);
  bt2 int := COALESCE((cfg->>'bonus_tempo_tier2')::int, 25);
  bt3 int := COALESCE((cfg->>'bonus_tempo_tier3')::int, 40);
  qt1 numeric := COALESCE((cfg->>'queda_tier1')::numeric, 5);
  qt2 numeric := COALESCE((cfg->>'queda_tier2')::numeric, 10);
  bq1 int := COALESCE((cfg->>'bonus_queda_tier1')::int, 25);
  bq2 int := COALESCE((cfg->>'bonus_queda_tier2')::int, 35);
  b_rep int := COALESCE((cfg->>'bonus_republicacao')::int, 20);
  b_fsbo int := COALESCE((cfg->>'bonus_fsbo')::int, 10);
  n_morno int := COALESCE((cfg->>'nivel_morno_min')::int, 25);
  n_quente int := COALESCE((cfg->>'nivel_quente_min')::int, 50);
  n_ferv int := COALESCE((cfg->>'nivel_fervendo_min')::int, 75);
BEGIN
  dias_no_mercado := GREATEST(0, EXTRACT(day FROM (now() - COALESCE(_primeiro_visto, now())))::int);
  IF dias_no_mercado >= dias_t3 THEN bonus_tempo := bt3;
  ELSIF dias_no_mercado >= dias_t2 THEN bonus_tempo := bt2;
  ELSIF dias_no_mercado >= dias_t1 THEN bonus_tempo := bt1;
  END IF;

  IF jsonb_array_length(COALESCE(_historico_precos, '[]'::jsonb)) > 0 AND _ultimo_preco IS NOT NULL THEN
    preco_inicial := NULLIF((_historico_precos->0->>'preco'), '')::numeric;
    IF preco_inicial IS NOT NULL AND preco_inicial > 0 AND _ultimo_preco < preco_inicial THEN
      queda_pct := ROUND(((preco_inicial - _ultimo_preco) / preco_inicial) * 100, 2);
      IF queda_pct >= qt2 THEN bonus_queda := bq2;
      ELSIF queda_pct >= qt1 THEN bonus_queda := bq1;
      END IF;
    END IF;
  END IF;

  bonus_repub := LEAST(COALESCE(_republicacoes, 0), 2) * b_rep;

  IF _origem IS NOT NULL AND (_origem ILIKE '%proprietario%' OR _origem ILIKE '%direto%' OR _origem ILIKE 'ia_%') THEN
    bonus_fsbo := b_fsbo;
  END IF;

  score := LEAST(100, bonus_tempo + bonus_queda + bonus_repub + bonus_fsbo);

  IF score >= n_ferv THEN nivel := 'fervendo';
  ELSIF score >= n_quente THEN nivel := 'quente';
  ELSIF score >= n_morno THEN nivel := 'morno';
  ELSE nivel := 'frio';
  END IF;

  sinais := jsonb_build_object(
    'dias_no_mercado', dias_no_mercado,
    'queda_pct', queda_pct,
    'republicacoes', COALESCE(_republicacoes, 0),
    'fsbo', bonus_fsbo > 0,
    'bonus', jsonb_build_object('tempo', bonus_tempo, 'queda', bonus_queda, 'republicacao', bonus_repub, 'fsbo', bonus_fsbo)
  );

  RETURN jsonb_build_object('score', score, 'nivel', nivel, 'sinais', sinais);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_motivacao_proprietario(timestamptz, numeric, jsonb, integer, text, jsonb) TO authenticated, service_role;

-- 3) Trigger recriada usando config da própria imobiliária da linha
CREATE OR REPLACE FUNCTION public.trg_lpc_motivacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  resultado jsonb;
  preco_atual numeric;
  hist jsonb;
  cfg jsonb;
BEGIN
  preco_atual := NEW.preco;

  IF TG_OP = 'INSERT' THEN
    NEW.primeiro_visto_em := COALESCE(NEW.primeiro_visto_em, now());
    NEW.ultimo_visto_em := now();
    NEW.ultimo_preco := preco_atual;
    IF preco_atual IS NOT NULL THEN
      NEW.historico_precos := jsonb_build_array(jsonb_build_object('preco', preco_atual, 'em', now()));
    END IF;
  ELSE
    NEW.ultimo_visto_em := now();
    IF preco_atual IS NOT NULL AND preco_atual IS DISTINCT FROM OLD.ultimo_preco THEN
      hist := COALESCE(OLD.historico_precos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('preco', preco_atual, 'em', now()));
      NEW.historico_precos := hist;
      NEW.ultimo_preco := preco_atual;
    ELSE
      NEW.historico_precos := COALESCE(OLD.historico_precos, '[]'::jsonb);
      NEW.ultimo_preco := COALESCE(OLD.ultimo_preco, preco_atual);
    END IF;
  END IF;

  SELECT to_jsonb(c) INTO cfg FROM public.motivacao_config c WHERE c.imobiliaria_id = NEW.imobiliaria_id;

  resultado := public.calcular_motivacao_proprietario(
    NEW.primeiro_visto_em,
    NEW.ultimo_preco,
    NEW.historico_precos,
    NEW.republicacoes,
    NEW.origem,
    cfg
  );

  NEW.motivacao_score := (resultado->>'score')::int;
  NEW.motivacao_nivel := resultado->>'nivel';
  NEW.motivacao_sinais := resultado->'sinais';
  NEW.motivacao_calculada_em := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lpc_motivacao ON public.lista_proprietarios_captacao;
CREATE TRIGGER trg_lpc_motivacao
  BEFORE INSERT OR UPDATE ON public.lista_proprietarios_captacao
  FOR EACH ROW EXECUTE FUNCTION public.trg_lpc_motivacao();

-- 4) RPC de recálculo em lote usando a config da imobiliária
CREATE OR REPLACE FUNCTION public.recalcular_motivacao_proprietarios(_imobiliaria_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  atualizados integer := 0;
  r record;
  res jsonb;
  cfg jsonb;
BEGIN
  IF _imobiliaria_id IS NULL THEN
    _imobiliaria_id := auth.uid();
  END IF;
  IF _imobiliaria_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT to_jsonb(c) INTO cfg FROM public.motivacao_config c WHERE c.imobiliaria_id = _imobiliaria_id;

  FOR r IN
    SELECT id, primeiro_visto_em, ultimo_preco, historico_precos, republicacoes, origem, preco
    FROM public.lista_proprietarios_captacao
    WHERE imobiliaria_id = _imobiliaria_id
  LOOP
    res := public.calcular_motivacao_proprietario(
      COALESCE(r.primeiro_visto_em, now()),
      COALESCE(r.ultimo_preco, r.preco),
      COALESCE(r.historico_precos, '[]'::jsonb),
      COALESCE(r.republicacoes, 0),
      r.origem,
      cfg
    );
    UPDATE public.lista_proprietarios_captacao
      SET motivacao_score = (res->>'score')::int,
          motivacao_nivel = res->>'nivel',
          motivacao_sinais = res->'sinais',
          motivacao_calculada_em = now()
      WHERE id = r.id;
    atualizados := atualizados + 1;
  END LOOP;

  RETURN atualizados;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalcular_motivacao_proprietarios(uuid) TO authenticated;
