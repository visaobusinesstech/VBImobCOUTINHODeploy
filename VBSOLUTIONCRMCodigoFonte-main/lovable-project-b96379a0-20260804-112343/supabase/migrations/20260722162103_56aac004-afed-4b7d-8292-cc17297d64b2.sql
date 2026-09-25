
ALTER TABLE public.captacao_pipeline
  ADD COLUMN IF NOT EXISTS radarzap_lead_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cp_radarzap_lead
  ON public.captacao_pipeline(radarzap_lead_id)
  WHERE radarzap_lead_id IS NOT NULL;

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
  -- Só processa se tiver operação válida e ainda não foi convertido
  v_op := lower(coalesce(NEW.operacao, ''));
  IF v_op NOT IN ('venda','aluguel','temporada') THEN
    RETURN NEW;
  END IF;
  IF NEW.lead_id IS NOT NULL THEN
    RETURN NEW; -- já convertido
  END IF;
  IF coalesce(NEW.status,'') = 'descartado' THEN
    RETURN NEW;
  END IF;

  -- Se já existe card para este lead, não recria
  IF EXISTS (SELECT 1 FROM public.captacao_pipeline WHERE radarzap_lead_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Atribui corretor SOMENTE quando a imobiliária tem exatamente 1 corretor ativo
  SELECT id INTO v_corretor
  FROM public.corretores
  WHERE imobiliaria_id = NEW.imobiliaria_id AND status = 'ativo'
  LIMIT 2;

  IF (SELECT count(*) FROM public.corretores
      WHERE imobiliaria_id = NEW.imobiliaria_id AND status = 'ativo') <> 1 THEN
    v_corretor := NULL;
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
      'resumo', NEW.resumo
    )
  )
  RETURNING id INTO v_new_id;

  UPDATE public.radarzap_leads
     SET lead_id = v_new_id, status = 'convertido', updated_at = now()
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_radarzap_to_pipeline_ins ON public.radarzap_leads;
CREATE TRIGGER trg_radarzap_to_pipeline_ins
AFTER INSERT ON public.radarzap_leads
FOR EACH ROW EXECUTE FUNCTION public.tg_radarzap_to_pipeline();

DROP TRIGGER IF EXISTS trg_radarzap_to_pipeline_upd ON public.radarzap_leads;
CREATE TRIGGER trg_radarzap_to_pipeline_upd
AFTER UPDATE OF status, operacao ON public.radarzap_leads
FOR EACH ROW
WHEN (NEW.lead_id IS NULL AND coalesce(NEW.status,'') <> 'descartado')
EXECUTE FUNCTION public.tg_radarzap_to_pipeline();

-- Backfill: cria cards para leads já existentes que atendem aos critérios
INSERT INTO public.captacao_pipeline (
  imobiliaria_id, nome, telefone, imovel_cidade, imovel_bairro,
  imovel_tipo, operacao, valor_estimado, origem, estagio, radarzap_lead_id, dados
)
SELECT
  rl.imobiliaria_id,
  coalesce(nullif(trim(rl.proprietario_nome), ''),
           'Proprietário via RadarZAP' || CASE WHEN rl.bairro IS NOT NULL THEN ' — ' || rl.bairro ELSE '' END),
  rl.contato, rl.cidade, rl.bairro, rl.tipo_imovel,
  initcap(lower(rl.operacao)), rl.preco, 'RadarZAP', 'Prospectado', rl.id,
  jsonb_build_object('radarzap_lead_id', rl.id, 'radarzap_grupo_id', rl.grupo_id, 'resumo', rl.resumo)
FROM public.radarzap_leads rl
WHERE lower(coalesce(rl.operacao,'')) IN ('venda','aluguel','temporada')
  AND rl.lead_id IS NULL
  AND coalesce(rl.status,'') <> 'descartado'
  AND NOT EXISTS (SELECT 1 FROM public.captacao_pipeline cp WHERE cp.radarzap_lead_id = rl.id);

UPDATE public.radarzap_leads rl
   SET lead_id = cp.id,
       status = 'convertido',
       updated_at = now()
  FROM public.captacao_pipeline cp
 WHERE cp.radarzap_lead_id = rl.id
   AND rl.lead_id IS NULL;
