
CREATE TABLE public.ai_config_test_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ai','serper','chain')),
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL CHECK (status IN ('success','error')),
  message TEXT,
  active_model TEXT,
  fallback_used BOOLEAN,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX ai_config_test_log_user_created_idx ON public.ai_config_test_log(user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.ai_config_test_log TO authenticated;
GRANT ALL ON public.ai_config_test_log TO service_role;
ALTER TABLE public.ai_config_test_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own test log" ON public.ai_config_test_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own test log" ON public.ai_config_test_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own test log" ON public.ai_config_test_log FOR DELETE USING (auth.uid() = user_id);
