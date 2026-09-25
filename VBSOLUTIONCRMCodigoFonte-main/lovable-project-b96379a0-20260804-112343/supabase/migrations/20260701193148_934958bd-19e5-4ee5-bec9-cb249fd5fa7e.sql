
ALTER TABLE public.followups ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_followups_contrato_id ON public.followups(contrato_id);
ALTER TABLE public.followups DROP CONSTRAINT IF EXISTS followups_target_check;
ALTER TABLE public.followups ADD CONSTRAINT followups_target_check CHECK (lead_id IS NOT NULL OR contrato_id IS NOT NULL);
