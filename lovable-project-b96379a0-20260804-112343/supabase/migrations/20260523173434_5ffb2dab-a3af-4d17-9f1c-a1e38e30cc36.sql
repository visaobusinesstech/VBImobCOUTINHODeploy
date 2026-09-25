CREATE TABLE public.serper_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    query TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.serper_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own serper audit logs" 
ON public.serper_audit_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- The edge function uses service role, but it's good practice to have a policy if we ever use it from client
CREATE POLICY "Users can insert their own serper audit logs" 
ON public.serper_audit_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
