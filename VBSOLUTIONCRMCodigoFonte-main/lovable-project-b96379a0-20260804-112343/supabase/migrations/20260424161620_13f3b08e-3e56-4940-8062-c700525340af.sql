-- Update function to include search_path for security
CREATE OR REPLACE FUNCTION public.track_lead_activity()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_imobiliaria_id UUID;
    v_titulo TEXT;
    v_descricao TEXT;
    v_tipo TEXT;
BEGIN
    v_imobiliaria_id := COALESCE(NEW.imobiliaria_id, OLD.imobiliaria_id);
    
    -- INSERT (New Lead)
    IF (TG_OP = 'INSERT') THEN
        v_tipo := 'captacao';
        v_titulo := 'Lead captado';
        v_descricao := 'Lead "' || NEW.nome || '" adicionado ao pipeline';
        
        INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
        VALUES (NEW.id, v_imobiliaria_id, v_tipo, v_titulo, v_descricao);
        
    -- UPDATE (Changes)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Stage change
        IF (OLD.estagio IS DISTINCT FROM NEW.estagio) THEN
            v_tipo := 'estagio';
            v_titulo := 'Mudança de estágio';
            v_descricao := 'Movido de "' || OLD.estagio || '" para "' || NEW.estagio || '"';
            
            INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
            VALUES (NEW.id, v_imobiliaria_id, v_tipo, v_titulo, v_descricao);
        END IF;

        -- Corretor change
        IF (OLD.corretor_id IS DISTINCT FROM NEW.corretor_id) THEN
            v_tipo := 'atribuicao';
            v_titulo := 'Responsável alterado';
            
            IF (NEW.corretor_id IS NULL) THEN
                v_descricao := 'Lead ficou sem corretor responsável';
            ELSE
                v_descricao := 'Novo corretor atribuído ao lead';
            END IF;
            
            INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
            VALUES (NEW.id, v_imobiliaria_id, v_tipo, v_titulo, v_descricao);
        END IF;

        -- Lost Lead (motivo_perda)
        IF (OLD.motivo_perda IS NULL AND NEW.motivo_perda IS NOT NULL) THEN
            v_tipo := 'perda';
            v_titulo := 'Lead perdido';
            v_descricao := 'Motivo: ' || NEW.motivo_perda;
            
            INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
            VALUES (NEW.id, v_imobiliaria_id, v_tipo, v_titulo, v_descricao);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Restrict activity insertion to ensure it only happens via the trigger (authenticated)
-- or manually for notes (handled by application logic)
DROP POLICY IF EXISTS "System can insert activities" ON public.lead_atividades;
CREATE POLICY "Users can insert their own activities" 
ON public.lead_atividades
FOR INSERT
WITH CHECK (imobiliaria_id IN (
    SELECT id FROM public.imobiliaria_config WHERE user_id = auth.uid()
));
