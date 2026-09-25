-- We use a simplified encryption approach for this project structure, 
-- but in a production environment with Vault, we would use pgsodium.
-- For now, we will store the IV and the encrypted key.

ALTER TABLE public.user_ai_config DROP COLUMN IF EXISTS api_key;
ALTER TABLE public.user_ai_config ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;
ALTER TABLE public.user_ai_config ADD COLUMN IF NOT EXISTS api_key_iv TEXT;

-- Ensure RLS is still enabled
ALTER TABLE public.user_ai_config ENABLE ROW LEVEL SECURITY;

-- Re-confirm policies (dropped if table was recreated, but here we just altered)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own AI config') THEN
        CREATE POLICY "Users can manage their own AI config" 
        ON public.user_ai_config 
        FOR ALL 
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;