-- Add correlation_id to system_logs
ALTER TABLE public.system_logs 
ADD COLUMN IF NOT EXISTS correlation_id UUID;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation_id ON public.system_logs(correlation_id);