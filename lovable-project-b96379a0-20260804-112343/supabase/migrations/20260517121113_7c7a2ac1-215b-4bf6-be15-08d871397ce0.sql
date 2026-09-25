-- Create table for tracking error notifications
CREATE TABLE IF NOT EXISTS public.error_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id UUID NOT NULL REFERENCES public.system_logs(id),
    notified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'pending',
    error_message TEXT
);

-- Enable RLS
ALTER TABLE public.error_notifications ENABLE ROW LEVEL SECURITY;

-- Policy for master users to view notifications
CREATE POLICY "Masters can view error notifications" 
ON public.error_notifications 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_master = true
));

-- Function to handle critical error alerting
CREATE OR REPLACE FUNCTION public.handle_system_error_alert()
RETURNS TRIGGER AS $$
DECLARE
    webhook_url TEXT;
    payload JSONB;
BEGIN
    -- Only alert on critical errors from relevant modules
    IF (NEW.level IN ('error', 'fatal')) AND 
       (NEW.module IN ('Avaliacao', 'AvaliacaoImovel', 'ExtrairDadosAnuncio')) THEN
        
        -- Track the notification intent
        INSERT INTO public.error_notifications (log_id) VALUES (NEW.id);
        
        -- Get system webhook if configured (logic can be expanded to fetch from a config table)
        -- For now, we prepare the payload for a hypothetical edge function or direct webhook
        payload := jsonb_build_object(
            'event', 'critical_error',
            'module', NEW.module,
            'action', NEW.action,
            'message', NEW.message,
            'user_id', NEW.user_id,
            'created_at', NEW.created_at,
            'metadata', NEW.metadata,
            'stack_trace', NEW.stack_trace
        );

        -- In a real scenario, we could use net.http_post here if the extension is enabled
        -- Or rely on a separate process listening to this table/trigger
        
        -- Add notification record to notify the user via existing notification table
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            data
        )
        SELECT 
            p.id,
            'Falha Crítica na Avaliação',
            'Ocorreu um erro no módulo ' || NEW.module || ': ' || NEW.message,
            'system_error',
            payload
        FROM public.profiles p
        WHERE p.is_master = true OR p.id = NEW.user_id;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to fire on new system logs
DROP TRIGGER IF EXISTS trigger_system_error_alert ON public.system_logs;
CREATE TRIGGER trigger_system_error_alert
AFTER INSERT ON public.system_logs
FOR EACH ROW
EXECUTE FUNCTION public.handle_system_error_alert();