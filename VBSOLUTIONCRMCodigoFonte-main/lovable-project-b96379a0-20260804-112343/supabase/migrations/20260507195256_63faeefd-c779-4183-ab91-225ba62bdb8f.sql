-- Fix leads policies
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;

CREATE POLICY "leads_select" ON public.leads
    FOR SELECT
    USING (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "leads_insert" ON public.leads
    FOR INSERT
    WITH CHECK (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "leads_update" ON public.leads
    FOR UPDATE
    USING (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "leads_delete" ON public.leads
    FOR DELETE
    USING (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));

-- Fix propostas policies
DROP POLICY IF EXISTS "propostas_select" ON public.propostas;
DROP POLICY IF EXISTS "propostas_insert" ON public.propostas;
DROP POLICY IF EXISTS "propostas_update" ON public.propostas;
DROP POLICY IF EXISTS "propostas_delete" ON public.propostas;

CREATE POLICY "propostas_select" ON public.propostas
    FOR SELECT
    USING (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "propostas_insert" ON public.propostas
    FOR INSERT
    WITH CHECK (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "propostas_update" ON public.propostas
    FOR UPDATE
    USING (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "propostas_delete" ON public.propostas
    FOR DELETE
    USING (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));

-- Ensure lead_atividades has correct policies since it's used when creating propostas
DROP POLICY IF EXISTS "lead_atividades_select" ON public.lead_atividades;
DROP POLICY IF EXISTS "lead_atividades_insert" ON public.lead_atividades;

CREATE POLICY "lead_atividades_select" ON public.lead_atividades
    FOR SELECT
    USING (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "lead_atividades_insert" ON public.lead_atividades
    FOR INSERT
    WITH CHECK (is_approved(auth.uid()) AND can_access_imobiliaria(imobiliaria_id));
