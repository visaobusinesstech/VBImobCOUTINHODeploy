-- Create extraction_logs table for detailed tracking
CREATE TABLE IF NOT EXISTS public.extraction_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    source_url TEXT NOT NULL,
    portal TEXT,
    status TEXT NOT NULL, -- 'success', 'error', 'partial'
    error_message TEXT,
    missing_fields TEXT[] DEFAULT '{}',
    retry_attempt INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extraction_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own extraction logs" 
ON public.extraction_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own extraction logs" 
ON public.extraction_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_extraction_logs_portal ON public.extraction_logs(portal);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_status ON public.extraction_logs(status);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_created_at ON public.extraction_logs(created_at);
