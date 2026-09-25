CREATE OR REPLACE FUNCTION public.get_master_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE is_master = true LIMIT 1;
$$;