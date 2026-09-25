-- Drop and recreate the cleanup function with proper security settings
DROP FUNCTION IF EXISTS public.cleanup_old_serper_cache();

CREATE OR REPLACE FUNCTION public.cleanup_old_serper_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM public.serper_search_cache
    WHERE created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;

-- Revoke execute from public to ensure only the owner/system can run it
REVOKE EXECUTE ON FUNCTION public.cleanup_old_serper_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_serper_cache() TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_old_serper_cache() TO service_role;
