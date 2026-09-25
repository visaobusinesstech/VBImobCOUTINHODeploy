
ALTER TABLE public.user_ai_config
  ADD COLUMN IF NOT EXISTS api_key_rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS serper_key_rotated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rotation_interval_days INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS rotation_alert_days INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS rotation_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_health_check_status TEXT,
  ADD COLUMN IF NOT EXISTS last_health_check_message TEXT;

UPDATE public.user_ai_config
  SET api_key_rotated_at = COALESCE(api_key_rotated_at, updated_at, created_at, now())
  WHERE api_key_encrypted IS NOT NULL;
UPDATE public.user_ai_config
  SET serper_key_rotated_at = COALESCE(serper_key_rotated_at, updated_at, created_at, now())
  WHERE serper_key_encrypted IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_key_rotation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  key_kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  provider TEXT,
  days_since_rotation INTEGER,
  interval_days INTEGER,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  alert_day DATE GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED,
  acknowledged_at TIMESTAMPTZ,
  UNIQUE (user_id, key_kind, severity, provider, alert_day)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_key_rotation_alerts TO authenticated;
GRANT ALL ON public.ai_key_rotation_alerts TO service_role;

ALTER TABLE public.ai_key_rotation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own rotation alerts"
  ON public.ai_key_rotation_alerts FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users ack own rotation alerts"
  ON public.ai_key_rotation_alerts FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role manages rotation alerts"
  ON public.ai_key_rotation_alerts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_key_rotation_alerts_user
  ON public.ai_key_rotation_alerts (user_id, created_at DESC);
