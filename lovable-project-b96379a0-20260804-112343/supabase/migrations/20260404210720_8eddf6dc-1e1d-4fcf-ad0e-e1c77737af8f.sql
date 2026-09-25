
-- Table to track AI usage per user per function
CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI usage"
  ON public.ai_usage_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own AI usage"
  ON public.ai_usage_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_ai_usage_user_func ON public.ai_usage_log (user_id, function_name);

-- Helper function to check if user exceeded AI limit (called from edge functions)
CREATE OR REPLACE FUNCTION public.get_ai_usage_count(_user_id uuid, _function_name text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND function_name = _function_name
$$;
