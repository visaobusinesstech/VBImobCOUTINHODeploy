
-- 1. Table
CREATE TABLE IF NOT EXISTS public.pipeline_estagios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'hsl(210, 70%, 55%)',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_sistema BOOLEAN NOT NULL DEFAULT false,
  sistema_tipo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_estagios_imob_ordem
  ON public.pipeline_estagios (imobiliaria_id, ordem);

-- 2. GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_estagios TO authenticated;
GRANT ALL ON public.pipeline_estagios TO service_role;

-- 3. RLS
ALTER TABLE public.pipeline_estagios ENABLE ROW LEVEL SECURITY;

-- 4. Policies (multi-tenant via imobiliaria_id = auth.uid())
CREATE POLICY "pipeline_estagios_select_own"
  ON public.pipeline_estagios FOR SELECT
  TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE POLICY "pipeline_estagios_insert_own"
  ON public.pipeline_estagios FOR INSERT
  TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "pipeline_estagios_update_own"
  ON public.pipeline_estagios FOR UPDATE
  TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "pipeline_estagios_delete_own"
  ON public.pipeline_estagios FOR DELETE
  TO authenticated
  USING (imobiliaria_id = auth.uid());

-- 5. Guard trigger: protect system stages and stages with leads
CREATE OR REPLACE FUNCTION public.trg_pipeline_estagios_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_sistema THEN
      RAISE EXCEPTION 'Estágio de sistema não pode ser excluído (renomeie ou desative)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.leads
      WHERE imobiliaria_id = OLD.imobiliaria_id AND estagio = OLD.slug
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Estágio possui leads. Mova-os antes de excluir.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Slug is immutable
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'O identificador (slug) do estágio não pode ser alterado';
    END IF;
    -- is_sistema flag is immutable
    IF NEW.is_sistema IS DISTINCT FROM OLD.is_sistema THEN
      RAISE EXCEPTION 'A marcação de estágio de sistema não pode ser alterada';
    END IF;
    NEW.updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_estagios_guard ON public.pipeline_estagios;
CREATE TRIGGER trg_pipeline_estagios_guard
  BEFORE UPDATE OR DELETE ON public.pipeline_estagios
  FOR EACH ROW EXECUTE FUNCTION public.trg_pipeline_estagios_guard();

-- 6. Seed function: populate defaults if empty for the caller
CREATE OR REPLACE FUNCTION public.pipeline_estagios_seed_defaults()
RETURNS SETOF public.pipeline_estagios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pipeline_estagios WHERE imobiliaria_id = uid) THEN
    RETURN QUERY SELECT * FROM public.pipeline_estagios WHERE imobiliaria_id = uid ORDER BY ordem;
    RETURN;
  END IF;

  INSERT INTO public.pipeline_estagios (imobiliaria_id, slug, title, color, ordem, ativo, is_sistema, sistema_tipo)
  VALUES
    (uid, 'novos',         'Novos Leads',        'hsl(199, 89%, 48%)',  0,  true, false, NULL),
    (uid, 'qualificados',  'Qualificados',       'hsl(38, 92%, 50%)',   1,  true, false, NULL),
    (uid, 'visita',        'Visita Agendada',    'hsl(262, 83%, 58%)',  2,  true, false, NULL),
    (uid, 'proposta',      'Proposta',           'hsl(142, 71%, 45%)',  3,  true, false, NULL),
    (uid, 'mandar_opcoes', 'Mandar Opções',      'hsl(210, 70%, 55%)',  4,  true, false, NULL),
    (uid, 'pediu_tempo',   'Pediu Tempo',        'hsl(25, 95%, 53%)',   5,  true, false, NULL),
    (uid, 'quer_alugar',   'Quer Alugar',        'hsl(180, 70%, 45%)',  6,  true, false, NULL),
    (uid, 'nao_responde',  'Não Responde',       'hsl(0, 0%, 55%)',     7,  true, false, NULL),
    (uid, 'fechado',       'Fechado',            'hsl(45, 93%, 47%)',   8,  true, true,  'fechado'),
    (uid, 'comprou_outra', 'Comprou c/ Outra',   'hsl(15, 80%, 50%)',   9,  true, false, NULL),
    (uid, 'desistiu',      'Desistiu',           'hsl(0, 60%, 45%)',    10, true, false, NULL),
    (uid, 'perdido',       'Perdido',            'hsl(0, 72%, 51%)',    11, true, true,  'perdido');

  RETURN QUERY SELECT * FROM public.pipeline_estagios WHERE imobiliaria_id = uid ORDER BY ordem;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pipeline_estagios_seed_defaults() TO authenticated;

-- 7. Reorder RPC: bulk-update ordem in one transaction
CREATE OR REPLACE FUNCTION public.pipeline_estagios_reorder(p_slugs TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  i INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  FOR i IN 1 .. array_length(p_slugs, 1) LOOP
    UPDATE public.pipeline_estagios
       SET ordem = i - 1, updated_at = now()
     WHERE imobiliaria_id = uid AND slug = p_slugs[i];
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pipeline_estagios_reorder(TEXT[]) TO authenticated;
