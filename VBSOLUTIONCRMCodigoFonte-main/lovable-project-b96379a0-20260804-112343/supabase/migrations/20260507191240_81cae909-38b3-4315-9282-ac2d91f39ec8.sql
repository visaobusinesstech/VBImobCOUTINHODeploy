ALTER TABLE public.batch_exports 
ADD COLUMN IF NOT EXISTS filters JSONB,
ADD COLUMN IF NOT EXISTS search_params JSONB;

COMMENT ON COLUMN public.batch_exports.filters IS 'Store UI filters applied during export';
COMMENT ON COLUMN public.batch_exports.search_params IS 'Store search parameters (city, type, operation, portals, state) used for the search';