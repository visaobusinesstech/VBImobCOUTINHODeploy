
-- 1) Colunas novas em lista_proprietarios_captacao
ALTER TABLE public.lista_proprietarios_captacao
  ADD COLUMN IF NOT EXISTS primeiro_visto_em timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ultimo_visto_em timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ultimo_preco numeric,
  ADD COLUMN IF NOT EXISTS historico_precos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS republicacoes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivacao_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivacao_sinais jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS motivacao_nivel text NOT NULL DEFAULT 'frio',
  ADD COLUMN IF NOT EXISTS motivacao_calculada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_lpc_motivacao_score
  ON public.lista_proprietarios_captacao (imobiliaria_id, motivacao_score DESC);
CREATE INDEX IF NOT EXISTS idx_lpc_primeiro_visto
  ON public.lista_proprietarios_captacao (imobiliaria_id, primeiro_visto_em);

-- 2) Função que calcula o score
CREATE OR REPLACE FUNCTION public.calcular_motivacao_proprietario(
  _primeiro_visto timestamptz,
  _ultimo_preco numeric,
  _historico_precos jsonb,
  _republicacoes integer,
  _origem text
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
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
BEGIN
  -- Tempo no mercado
  dias_no_mercado := GREATEST(0, EXTRACT(day FROM (now() - COALESCE(_primeiro_visto, now())))::int);
  IF dias_no_mercado >= 180 THEN bonus_tempo := 40;
  ELSIF dias_no_mercado >= 90 THEN bonus_tempo := 25;
  ELSIF dias_no_mercado >= 60 THEN bonus_tempo := 10;
  END IF;

  -- Redução de preço vs primeiro registro histórico
  IF jsonb_array_length(COALESCE(_historico_precos, '[]'::jsonb)) > 0 AND _ultimo_preco IS NOT NULL THEN
    preco_inicial := NULLIF((_historico_precos->0->>'preco'), '')::numeric;
    IF preco_inicial IS NOT NULL AND preco_inicial > 0 AND _ultimo_preco < preco_inicial THEN
      queda_pct := ROUND(((preco_inicial - _ultimo_preco) / preco_inicial) * 100, 2);
      IF queda_pct >= 10 THEN bonus_queda := 35;
      ELSIF queda_pct >= 5 THEN bonus_queda := 25;
      END IF;
    END IF;
  END IF;

  -- Republicações
  bonus_repub := LEAST(COALESCE(_republicacoes, 0), 2) * 20;

  -- FSBO (origem contém "proprietario"/"direto"/"ia_")
  IF _origem IS NOT NULL AND (_origem ILIKE '%proprietario%' OR _origem ILIKE '%direto%' OR _origem ILIKE 'ia_%') THEN
    bonus_fsbo := 10;
  END IF;

  score := LEAST(100, bonus_tempo + bonus_queda + bonus_repub + bonus_fsbo);

  IF score >= 75 THEN nivel := 'fervendo';
  ELSIF score >= 50 THEN nivel := 'quente';
  ELSIF score >= 25 THEN nivel := 'morno';
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

-- 3) Trigger BEFORE INSERT/UPDATE que rastreia histórico e recalcula score
CREATE OR REPLACE FUNCTION public.trg_lpc_motivacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  resultado jsonb;
  preco_atual numeric;
  hist jsonb;
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
    -- Se o preço mudou, registra no histórico
    IF preco_atual IS NOT NULL AND preco_atual IS DISTINCT FROM OLD.ultimo_preco THEN
      hist := COALESCE(OLD.historico_precos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('preco', preco_atual, 'em', now()));
      NEW.historico_precos := hist;
      NEW.ultimo_preco := preco_atual;
    ELSE
      NEW.historico_precos := COALESCE(OLD.historico_precos, '[]'::jsonb);
      NEW.ultimo_preco := COALESCE(OLD.ultimo_preco, preco_atual);
    END IF;
  END IF;

  resultado := public.calcular_motivacao_proprietario(
    NEW.primeiro_visto_em,
    NEW.ultimo_preco,
    NEW.historico_precos,
    NEW.republicacoes,
    NEW.origem
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

-- 4) RPC de recálculo em lote (para dados antigos)
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
BEGIN
  IF _imobiliaria_id IS NULL THEN
    _imobiliaria_id := auth.uid();
  END IF;
  IF _imobiliaria_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

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
      r.origem
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
GRANT EXECUTE ON FUNCTION public.calcular_motivacao_proprietario(timestamptz, numeric, jsonb, integer, text) TO authenticated;
