
-- Add codigo_contrato column
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS codigo_contrato text;

-- Create function to auto-generate contract codes
CREATE OR REPLACE FUNCTION public.generate_codigo_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prefix text;
  next_num integer;
BEGIN
  IF NEW.tipo = 'Locação' THEN
    prefix := 'LOC';
  ELSE
    prefix := 'VEN';
  END IF;

  SELECT COALESCE(MAX(
    CASE 
      WHEN codigo_contrato ~ ('^' || prefix || '-[0-9]+$') 
      THEN CAST(SUBSTRING(codigo_contrato FROM prefix || '-([0-9]+)$') AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO next_num
  FROM public.contratos
  WHERE imobiliaria_id = NEW.imobiliaria_id;

  NEW.codigo_contrato := prefix || '-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS tr_generate_codigo_contrato ON public.contratos;
CREATE TRIGGER tr_generate_codigo_contrato
  BEFORE INSERT ON public.contratos
  FOR EACH ROW
  WHEN (NEW.codigo_contrato IS NULL OR NEW.codigo_contrato = '')
  EXECUTE FUNCTION public.generate_codigo_contrato();

-- Backfill existing contracts with codes
DO $$
DECLARE
  r RECORD;
  prefix text;
  counter integer;
  current_imob uuid := NULL;
BEGIN
  counter := 0;
  FOR r IN 
    SELECT id, imobiliaria_id, tipo, created_at 
    FROM public.contratos 
    WHERE codigo_contrato IS NULL 
    ORDER BY imobiliaria_id, created_at ASC
  LOOP
    IF current_imob IS DISTINCT FROM r.imobiliaria_id THEN
      current_imob := r.imobiliaria_id;
      counter := 0;
    END IF;
    counter := counter + 1;
    
    IF r.tipo = 'Locação' THEN
      prefix := 'LOC';
    ELSE
      prefix := 'VEN';
    END IF;
    
    UPDATE public.contratos 
    SET codigo_contrato = prefix || '-' || LPAD(counter::text, 3, '0')
    WHERE id = r.id;
  END LOOP;
END;
$$;
