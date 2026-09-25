
-- Simplify can_access_imobiliaria: each user only sees their own data
-- Master does NOT see other users' data anymore
CREATE OR REPLACE FUNCTION public.can_access_imobiliaria(_imobiliaria_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _imobiliaria_id = auth.uid()
$$;
