-- Create system_logs table for structured diagnostic logging
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    module TEXT NOT NULL, -- e.g., 'Avaliacao', 'AuditoriaIA'
    action TEXT NOT NULL, -- e.g., 'extrair-link', 'handleAvaliar'
    level TEXT DEFAULT 'info', -- 'info', 'warn', 'error'
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- Store params, browser info, etc.
    stack_trace TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (Masters can view all, users only theirs)
CREATE POLICY "Users can view their own system logs" 
ON public.system_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own system logs" 
ON public.system_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Index for diagnostics
CREATE INDEX IF NOT EXISTS idx_system_logs_module ON public.system_logs(module);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at);
