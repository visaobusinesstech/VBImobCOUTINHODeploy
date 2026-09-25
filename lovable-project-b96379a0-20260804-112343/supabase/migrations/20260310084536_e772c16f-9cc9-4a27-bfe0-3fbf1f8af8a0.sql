-- Add check-in/checkout and AI feedback columns to compromissos
ALTER TABLE public.compromissos 
ADD COLUMN IF NOT EXISTS checkin_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS checkout_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS feedback_visita text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS feedback_ia text DEFAULT NULL;

COMMENT ON COLUMN public.compromissos.checkin_at IS 'Timestamp when agent checked in at the property';
COMMENT ON COLUMN public.compromissos.checkout_at IS 'Timestamp when agent checked out from the visit';
COMMENT ON COLUMN public.compromissos.feedback_visita IS 'Agent manual feedback after the visit';
COMMENT ON COLUMN public.compromissos.feedback_ia IS 'AI-generated summary and suggestions after the visit';