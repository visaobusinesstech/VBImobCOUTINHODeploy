
CREATE OR REPLACE FUNCTION public.increment_firecrawl_cache_hit(p_cache_key TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.firecrawl_captacao_cache
  SET hits = hits + 1
  WHERE cache_key = p_cache_key;
$$;

REVOKE ALL ON FUNCTION public.increment_firecrawl_cache_hit(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_firecrawl_cache_hit(TEXT) TO service_role;
