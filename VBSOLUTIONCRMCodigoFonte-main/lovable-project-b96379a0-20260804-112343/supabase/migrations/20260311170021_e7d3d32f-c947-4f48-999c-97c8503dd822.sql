
-- Trigger: auto-create follow-up when lead is created
CREATE OR REPLACE FUNCTION public.on_lead_created_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.followups (lead_id, imobiliaria_id, data_followup, tipo, descricao, status)
  VALUES (
    NEW.id,
    NEW.imobiliaria_id,
    (CURRENT_DATE + interval '1 day')::date,
    'whatsapp',
    'Follow-up automático - Primeiro contato com o lead',
    'pendente'
  );
  RETURN NEW;
END;
$function$;

-- Drop if exists and create trigger
DROP TRIGGER IF EXISTS trigger_auto_followup_on_lead ON public.leads;
CREATE TRIGGER trigger_auto_followup_on_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.on_lead_created_followup();

-- Add column to track if followup WhatsApp was sent
ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS whatsapp_enviado boolean NOT NULL DEFAULT false;
ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS whatsapp_enviado_at timestamptz;
ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS mensagem_whatsapp text;
