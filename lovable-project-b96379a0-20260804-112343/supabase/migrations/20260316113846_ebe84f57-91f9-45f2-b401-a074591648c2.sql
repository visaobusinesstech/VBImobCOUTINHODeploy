
-- Audit log table for permission changes
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  acao text NOT NULL,
  modulo text,
  valor_anterior boolean,
  valor_novo boolean,
  detalhes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only master can see and insert audit logs
CREATE POLICY "audit_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (is_master(auth.uid()));

CREATE POLICY "audit_insert" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (is_master(auth.uid()) AND master_id = auth.uid());
