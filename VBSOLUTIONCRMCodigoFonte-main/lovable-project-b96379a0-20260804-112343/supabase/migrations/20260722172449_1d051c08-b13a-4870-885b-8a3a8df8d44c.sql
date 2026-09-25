
-- 1) Tabela de configuração
CREATE TABLE IF NOT EXISTS public.radarzap_scoring_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL UNIQUE,
  peso_operacao int NOT NULL DEFAULT 30 CHECK (peso_operacao BETWEEN 0 AND 100),
  peso_contato_bom int NOT NULL DEFAULT 25 CHECK (peso_contato_bom BETWEEN 0 AND 100),
  peso_contato_parcial int NOT NULL DEFAULT 10 CHECK (peso_contato_parcial BETWEEN 0 AND 100),
  peso_preco int NOT NULL DEFAULT 15 CHECK (peso_preco BETWEEN 0 AND 100),
  peso_bairro int NOT NULL DEFAULT 15 CHECK (peso_bairro BETWEEN 0 AND 100),
  peso_cidade int NOT NULL DEFAULT 7 CHECK (peso_cidade BETWEEN 0 AND 100),
  peso_proprietario int NOT NULL DEFAULT 10 CHECK (peso_proprietario BETWEEN 0 AND 100),
  peso_tipo int NOT NULL DEFAULT 5 CHECK (peso_tipo BETWEEN 0 AND 100),
  min_score_principal int NOT NULL DEFAULT 40 CHECK (min_score_principal BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radarzap_scoring_config TO authenticated;
GRANT ALL ON public.radarzap_scoring_config TO service_role;

ALTER TABLE public.radarzap_scoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rz_scoring_own_select" ON public.radarzap_scoring_config
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));

CREATE POLICY "rz_scoring_own_insert" ON public.radarzap_scoring_config
  FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));

CREATE POLICY "rz_scoring_own_update" ON public.radarzap_scoring_config
  FOR UPDATE TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));

CREATE POLICY "rz_scoring_own_delete" ON public.radarzap_scoring_config
  FOR DELETE TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.is_master(auth.uid()));

CREATE TRIGGER tg_rz_scoring_updated_at
  BEFORE UPDATE ON public.radarzap_scoring_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Atualiza função de cálculo de score usando pesos configuráveis
CREATE OR REPLACE FUNCTION public.tg_radarzap_leads_dedup_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contato_norm text;
  v_key text;
  v_score int := 0;
  v_det jsonb := '{}'::jsonb;
  v_group uuid;
  v_op text := lower(coalesce(NEW.operacao, ''));
  v_cfg public.radarzap_scoring_config%ROWTYPE;
  v_p_op int; v_p_cb int; v_p_cp int; v_p_pr int;
  v_p_ba int; v_p_ci int; v_p_pn int; v_p_ti int;
BEGIN
  SELECT * INTO v_cfg FROM public.radarzap_scoring_config
   WHERE imobiliaria_id = NEW.imobiliaria_id;

  v_p_op := coalesce(v_cfg.peso_operacao, 30);
  v_p_cb := coalesce(v_cfg.peso_contato_bom, 25);
  v_p_cp := coalesce(v_cfg.peso_contato_parcial, 10);
  v_p_pr := coalesce(v_cfg.peso_preco, 15);
  v_p_ba := coalesce(v_cfg.peso_bairro, 15);
  v_p_ci := coalesce(v_cfg.peso_cidade, 7);
  v_p_pn := coalesce(v_cfg.peso_proprietario, 10);
  v_p_ti := coalesce(v_cfg.peso_tipo, 5);

  v_contato_norm := regexp_replace(coalesce(NEW.contato, ''), '[^0-9]', '', 'g');

  IF length(v_contato_norm) >= 8 THEN
    v_key := 'c:' || right(v_contato_norm, 11) || '|' ||
             coalesce(public.rz_norm(NEW.tipo_imovel), '') || '|' ||
             coalesce(public.rz_norm(NEW.operacao), '');
  ELSE
    v_key := 'k:' ||
             coalesce(public.rz_norm(NEW.tipo_imovel), '') || '|' ||
             coalesce(public.rz_norm(NEW.bairro), '') || '|' ||
             coalesce(public.rz_norm(NEW.cidade), '') || '|' ||
             coalesce(public.rz_norm(NEW.operacao), '') || '|' ||
             coalesce((NEW.preco::bigint)::text, '');
  END IF;
  NEW.dedup_key := v_key;

  IF v_op IN ('venda','aluguel','temporada') THEN
    v_score := v_score + v_p_op; v_det := v_det || jsonb_build_object('operacao', v_p_op);
  END IF;
  IF length(v_contato_norm) >= 10 THEN
    v_score := v_score + v_p_cb; v_det := v_det || jsonb_build_object('contato', v_p_cb);
  ELSIF length(v_contato_norm) BETWEEN 8 AND 9 THEN
    v_score := v_score + v_p_cp; v_det := v_det || jsonb_build_object('contato', v_p_cp);
  END IF;
  IF NEW.preco IS NOT NULL AND NEW.preco > 0 THEN
    v_score := v_score + v_p_pr; v_det := v_det || jsonb_build_object('preco', v_p_pr);
  END IF;
  IF nullif(trim(NEW.bairro), '') IS NOT NULL THEN
    v_score := v_score + v_p_ba; v_det := v_det || jsonb_build_object('bairro', v_p_ba);
  ELSIF nullif(trim(NEW.cidade), '') IS NOT NULL THEN
    v_score := v_score + v_p_ci; v_det := v_det || jsonb_build_object('cidade', v_p_ci);
  END IF;
  IF nullif(trim(NEW.proprietario_nome), '') IS NOT NULL THEN
    v_score := v_score + v_p_pn; v_det := v_det || jsonb_build_object('proprietario', v_p_pn);
  END IF;
  IF nullif(trim(NEW.tipo_imovel), '') IS NOT NULL THEN
    v_score := v_score + v_p_ti; v_det := v_det || jsonb_build_object('tipo', v_p_ti);
  END IF;

  NEW.score := LEAST(v_score, 100);
  NEW.score_detalhes := v_det;

  SELECT dedup_group_id INTO v_group
    FROM public.radarzap_leads
   WHERE imobiliaria_id = NEW.imobiliaria_id
     AND dedup_key = v_key
     AND (TG_OP = 'INSERT' OR id <> NEW.id)
   ORDER BY score DESC NULLS LAST, created_at ASC
   LIMIT 1;

  NEW.dedup_group_id := coalesce(v_group, NEW.dedup_group_id, gen_random_uuid());
  RETURN NEW;
END;
$function$;

-- 3) Atualiza threshold do pipeline
CREATE OR REPLACE FUNCTION public.rz_min_score_principal(_imob uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT min_score_principal FROM public.radarzap_scoring_config WHERE imobiliaria_id = _imob),
    40
  );
$$;

-- Substitui somente a linha do threshold hardcoded na função existente
DO $$
DECLARE
  v_def text;
BEGIN
  v_def := pg_get_functiondef('public.tg_radarzap_to_pipeline'::regproc);
  v_def := replace(
    v_def,
    'IF NEW.score < 40 THEN RETURN NEW; END IF;',
    'IF NEW.score < public.rz_min_score_principal(NEW.imobiliaria_id) THEN RETURN NEW; END IF;'
  );
  EXECUTE v_def;
END $$;
