-- Create the audit logs table
CREATE TABLE public.ai_usage_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view their own AI usage logs" 
ON public.ai_usage_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Only service role (edge functions) can insert logs generally, 
-- but we'll allow insert for the authenticated user for simplicity if handled via client, 
-- though it's better to keep it restricted.
CREATE POLICY "Users can create their own logs"
ON public.ai_usage_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);