
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.radarzap_leads
  ADD COLUMN IF NOT EXISTS dedup_key text,
  ADD COLUMN IF NOT EXISTS dedup_group_id uuid,
  ADD COLUMN IF NOT EXISTS is_principal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_detalhes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_radarzap_leads_dedup
  ON public.radarzap_leads (imobiliaria_id, dedup_key);
CREATE INDEX IF NOT EXISTS idx_radarzap_leads_group
  ON public.radarzap_leads (dedup_group_id);
CREATE INDEX IF NOT EXISTS idx_radarzap_leads_score
  ON public.radarzap_leads (imobiliaria_id, score DESC);

CREATE OR REPLACE FUNCTION public.rz_norm(_s text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT regexp_replace(
           lower(coalesce(public.unaccent(_s), _s, '')),
           '[^a-z0-9]+', ' ', 'g'
         )
$$;

CREATE OR REPLACE FUNCTION public.tg_radarzap_leads_dedup_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contato_norm text;
  v_key text;
  v_score int := 0;
  v_det jsonb := '{}'::jsonb;
  v_group uuid;
  v_op text := lower(coalesce(NEW.operacao, ''));
BEGIN
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
    v_score := v_score + 30; v_det := v_det || jsonb_build_object('operacao', 30);
  END IF;
  IF length(v_contato_norm) >= 10 THEN
    v_score := v_score + 25; v_det := v_det || jsonb_build_object('contato', 25);
  ELSIF length(v_contato_norm) BETWEEN 8 AND 9 THEN
    v_score := v_score + 10; v_det := v_det || jsonb_build_object('contato', 10);
  END IF;
  IF NEW.preco IS NOT NULL AND NEW.preco > 0 THEN
    v_score := v_score + 15; v_det := v_det || jsonb_build_object('preco', 15);
  END IF;
  IF nullif(trim(NEW.bairro), '') IS NOT NULL THEN
    v_score := v_score + 15; v_det := v_det || jsonb_build_object('bairro', 15);
  ELSIF nullif(trim(NEW.cidade), '') IS NOT NULL THEN
    v_score := v_score + 7; v_det := v_det || jsonb_build_object('cidade', 7);
  END IF;
  IF nullif(trim(NEW.proprietario_nome), '') IS NOT NULL THEN
    v_score := v_score + 10; v_det := v_det || jsonb_build_object('proprietario', 10);
  END IF;
  IF nullif(trim(NEW.tipo_imovel), '') IS NOT NULL THEN
    v_score := v_score + 5; v_det := v_det || jsonb_build_object('tipo', 5);
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
$$;

DROP TRIGGER IF EXISTS trg_radarzap_leads_dedup_score ON public.radarzap_leads;
CREATE TRIGGER trg_radarzap_leads_dedup_score
BEFORE INSERT OR UPDATE OF contato, tipo_imovel, operacao, bairro, cidade, preco, proprietario_nome
ON public.radarzap_leads
FOR EACH ROW EXECUTE FUNCTION public.tg_radarzap_leads_dedup_score();

CREATE OR REPLACE FUNCTION public.tg_radarzap_leads_reeleger_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top uuid;
BEGIN
  IF NEW.dedup_group_id IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_top FROM public.radarzap_leads
   WHERE dedup_group_id = NEW.dedup_group_id
   ORDER BY score DESC NULLS LAST, created_at ASC LIMIT 1;
  UPDATE public.radarzap_leads
     SET is_principal = (id = v_top)
   WHERE dedup_group_id = NEW.dedup_group_id
     AND is_principal <> (id = v_top);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_radarzap_reeleger_principal ON public.radarzap_leads;
CREATE TRIGGER trg_radarzap_reeleger_principal
AFTER INSERT OR UPDATE OF score, dedup_group_id ON public.radarzap_leads
FOR EACH ROW EXECUTE FUNCTION public.tg_radarzap_leads_reeleger_principal();

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
BEGIN
  v_op := lower(coalesce(NEW.operacao, ''));
  IF v_op NOT IN ('venda','aluguel','temporada') THEN RETURN NEW; END IF;
  IF NEW.lead_id IS NOT NULL THEN RETURN NEW; END IF;
  IF coalesce(NEW.status,'') = 'descartado' THEN RETURN NEW; END IF;
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
      'resumo', NEW.resumo,
      'score', NEW.score,
      'score_detalhes', NEW.score_detalhes,
      'dedup_group_id', NEW.dedup_group_id
    )
  )
  RETURNING id INTO v_new_id;

  UPDATE public.radarzap_leads
     SET lead_id = v_new_id, status = 'convertido', updated_at = now()
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

UPDATE public.radarzap_leads SET updated_at = now();
