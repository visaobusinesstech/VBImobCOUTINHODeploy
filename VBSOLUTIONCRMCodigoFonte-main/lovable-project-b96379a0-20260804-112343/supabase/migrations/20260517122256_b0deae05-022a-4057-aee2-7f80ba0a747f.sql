-- Create table to track sent threshold alerts to prevent spamming
CREATE TABLE IF NOT EXISTS public.error_threshold_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id TEXT NOT NULL, -- user_id or imovel_id
    alert_type TEXT NOT NULL, -- 'user_spike' or 'property_spike'
    last_alerted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(target_id, alert_type)
);

-- Update the error alert function to handle rate limiting and spikes
CREATE OR REPLACE FUNCTION public.handle_system_error_alert()
RETURNS TRIGGER AS $$
DECLARE
    user_error_count INTEGER;
    imovel_error_count INTEGER;
    imovel_id_val TEXT;
    last_user_alert TIMESTAMP WITH TIME ZONE;
    last_imovel_alert TIMESTAMP WITH TIME ZONE;
    payload JSONB;
BEGIN
    -- Only process critical errors from relevant modules
    IF (NEW.level IN ('error', 'fatal')) AND 
       (NEW.module IN ('Avaliacao', 'AvaliacaoImovel', 'ExtrairDadosAnuncio')) THEN
        
        -- 1. Standard log tracking
        INSERT INTO public.error_notifications (log_id) VALUES (NEW.id);
        
        -- Extract imovel_id from metadata if present
        imovel_id_val := NEW.metadata->>'imovel_id';

        -- 2. Check for User Spike (Threshold: 5 errors in last 30 minutes)
        SELECT COUNT(*) INTO user_error_count
        FROM public.system_logs
        WHERE user_id = NEW.user_id
          AND level IN ('error', 'fatal')
          AND created_at > now() - interval '30 minutes';

        IF user_error_count >= 5 THEN
            -- Check if we alerted recently (within last 1 hour)
            SELECT last_alerted_at INTO last_user_alert
            FROM public.error_threshold_logs
            WHERE target_id = NEW.user_id::text AND alert_type = 'user_spike';

            IF last_user_alert IS NULL OR last_user_alert < now() - interval '1 hour' THEN
                -- Insert or update last alert time
                INSERT INTO public.error_threshold_logs (target_id, alert_type, last_alerted_at)
                VALUES (NEW.user_id::text, 'user_spike', now())
                ON CONFLICT (target_id, alert_type) DO UPDATE SET last_alerted_at = now();

                -- Send spike notification
                INSERT INTO public.notifications (user_id, title, message, type, data)
                SELECT p.id, 'Alerta de Instabilidade: Usuário', 
                       'O usuário ' || (SELECT nome FROM public.profiles WHERE id = NEW.user_id) || ' registrou ' || user_error_count || ' erros nos últimos 30 min.',
                       'stability_alert', 
                       jsonb_build_object('user_id', NEW.user_id, 'count', user_error_count)
                FROM public.profiles p WHERE p.is_master = true;
            END IF;
        END IF;

        -- 3. Check for Property Spike (Threshold: 3 errors in last 30 minutes)
        IF imovel_id_val IS NOT NULL THEN
            SELECT COUNT(*) INTO imovel_error_count
            FROM public.system_logs
            WHERE metadata->>'imovel_id' = imovel_id_val
              AND level IN ('error', 'fatal')
              AND created_at > now() - interval '30 minutes';

            IF imovel_error_count >= 3 THEN
                SELECT last_alerted_at INTO last_imovel_alert
                FROM public.error_threshold_logs
                WHERE target_id = imovel_id_val AND alert_type = 'property_spike';

                IF last_imovel_alert IS NULL OR last_imovel_alert < now() - interval '1 hour' THEN
                    INSERT INTO public.error_threshold_logs (target_id, alert_type, last_alerted_at)
                    VALUES (imovel_id_val, 'property_spike', now())
                    ON CONFLICT (target_id, alert_type) DO UPDATE SET last_alerted_at = now();

                    -- Send property spike notification
                    INSERT INTO public.notifications (user_id, title, message, type, data)
                    SELECT p.id, 'Alerta de Instabilidade: Imóvel', 
                           'O imóvel ' || COALESCE(NEW.metadata->>'imovel_titulo', imovel_id_val) || ' registrou ' || imovel_error_count || ' falhas consecutivas.',
                           'stability_alert', 
                           jsonb_build_object('imovel_id', imovel_id_val, 'count', imovel_error_count)
                    FROM public.profiles p WHERE p.is_master = true;
                END IF;
            END IF;
        END IF;

        -- 4. Preparation for master/user direct error notification (existing logic)
        payload := jsonb_build_object(
            'event', 'critical_error',
            'module', NEW.module,
            'action', NEW.action,
            'message', NEW.message,
            'user_id', NEW.user_id,
            'correlation_id', NEW.correlation_id,
            'metadata', NEW.metadata
        );

        INSERT INTO public.notifications (user_id, title, message, type, data)
        SELECT p.id, 'Erro Crítico de Avaliação', 
               'Módulo ' || NEW.module || ': ' || NEW.message,
               'system_error', payload
        FROM public.profiles p
        WHERE p.is_master = true OR p.id = NEW.user_id;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;