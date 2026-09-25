ALTER TABLE public.user_ai_config ADD COLUMN IF NOT EXISTS serper_key_encrypted TEXT;
ALTER TABLE public.user_ai_config ADD COLUMN IF NOT EXISTS serper_key_iv TEXT;