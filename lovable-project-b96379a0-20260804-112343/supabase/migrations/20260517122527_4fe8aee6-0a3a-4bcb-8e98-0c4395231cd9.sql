-- Add indexes to optimize log queries
CREATE INDEX IF NOT EXISTS idx_system_logs_module_created_at ON public.system_logs (module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created_at ON public.system_logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id_created_at ON public.system_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation_id ON public.system_logs (correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_metadata_imovel_id ON public.system_logs ((metadata->>'imovel_id'));
