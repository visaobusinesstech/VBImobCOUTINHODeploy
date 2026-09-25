-- Create the cache table
CREATE TABLE IF NOT EXISTS public.serper_search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    results JSONB NOT NULL,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_serper_search_cache_query ON public.serper_search_cache(query);
CREATE INDEX IF NOT EXISTS idx_serper_search_cache_user_query ON public.serper_search_cache(user_id, query);

-- Enable RLS
ALTER TABLE public.serper_search_cache ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see and manage their own cache entries
CREATE POLICY "Users can view their own serper cache" 
ON public.serper_search_cache FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own serper cache" 
ON public.serper_search_cache FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Cleanup function to remove old cache (older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_serper_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM public.serper_search_cache
    WHERE created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
