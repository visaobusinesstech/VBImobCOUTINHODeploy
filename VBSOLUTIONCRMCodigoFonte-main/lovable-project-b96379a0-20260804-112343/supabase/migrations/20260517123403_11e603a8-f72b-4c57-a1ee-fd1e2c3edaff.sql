-- Adicionando índices para otimizar a performance da listagem de logs
-- Já existem alguns índices, mas vamos garantir que os mais importantes para os filtros do painel estejam presentes e otimizados

-- Índice para busca por módulo e data (comum no Diagnóstico de Avaliação)
CREATE INDEX IF NOT EXISTS idx_system_logs_module_created_at_v2 ON public.system_logs (module, created_at DESC);

-- Índice para busca por nível de erro e data
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created_at_v2 ON public.system_logs (level, created_at DESC);

-- Índice para busca por usuário e data
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id_created_at_v2 ON public.system_logs (user_id, created_at DESC);

-- Índice para busca por ID de correlação
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation_id_v2 ON public.system_logs (correlation_id);

-- Índice GIN para busca rápida dentro do JSON de metadata
CREATE INDEX IF NOT EXISTS idx_system_logs_metadata_gin ON public.system_logs USING GIN (metadata);

-- Comentários para documentação
COMMENT ON INDEX public.idx_system_logs_module_created_at_v2 IS 'Otimiza filtros de módulo com ordenação cronológica inversa';
COMMENT ON INDEX public.idx_system_logs_level_created_at_v2 IS 'Otimiza filtros de nível de erro com ordenação cronológica inversa';
COMMENT ON INDEX public.idx_system_logs_metadata_gin IS 'Permite buscas rápidas dentro do campo JSONB de metadata';
