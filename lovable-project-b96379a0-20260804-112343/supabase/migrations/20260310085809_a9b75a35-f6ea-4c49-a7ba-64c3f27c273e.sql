-- Add confirmation tracking to compromissos
ALTER TABLE public.compromissos
ADD COLUMN IF NOT EXISTS confirmacao_status text NOT NULL DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS confirmacao_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS confirmacao_mensagem text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cliente_resposta text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS data_reagendamento_sugerida timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.compromissos.confirmacao_status IS 'pendente, enviado, confirmado, cancelado, reagendar';
COMMENT ON COLUMN public.compromissos.confirmacao_token IS 'Unique token for public confirmation link';
COMMENT ON COLUMN public.compromissos.confirmacao_mensagem IS 'AI-generated confirmation message sent to client';
COMMENT ON COLUMN public.compromissos.cliente_resposta IS 'Client response text when canceling or rescheduling';
COMMENT ON COLUMN public.compromissos.data_reagendamento_sugerida IS 'Suggested reschedule date by client';

-- Create index for token lookup
CREATE INDEX IF NOT EXISTS idx_compromissos_confirmacao_token ON public.compromissos(confirmacao_token);