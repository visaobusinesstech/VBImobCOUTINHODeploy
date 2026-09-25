-- Normalize legacy estagios in leads: remap 'procurar_opcoes' e 'opcoes' -> 'mandar_opcoes'
UPDATE public.leads
SET estagio = 'mandar_opcoes'
WHERE estagio IN ('procurar_opcoes', 'opcoes');

-- Remove legacy stage from auto-assign config arrays (imobiliaria_config)
UPDATE public.imobiliaria_config
SET auto_assign_ludmila_estagios = (
  SELECT COALESCE(array_agg(x), ARRAY['novos']::text[])
  FROM unnest(auto_assign_ludmila_estagios) x
  WHERE x NOT IN ('procurar_opcoes', 'opcoes')
)
WHERE auto_assign_ludmila_estagios && ARRAY['procurar_opcoes', 'opcoes']::text[];

-- Trigger + CHECK to prevent future writes of the legacy stage.
CREATE OR REPLACE FUNCTION public.prevent_legacy_estagio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estagio IN ('procurar_opcoes', 'opcoes') THEN
    NEW.estagio := 'mandar_opcoes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_legacy_estagio ON public.leads;
CREATE TRIGGER trg_prevent_legacy_estagio
BEFORE INSERT OR UPDATE OF estagio ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.prevent_legacy_estagio();
