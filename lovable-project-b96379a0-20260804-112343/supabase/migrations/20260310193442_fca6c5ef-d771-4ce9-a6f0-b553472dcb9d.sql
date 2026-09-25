
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE for all data tables

-- AUTOMACOES
DROP POLICY IF EXISTS "Approved can select automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Approved can insert automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Approved can update automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Approved can delete automacoes" ON public.automacoes;
CREATE POLICY "Approved can select automacoes" ON public.automacoes FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert automacoes" ON public.automacoes FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update automacoes" ON public.automacoes FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete automacoes" ON public.automacoes FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- CLIENTES_RELACIONAMENTO
DROP POLICY IF EXISTS "Approved can select clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Approved can insert clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Approved can update clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Approved can delete clientes_relacionamento" ON public.clientes_relacionamento;
CREATE POLICY "Approved can select clientes_relacionamento" ON public.clientes_relacionamento FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert clientes_relacionamento" ON public.clientes_relacionamento FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update clientes_relacionamento" ON public.clientes_relacionamento FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete clientes_relacionamento" ON public.clientes_relacionamento FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- COMPROMISSOS
DROP POLICY IF EXISTS "Approved can select compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Approved can insert compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Approved can update compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Approved can delete compromissos" ON public.compromissos;
CREATE POLICY "Approved can select compromissos" ON public.compromissos FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert compromissos" ON public.compromissos FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update compromissos" ON public.compromissos FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete compromissos" ON public.compromissos FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- CONTATOS_LANDING
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contatos_landing;
DROP POLICY IF EXISTS "Master can read contacts" ON public.contatos_landing;
DROP POLICY IF EXISTS "Master can update contacts" ON public.contatos_landing;
CREATE POLICY "Anyone can submit contact form" ON public.contatos_landing FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Master can read contacts" ON public.contatos_landing FOR SELECT TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "Master can update contacts" ON public.contatos_landing FOR UPDATE TO authenticated USING (is_master(auth.uid()));

-- CONTRATOS
DROP POLICY IF EXISTS "Approved can select contratos" ON public.contratos;
DROP POLICY IF EXISTS "Approved can insert contratos" ON public.contratos;
DROP POLICY IF EXISTS "Approved can update contratos" ON public.contratos;
DROP POLICY IF EXISTS "Approved can delete contratos" ON public.contratos;
CREATE POLICY "Approved can select contratos" ON public.contratos FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update contratos" ON public.contratos FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete contratos" ON public.contratos FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- CORRETOR_PERMISSOES
DROP POLICY IF EXISTS "Approved can select permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Approved can insert permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Approved can update permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Approved can delete permissoes" ON public.corretor_permissoes;
CREATE POLICY "Approved can select permissoes" ON public.corretor_permissoes FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved can insert permissoes" ON public.corretor_permissoes FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved can update permissoes" ON public.corretor_permissoes FOR UPDATE TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved can delete permissoes" ON public.corretor_permissoes FOR DELETE TO authenticated USING (is_approved(auth.uid()));

