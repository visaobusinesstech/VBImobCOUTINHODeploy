-- 1. Automate follow-up creation for new leads
CREATE OR REPLACE FUNCTION public.handle_new_lead_followup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.followups (
        lead_id,
        imobiliaria_id,
        data_followup,
        tipo,
        descricao,
        status
    ) VALUES (
        NEW.id,
        NEW.imobiliaria_id,
        (CURRENT_DATE + INTERVAL '1 day')::date,
        'ligacao',
        'Boas-vindas e primeiro contato com o novo lead.',
        'pendente'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_lead_created_followup
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.handle_new_lead_followup();

-- 2. Create follow-ups on stage changes
CREATE OR REPLACE FUNCTION public.handle_lead_stage_change_followup()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estagio <> NEW.estagio THEN
        -- If moved to "visita", schedule a follow-up for day after visit (simulated)
        -- Or just a general next step
        INSERT INTO public.followups (
            lead_id,
            imobiliaria_id,
            data_followup,
            tipo,
            descricao,
            status
        ) VALUES (
            NEW.id,
            NEW.imobiliaria_id,
            (CURRENT_DATE + INTERVAL '2 days')::date,
            'whatsapp',
            'Acompanhamento após mudança para o estágio: ' || NEW.estagio,
            'pendente'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_lead_stage_change_followup
AFTER UPDATE OF estagio ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.handle_lead_stage_change_followup();

-- 3. Contract expiration alerts (function to be called by cron or app)
CREATE OR REPLACE FUNCTION public.check_expiring_contracts()
RETURNS void AS $$
DECLARE
    contract_row RECORD;
BEGIN
    FOR contract_row IN 
        SELECT id, titulo, data_fim, imobiliaria_id, proprietario
        FROM public.contratos
        WHERE status NOT IN ('cancelado', 'inativo')
        AND data_fim IS NOT NULL
        AND data_fim = (CURRENT_DATE + INTERVAL '30 days')::date
    LOOP
        -- Insert into notifications for the master user of the imobiliaria
        -- This is a simplification; ideally we'd notify the assigned broker too
        INSERT INTO public.notifications (user_id, title, description)
        SELECT id, 'Contrato Vencendo', 'O contrato "' || contract_row.titulo || '" vence em 30 dias.'
        FROM public.profiles
        WHERE imobiliaria_id = contract_row.imobiliaria_id OR id = contract_row.imobiliaria_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
