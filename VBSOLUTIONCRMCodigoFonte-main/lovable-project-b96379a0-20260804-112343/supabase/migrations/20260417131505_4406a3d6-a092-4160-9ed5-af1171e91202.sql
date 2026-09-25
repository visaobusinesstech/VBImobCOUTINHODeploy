CREATE OR REPLACE FUNCTION public.set_updated_at_lista_capt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;