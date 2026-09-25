
-- Create helper functions
CREATE OR REPLACE FUNCTION public.get_user_imobiliaria_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN (SELECT approved FROM public.profiles WHERE id = auth.uid()) = true
    THEN (SELECT id FROM public.profiles WHERE is_master = true LIMIT 1)
    ELSE auth.uid()
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT approved FROM public.profiles WHERE id = _user_id),
    false
  );
$$;

-- AUTOMACOES
DROP POLICY IF EXISTS "Owner can select automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Owner can insert automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Owner can update automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Owner can delete automacoes" ON public.automacoes;
CREATE POLICY "Approved can select automacoes" ON public.automacoes FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert automacoes" ON public.automacoes FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update automacoes" ON public.automacoes FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete automacoes" ON public.automacoes FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- CLIENTES_RELACIONAMENTO
DROP POLICY IF EXISTS "Owner can select clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Owner can insert clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Owner can update clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Owner can delete clientes_relacionamento" ON public.clientes_relacionamento;
CREATE POLICY "Approved can select clientes_relacionamento" ON public.clientes_relacionamento FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert clientes_relacionamento" ON public.clientes_relacionamento FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update clientes_relacionamento" ON public.clientes_relacionamento FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete clientes_relacionamento" ON public.clientes_relacionamento FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- COMPROMISSOS
DROP POLICY IF EXISTS "Owner can select compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Owner can insert compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Owner can update compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Owner can delete compromissos" ON public.compromissos;
CREATE POLICY "Approved can select compromissos" ON public.compromissos FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert compromissos" ON public.compromissos FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update compromissos" ON public.compromissos FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete compromissos" ON public.compromissos FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- CONTRATOS
DROP POLICY IF EXISTS "Owner can select contratos" ON public.contratos;
DROP POLICY IF EXISTS "Owner can insert contratos" ON public.contratos;
DROP POLICY IF EXISTS "Owner can update contratos" ON public.contratos;
DROP POLICY IF EXISTS "Owner can delete contratos" ON public.contratos;
CREATE POLICY "Approved can select contratos" ON public.contratos FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update contratos" ON public.contratos FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete contratos" ON public.contratos FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- CORRETORES
DROP POLICY IF EXISTS "Owner can select corretores" ON public.corretores;
DROP POLICY IF EXISTS "Owner can insert corretores" ON public.corretores;
DROP POLICY IF EXISTS "Owner can update corretores" ON public.corretores;
DROP POLICY IF EXISTS "Owner can delete corretores" ON public.corretores;
CREATE POLICY "Approved can select corretores" ON public.corretores FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert corretores" ON public.corretores FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update corretores" ON public.corretores FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete corretores" ON public.corretores FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- CORRETOR_PERMISSOES
DROP POLICY IF EXISTS "Owner can select permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Owner can insert permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Owner can update permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Owner can delete permissoes" ON public.corretor_permissoes;
CREATE POLICY "Approved can select permissoes" ON public.corretor_permissoes FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved can insert permissoes" ON public.corretor_permissoes FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved can update permissoes" ON public.corretor_permissoes FOR UPDATE TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved can delete permissoes" ON public.corretor_permissoes FOR DELETE TO authenticated USING (is_approved(auth.uid()));

-- FOLLOWUPS
DROP POLICY IF EXISTS "Owner can select followups" ON public.followups;
DROP POLICY IF EXISTS "Owner can insert followups" ON public.followups;
DROP POLICY IF EXISTS "Owner can update followups" ON public.followups;
DROP POLICY IF EXISTS "Owner can delete followups" ON public.followups;
CREATE POLICY "Approved can select followups" ON public.followups FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert followups" ON public.followups FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update followups" ON public.followups FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete followups" ON public.followups FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- IMOVEIS (keep public SELECT)
DROP POLICY IF EXISTS "Owner can insert imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Owner can update imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Owner can delete imoveis" ON public.imoveis;
CREATE POLICY "Approved can insert imoveis" ON public.imoveis FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update imoveis" ON public.imoveis FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid())) WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete imoveis" ON public.imoveis FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- IMOVEIS_MERCADO
DROP POLICY IF EXISTS "Owner can select imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Owner can insert imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Owner can delete imoveis_mercado" ON public.imoveis_mercado;
CREATE POLICY "Approved can select imoveis_mercado" ON public.imoveis_mercado FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert imoveis_mercado" ON public.imoveis_mercado FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete imoveis_mercado" ON public.imoveis_mercado FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- LEAD_ATIVIDADES
DROP POLICY IF EXISTS "Owner can select lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Owner can insert lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Owner can delete lead_atividades" ON public.lead_atividades;
CREATE POLICY "Approved can select lead_atividades" ON public.lead_atividades FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert lead_atividades" ON public.lead_atividades FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete lead_atividades" ON public.lead_atividades FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- LEADS (keep anon insert)
DROP POLICY IF EXISTS "Owner can select leads" ON public.leads;
DROP POLICY IF EXISTS "Owner can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Owner can update leads" ON public.leads;
DROP POLICY IF EXISTS "Owner can delete leads" ON public.leads;
CREATE POLICY "Approved can select leads" ON public.leads FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update leads" ON public.leads FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete leads" ON public.leads FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- MENSAGEM_TEMPLATES
DROP POLICY IF EXISTS "Owner can select mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Owner can insert mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Owner can update mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Owner can delete mensagem_templates" ON public.mensagem_templates;
CREATE POLICY "Approved can select mensagem_templates" ON public.mensagem_templates FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert mensagem_templates" ON public.mensagem_templates FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update mensagem_templates" ON public.mensagem_templates FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete mensagem_templates" ON public.mensagem_templates FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- PROPRIETARIOS
DROP POLICY IF EXISTS "Owner can select proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Owner can insert proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Owner can update proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Owner can delete proprietarios" ON public.proprietarios;
CREATE POLICY "Approved can select proprietarios" ON public.proprietarios FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert proprietarios" ON public.proprietarios FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update proprietarios" ON public.proprietarios FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete proprietarios" ON public.proprietarios FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- TRANSACOES
DROP POLICY IF EXISTS "Owner can select transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Owner can insert transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Owner can update transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Owner can delete transacoes" ON public.transacoes;
CREATE POLICY "Approved can select transacoes" ON public.transacoes FOR SELECT TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert transacoes" ON public.transacoes FOR INSERT TO authenticated WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can update transacoes" ON public.transacoes FOR UPDATE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete transacoes" ON public.transacoes FOR DELETE TO authenticated USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
