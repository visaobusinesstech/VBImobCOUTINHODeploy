CREATE TABLE public.radarzap_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  route text NOT NULL,
  status text NOT NULL CHECK (status IN ('allowed','blocked')),
  motivo text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rz_access_log_created ON public.radarzap_access_log (created_at DESC);
CREATE INDEX idx_rz_access_log_user ON public.radarzap_access_log (user_id, created_at DESC);
CREATE INDEX idx_rz_access_log_status ON public.radarzap_access_log (status, created_at DESC);

GRANT SELECT, INSERT ON public.radarzap_access_log TO authenticated;
GRANT ALL ON public.radarzap_access_log TO service_role;

ALTER TABLE public.radarzap_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users insert own access log"
  ON public.radarzap_access_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "master reads all access log"
  ON public.radarzap_access_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = public.get_master_user_id());

CREATE POLICY "user reads own access log"
  ON public.radarzap_access_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());