-- CORRETORES
DROP POLICY IF EXISTS "Approved can select corretores" ON public.corretores;
DROP POLICY IF EXISTS "Approved can insert corretores" ON public.corretores;
DROP POLICY IF EXISTS "Approved can update corretores" ON public.corretores;
DROP POLICY IF EXISTS "Approved can delete corretores" ON public.corretores;
CREATE POLICY "Approved can select corretores" ON public.corretores FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert corretores" ON public.corretores FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update corretores" ON public.corretores FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete corretores" ON public.corretores FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- FOLLOWUPS
DROP POLICY IF EXISTS "Approved can select followups" ON public.followups;
DROP POLICY IF EXISTS "Approved can insert followups" ON public.followups;
DROP POLICY IF EXISTS "Approved can update followups" ON public.followups;
DROP POLICY IF EXISTS "Approved can delete followups" ON public.followups;
CREATE POLICY "Approved can select followups" ON public.followups FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert followups" ON public.followups FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update followups" ON public.followups FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete followups" ON public.followups FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- IMOBILIARIA_CONFIG
DROP POLICY IF EXISTS "Users can view own config" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "Users can insert own config" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "Users can update own config" ON public.imobiliaria_config;
CREATE POLICY "Users can view own config" ON public.imobiliaria_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own config" ON public.imobiliaria_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own config" ON public.imobiliaria_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- IMOVEIS
DROP POLICY IF EXISTS "Public can view imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Approved can insert imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Approved can update imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Approved can delete imoveis" ON public.imoveis;
CREATE POLICY "Public can view imoveis" ON public.imoveis FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Approved can insert imoveis" ON public.imoveis FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update imoveis" ON public.imoveis FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid())) WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete imoveis" ON public.imoveis FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- IMOVEIS_MERCADO
DROP POLICY IF EXISTS "Approved can select imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Approved can insert imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Approved can delete imoveis_mercado" ON public.imoveis_mercado;
CREATE POLICY "Approved can select imoveis_mercado" ON public.imoveis_mercado FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert imoveis_mercado" ON public.imoveis_mercado FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete imoveis_mercado" ON public.imoveis_mercado FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- LEAD_ATIVIDADES
DROP POLICY IF EXISTS "Approved can select lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Approved can insert lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Approved can delete lead_atividades" ON public.lead_atividades;
CREATE POLICY "Approved can select lead_atividades" ON public.lead_atividades FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert lead_atividades" ON public.lead_atividades FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete lead_atividades" ON public.lead_atividades FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- LEADS
DROP POLICY IF EXISTS "Approved can select leads" ON public.leads;
DROP POLICY IF EXISTS "Approved can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Approved can update leads" ON public.leads;
DROP POLICY IF EXISTS "Approved can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Public can insert leads via portal" ON public.leads;
CREATE POLICY "Approved can select leads" ON public.leads FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update leads" ON public.leads FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete leads" ON public.leads FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Public can insert leads via portal" ON public.leads FOR INSERT TO anon WITH CHECK (true);

-- MENSAGEM_TEMPLATES
DROP POLICY IF EXISTS "Approved can select mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Approved can insert mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Approved can update mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Approved can delete mensagem_templates" ON public.mensagem_templates;
CREATE POLICY "Approved can select mensagem_templates" ON public.mensagem_templates FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert mensagem_templates" ON public.mensagem_templates FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update mensagem_templates" ON public.mensagem_templates FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete mensagem_templates" ON public.mensagem_templates FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- MODULO_CONFIG
DROP POLICY IF EXISTS "Authenticated can select modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master can insert modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master can update modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master can delete modulo_config" ON public.modulo_config;
CREATE POLICY "Authenticated can select modulo_config" ON public.modulo_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master can insert modulo_config" ON public.modulo_config FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()));
CREATE POLICY "Master can update modulo_config" ON public.modulo_config FOR UPDATE TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "Master can delete modulo_config" ON public.modulo_config FOR DELETE TO authenticated USING (is_master(auth.uid()));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can select own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can select own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PROFILES
DROP POLICY IF EXISTS "Users and master can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and master can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users and master can view profiles" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));
CREATE POLICY "Users and master can update profiles" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = id);

-- PROPRIETARIOS
DROP POLICY IF EXISTS "Approved can select proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Approved can insert proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Approved can update proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Approved can delete proprietarios" ON public.proprietarios;
CREATE POLICY "Approved can select proprietarios" ON public.proprietarios FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert proprietarios" ON public.proprietarios FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update proprietarios" ON public.proprietarios FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete proprietarios" ON public.proprietarios FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- TRANSACOES
DROP POLICY IF EXISTS "Approved can select transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Approved can insert transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Approved can update transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Approved can delete transacoes" ON public.transacoes;
CREATE POLICY "Approved can select transacoes" ON public.transacoes FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can insert transacoes" ON public.transacoes FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can update transacoes" ON public.transacoes FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved can delete transacoes" ON public.transacoes FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
