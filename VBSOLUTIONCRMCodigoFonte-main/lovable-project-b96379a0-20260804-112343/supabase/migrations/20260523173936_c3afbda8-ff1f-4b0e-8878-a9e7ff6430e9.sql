-- Create table for Serper usage limits and alerts
CREATE TABLE IF NOT EXISTS public.serper_usage_limits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
    monthly_limit INTEGER NOT NULL DEFAULT 100, -- Default 100 searches per month
    alert_email TEXT,
    alert_threshold_percent INTEGER DEFAULT 80, -- Alert when 80% is reached
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.serper_usage_limits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own serper limits" 
ON public.serper_usage_limits FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own serper limits" 
ON public.serper_usage_limits FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own serper limits" 
ON public.serper_usage_limits FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_serper_usage_limits_updated_at
    BEFORE UPDATE ON public.serper_usage_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();