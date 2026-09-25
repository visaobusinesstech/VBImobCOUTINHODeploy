CREATE TABLE IF NOT EXISTS public.user_ai_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai','anthropic','google','lovable')),
  api_key text,
  model text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own ai config"
ON public.user_ai_config FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "user inserts own ai config"
ON public.user_ai_config FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user updates own ai config"
ON public.user_ai_config FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user deletes own ai config"
ON public.user_ai_config FOR DELETE
USING (auth.uid() = user_id);