-- Fix lead imobiliaria_id trigger function
CREATE OR REPLACE FUNCTION public.set_lead_imobiliaria_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only set if it's NULL and we have an auth user
  IF NEW.imobiliaria_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.imobiliaria_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix proposta imobiliaria_id trigger function
CREATE OR REPLACE FUNCTION public.set_proposta_imobiliaria_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only set if it's NULL and we have an auth user
  IF NEW.imobiliaria_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.imobiliaria_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;
