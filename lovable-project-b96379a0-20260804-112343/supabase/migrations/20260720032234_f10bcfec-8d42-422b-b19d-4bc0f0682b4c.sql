
-- 1. Add limite_leads to corretores
ALTER TABLE public.corretores
  ADD COLUMN IF NOT EXISTS limite_leads integer NOT NULL DEFAULT 20;

-- 2. Fila de distribuição
CREATE TABLE IF NOT EXISTS public.lead_distribution_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'ia',
  source_ref uuid,
  ai_score numeric NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | assigned | closed | skipped
  corretor_id uuid REFERENCES public.corretores(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, source, source_ref)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_distribution_queue TO authenticated;
GRANT ALL ON public.lead_distribution_queue TO service_role;

ALTER TABLE public.lead_distribution_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_dq_select" ON public.lead_distribution_queue FOR SELECT TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "lead_dq_insert" ON public.lead_distribution_queue FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "lead_dq_update" ON public.lead_distribution_queue FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "lead_dq_delete" ON public.lead_distribution_queue FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ldq_priority
  ON public.lead_distribution_queue (imobiliaria_id, status, ai_score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ldq_corretor
  ON public.lead_distribution_queue (corretor_id, status);

CREATE OR REPLACE FUNCTION public.tg_ldq_touch_updated() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_ldq_touch ON public.lead_distribution_queue;
CREATE TRIGGER trg_ldq_touch BEFORE UPDATE ON public.lead_distribution_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_ldq_touch_updated();

-- 3. Round-robin cursor por imobiliária
CREATE TABLE IF NOT EXISTS public.lead_distribution_cursor (
  imobiliaria_id uuid PRIMARY KEY,
  last_corretor_id uuid,
  last_assigned_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.lead_distribution_cursor TO authenticated;
GRANT ALL ON public.lead_distribution_cursor TO service_role;

ALTER TABLE public.lead_distribution_cursor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ldc_select" ON public.lead_distribution_cursor FOR SELECT TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "ldc_upsert" ON public.lead_distribution_cursor FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "ldc_update" ON public.lead_distribution_cursor FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- 4. Enqueue helper (idempotente via UNIQUE)
CREATE OR REPLACE FUNCTION public.enqueue_lead_ia(
  _imobiliaria_id uuid,
  _source text,
  _source_ref uuid,
  _ai_score numeric,
  _payload jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.lead_distribution_queue (imobiliaria_id, source, source_ref, ai_score, payload)
  VALUES (_imobiliaria_id, COALESCE(_source,'ia'), _source_ref, COALESCE(_ai_score,0), COALESCE(_payload,'{}'::jsonb))
  ON CONFLICT (imobiliaria_id, source, source_ref)
    DO UPDATE SET ai_score = GREATEST(lead_distribution_queue.ai_score, EXCLUDED.ai_score),
                  payload  = lead_distribution_queue.payload || EXCLUDED.payload,
                  updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.enqueue_lead_ia(uuid,text,uuid,numeric,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.enqueue_lead_ia(uuid,text,uuid,numeric,jsonb) TO authenticated, service_role;

-- 5. Distribuidor principal — round-robin entre corretores elegíveis
CREATE OR REPLACE FUNCTION public.distribuir_fila_leads(
  _imobiliaria_id uuid,
  _max_iteracoes integer DEFAULT 200
) RETURNS TABLE (
  atribuidos integer,
  restantes  integer,
  sem_corretor_elegivel boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lead RECORD;
  _cursor uuid;
  _next   uuid;
  _atrib  integer := 0;
  _iter   integer := 0;
  _no_elig boolean := false;
  _rest    integer;
BEGIN
  IF _imobiliaria_id IS NULL THEN RAISE EXCEPTION 'imobiliaria_id obrigatório'; END IF;

  SELECT last_corretor_id INTO _cursor
    FROM public.lead_distribution_cursor WHERE imobiliaria_id = _imobiliaria_id;

  LOOP
    _iter := _iter + 1;
    EXIT WHEN _iter > _max_iteracoes;

    -- Próximo lead com maior score / mais antigo
    SELECT * INTO _lead
      FROM public.lead_distribution_queue
     WHERE imobiliaria_id = _imobiliaria_id
       AND status = 'pending'
     ORDER BY ai_score DESC, created_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN EXIT; END IF;

    -- Corretores elegíveis: ativos, com capacidade
    WITH elig AS (
      SELECT c.id, c.nome,
             (SELECT COUNT(*) FROM public.lead_distribution_queue q
                WHERE q.corretor_id = c.id AND q.status = 'assigned') AS ativos
        FROM public.corretores c
       WHERE c.imobiliaria_id = _imobiliaria_id
         AND c.status = 'ativo'
    )
    SELECT id INTO _next
      FROM elig
     WHERE ativos < (SELECT limite_leads FROM public.corretores WHERE id = elig.id)
       AND (
         _cursor IS NULL
         OR id > _cursor
       )
     ORDER BY id ASC
     LIMIT 1;

    -- Volta ao início da lista (round-robin wrap)
    IF _next IS NULL THEN
      WITH elig AS (
        SELECT c.id,
               (SELECT COUNT(*) FROM public.lead_distribution_queue q
                  WHERE q.corretor_id = c.id AND q.status = 'assigned') AS ativos
          FROM public.corretores c
         WHERE c.imobiliaria_id = _imobiliaria_id
           AND c.status = 'ativo'
      )
      SELECT id INTO _next
        FROM elig
       WHERE ativos < (SELECT limite_leads FROM public.corretores WHERE id = elig.id)
       ORDER BY id ASC
       LIMIT 1;
    END IF;

    IF _next IS NULL THEN
      _no_elig := true;
      EXIT; -- ninguém tem capacidade
    END IF;

    UPDATE public.lead_distribution_queue
       SET status = 'assigned',
           corretor_id = _next,
           assigned_at = now()
     WHERE id = _lead.id;

    _cursor := _next;
    _atrib := _atrib + 1;
  END LOOP;

  -- Persistir cursor
  INSERT INTO public.lead_distribution_cursor (imobiliaria_id, last_corretor_id, last_assigned_at, updated_at)
  VALUES (_imobiliaria_id, _cursor, now(), now())
  ON CONFLICT (imobiliaria_id) DO UPDATE
    SET last_corretor_id = EXCLUDED.last_corretor_id,
        last_assigned_at = EXCLUDED.last_assigned_at,
        updated_at = now();

  SELECT COUNT(*) INTO _rest FROM public.lead_distribution_queue
    WHERE imobiliaria_id = _imobiliaria_id AND status = 'pending';

  RETURN QUERY SELECT _atrib, _rest::integer, _no_elig;
END $$;

REVOKE ALL ON FUNCTION public.distribuir_fila_leads(uuid,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.distribuir_fila_leads(uuid,integer) TO authenticated, service_role;

-- 6. Métricas por corretor
CREATE OR REPLACE FUNCTION public.leads_ativos_por_corretor(_imobiliaria_id uuid)
RETURNS TABLE (
  corretor_id uuid,
  nome text,
  status text,
  limite integer,
  ativos integer,
  capacidade_livre integer
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.nome, c.status, c.limite_leads,
         COALESCE(q.ativos,0)::integer AS ativos,
         GREATEST(0, c.limite_leads - COALESCE(q.ativos,0))::integer
    FROM public.corretores c
    LEFT JOIN (
      SELECT corretor_id, COUNT(*)::integer AS ativos
        FROM public.lead_distribution_queue
       WHERE status = 'assigned' AND imobiliaria_id = _imobiliaria_id
       GROUP BY corretor_id
    ) q ON q.corretor_id = c.id
   WHERE c.imobiliaria_id = _imobiliaria_id
   ORDER BY c.nome ASC;
$$;

REVOKE ALL ON FUNCTION public.leads_ativos_por_corretor(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.leads_ativos_por_corretor(uuid) TO authenticated, service_role;

-- 7. Auto-enqueue quando IA marca um proprietário como quente (score >= 50)
CREATE OR REPLACE FUNCTION public.tg_enqueue_proprietario_quente() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.motivacao_score IS NOT NULL AND NEW.motivacao_score >= 50
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.motivacao_score,-1) < 50) THEN
    PERFORM public.enqueue_lead_ia(
      NEW.imobiliaria_id,
      'proprietario_quente',
      NEW.id,
      NEW.motivacao_score::numeric,
      jsonb_build_object(
        'nome', NEW.nome_proprietario,
        'telefone', NEW.telefone,
        'bairro', NEW.bairro,
        'cidade', NEW.cidade,
        'operacao', NEW.operacao,
        'nivel', NEW.motivacao_nivel
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enqueue_prop_quente ON public.lista_proprietarios_captacao;
CREATE TRIGGER trg_enqueue_prop_quente
  AFTER INSERT OR UPDATE OF motivacao_score
  ON public.lista_proprietarios_captacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_proprietario_quente();
