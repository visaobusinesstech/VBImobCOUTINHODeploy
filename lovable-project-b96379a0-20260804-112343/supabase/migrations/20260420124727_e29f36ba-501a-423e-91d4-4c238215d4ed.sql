-- Compartilhar dados do master com imoveisbsb123@gmail.com
INSERT INTO public.master_autorizacoes (master_id, user_id, ativo)
VALUES ('0f78835c-9aa7-411d-97d3-33d499953a1f', '521a1003-9154-4b03-a98c-788a7ac6eae4', true)
ON CONFLICT DO NOTHING;

-- Atualizar política de SELECT em leads: usuário compartilhado NÃO vê leads "fechado"
DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads
FOR SELECT
USING (
  is_approved(auth.uid())
  AND (
    imobiliaria_id = auth.uid()
    OR (
      can_access_imobiliaria(imobiliaria_id)
      AND estagio <> 'fechado'
    )
  )
);

-- Mesma restrição para UPDATE e DELETE (usuário compartilhado não mexe em fechados)
DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads
FOR UPDATE
USING (
  is_approved(auth.uid())
  AND (
    imobiliaria_id = auth.uid()
    OR (can_access_imobiliaria(imobiliaria_id) AND estagio <> 'fechado')
  )
);

DROP POLICY IF EXISTS leads_delete ON public.leads;
CREATE POLICY leads_delete ON public.leads
FOR DELETE
USING (
  is_approved(auth.uid())
  AND (
    imobiliaria_id = auth.uid()
    OR (can_access_imobiliaria(imobiliaria_id) AND estagio <> 'fechado')
  )
);