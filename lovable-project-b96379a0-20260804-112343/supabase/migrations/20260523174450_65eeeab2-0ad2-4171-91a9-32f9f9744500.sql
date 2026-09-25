-- Adiciona coluna para múltiplas chaves de API
ALTER TABLE public.user_ai_config 
ADD COLUMN IF NOT EXISTS provider_keys JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS serper_keys JSONB DEFAULT '{}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN public.user_ai_config.provider_keys IS 'Armazena chaves de API para diferentes provedores (openai, anthropic, google, etc) em formato JSON.';
COMMENT ON COLUMN public.user_ai_config.serper_keys IS 'Armazena chaves Serper adicionais se necessário.';
