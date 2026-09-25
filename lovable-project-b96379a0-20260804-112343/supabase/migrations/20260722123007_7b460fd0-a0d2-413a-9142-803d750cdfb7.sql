
CREATE OR REPLACE FUNCTION public.introspect_table_columns(_table text)
RETURNS TABLE(column_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT c.column_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = _table;
$$;

REVOKE ALL ON FUNCTION public.introspect_table_columns(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.introspect_table_columns(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.introspect_table_columns(text) IS
  'Read-only schema introspection helper used by regression tests to detect column drift in edge functions. Only returns metadata (column names) from the public schema.';
