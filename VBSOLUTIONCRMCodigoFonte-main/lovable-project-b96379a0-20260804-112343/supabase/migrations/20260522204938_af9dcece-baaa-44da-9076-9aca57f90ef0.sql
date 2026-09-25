ALTER TABLE public.user_ai_config 
ADD COLUMN model_article TEXT,
ADD COLUMN model_image TEXT,
ADD COLUMN timezone TEXT DEFAULT 'Brasília (UTC-3)',
ADD COLUMN byok_active BOOLEAN DEFAULT TRUE;