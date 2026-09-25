
ALTER TABLE public.radarzap_leads
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisao_notas text,
  ALTER COLUMN status SET DEFAULT 'pendente_aprovacao';

-- Só cria pipeline se aprovado (ou legado 'novo'/'contato')
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
  v_status text := lower(coalesce(NEW.status, ''));
BEGIN
  v_op := lower(coalesce(NEW.operacao, ''));
  IF v_op NOT IN ('venda','aluguel','temporada') THEN RETURN NEW; END IF;
  IF NEW.lead_id IS NOT NULL THEN RETURN NEW; END IF;
  IF v_status NOT IN ('aprovado','novo','contato') THEN RETURN NEW; END IF;
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
      'dedup_group_id', NEW.dedup_group_id,
      'aprovado_por', NEW.aprovado_por,
      'aprovado_em', NEW.aprovado_em
    )
  )
  RETURNING id INTO v_new_id;

  UPDATE public.radarzap_leads
     SET lead_id = v_new_id, status = 'convertido', updated_at = now()
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger AFTER UPDATE também precisa disparar quando status mudar para aprovado
DROP TRIGGER IF EXISTS trg_radarzap_to_pipeline_upd ON public.radarzap_leads;
CREATE TRIGGER trg_radarzap_to_pipeline_upd
AFTER UPDATE OF status ON public.radarzap_leads
FOR EACH ROW
WHEN (lower(coalesce(NEW.status,'')) = 'aprovado' AND NEW.lead_id IS NULL)
EXECUTE FUNCTION public.tg_radarzap_to_pipeline();
