
ALTER TABLE public.radarzap_scoring_config
  ADD COLUMN IF NOT EXISTS alerta_score_alto integer NOT NULL DEFAULT 70
    CHECK (alerta_score_alto >= 0 AND alerta_score_alto <= 100);

ALTER TABLE public.radarzap_leads
  ADD COLUMN IF NOT EXISTS alerta_score_alto_em timestamptz;

CREATE OR REPLACE FUNCTION public.tg_radarzap_alerta_score_alto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_threshold int;
  v_grupo record;
  v_corretor uuid;
  v_titulo text;
  v_desc text;
  v_local text;
  v_preco text;
BEGIN
  IF NEW.is_principal IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.alerta_score_alto_em IS NOT NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(alerta_score_alto, 70) INTO v_threshold
    FROM public.radarzap_scoring_config
   WHERE imobiliaria_id = NEW.imobiliaria_id;
  v_threshold := COALESCE(v_threshold, 70);
  IF v_threshold <= 0 THEN RETURN NEW; END IF;
  IF NEW.score < v_threshold THEN RETURN NEW; END IF;

  SELECT nome, cidade, uf, bairro
    INTO v_grupo FROM public.radarzap_grupos WHERE id = NEW.grupo_id;

  v_local := COALESCE(NULLIF(NEW.bairro,''), v_grupo.bairro, NEW.cidade, v_grupo.cidade, '—');
  IF v_grupo.uf IS NOT NULL THEN v_local := v_local || '/' || v_grupo.uf; END IF;
  v_preco := CASE
    WHEN NEW.preco IS NOT NULL AND NEW.preco > 0
      THEN 'R$ ' || to_char(NEW.preco, 'FM999G999G999D00')
    ELSE 'sem preço'
  END;

  v_titulo := format('RadarZAP: lead quente (score %s) — %s %s',
    NEW.score,
    COALESCE(NULLIF(NEW.operacao,''), 'oportunidade'),
    COALESCE(NULLIF(NEW.tipo_imovel,''), 'imóvel'));

  v_desc := format('%s em %s · %s · contato: %s%s%s',
    COALESCE(NULLIF(NEW.proprietario_nome,''), 'Proprietário s/ nome'),
    v_local,
    v_preco,
    COALESCE(NULLIF(NEW.contato,''), '—'),
    CASE WHEN v_grupo.nome IS NOT NULL THEN ' · via grupo "' || v_grupo.nome || '"' ELSE '' END,
    CASE WHEN NEW.resumo IS NOT NULL AND length(NEW.resumo) > 0
         THEN ' · ' || left(NEW.resumo, 180) ELSE '' END);

  INSERT INTO public.notifications (user_id, title, description)
  VALUES (NEW.imobiliaria_id, v_titulo, v_desc);

  SELECT corretor_id INTO v_corretor
    FROM public.captacao_pipeline
   WHERE radarzap_lead_id = NEW.id
   ORDER BY created_at DESC LIMIT 1;

  IF v_corretor IS NOT NULL AND v_corretor <> NEW.imobiliaria_id THEN
    INSERT INTO public.notifications (user_id, title, description)
    VALUES (v_corretor, v_titulo, v_desc);
  END IF;

  UPDATE public.radarzap_leads
     SET alerta_score_alto_em = now()
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_trg_radarzap_alerta_score_alto_ins ON public.radarzap_leads;
CREATE TRIGGER zz_trg_radarzap_alerta_score_alto_ins
AFTER INSERT ON public.radarzap_leads
FOR EACH ROW EXECUTE FUNCTION public.tg_radarzap_alerta_score_alto();

DROP TRIGGER IF EXISTS zz_trg_radarzap_alerta_score_alto_upd ON public.radarzap_leads;
CREATE TRIGGER zz_trg_radarzap_alerta_score_alto_upd
AFTER UPDATE OF score, is_principal ON public.radarzap_leads
FOR EACH ROW EXECUTE FUNCTION public.tg_radarzap_alerta_score_alto();
