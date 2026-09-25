
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE for core tables

-- AUTOMACOES
DROP POLICY IF EXISTS "Approved delete automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Approved insert automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Approved select automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Approved update automacoes" ON public.automacoes;
CREATE POLICY "Approved select automacoes" ON public.automacoes FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert automacoes" ON public.automacoes FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update automacoes" ON public.automacoes FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete automacoes" ON public.automacoes FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- CLIENTES_RELACIONAMENTO
DROP POLICY IF EXISTS "Approved delete clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Approved insert clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Approved select clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Approved update clientes_relacionamento" ON public.clientes_relacionamento;
CREATE POLICY "Approved select clientes_relacionamento" ON public.clientes_relacionamento FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert clientes_relacionamento" ON public.clientes_relacionamento FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update clientes_relacionamento" ON public.clientes_relacionamento FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete clientes_relacionamento" ON public.clientes_relacionamento FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- COMPROMISSOS
DROP POLICY IF EXISTS "Approved delete compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Approved insert compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Approved select compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Approved update compromissos" ON public.compromissos;
CREATE POLICY "Approved select compromissos" ON public.compromissos FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert compromissos" ON public.compromissos FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update compromissos" ON public.compromissos FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete compromissos" ON public.compromissos FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- CONTATOS_LANDING
DROP POLICY IF EXISTS "Anyone submit contact" ON public.contatos_landing;
DROP POLICY IF EXISTS "Master read contacts" ON public.contatos_landing;
DROP POLICY IF EXISTS "Master update contacts" ON public.contatos_landing;
CREATE POLICY "Anyone submit contact" ON public.contatos_landing FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Master read contacts" ON public.contatos_landing FOR SELECT TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "Master update contacts" ON public.contatos_landing FOR UPDATE TO authenticated USING (is_master(auth.uid()));

-- CONTRATOS
DROP POLICY IF EXISTS "Approved delete contratos" ON public.contratos;
DROP POLICY IF EXISTS "Approved insert contratos" ON public.contratos;
DROP POLICY IF EXISTS "Approved select contratos" ON public.contratos;
DROP POLICY IF EXISTS "Approved update contratos" ON public.contratos;
CREATE POLICY "Approved select contratos" ON public.contratos FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update contratos" ON public.contratos FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete contratos" ON public.contratos FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- CORRETOR_PERMISSOES
DROP POLICY IF EXISTS "Approved delete permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Approved insert permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Approved select permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Approved update permissoes" ON public.corretor_permissoes;
CREATE POLICY "Approved select permissoes" ON public.corretor_permissoes FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved insert permissoes" ON public.corretor_permissoes FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved update permissoes" ON public.corretor_permissoes FOR UPDATE TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved delete permissoes" ON public.corretor_permissoes FOR DELETE TO authenticated USING (is_approved(auth.uid()));

-- CORRETORES
DROP POLICY IF EXISTS "Approved delete corretores" ON public.corretores;
DROP POLICY IF EXISTS "Approved insert corretores" ON public.corretores;
DROP POLICY IF EXISTS "Approved select corretores" ON public.corretores;
DROP POLICY IF EXISTS "Approved update corretores" ON public.corretores;
CREATE POLICY "Approved select corretores" ON public.corretores FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert corretores" ON public.corretores FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update corretores" ON public.corretores FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete corretores" ON public.corretores FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- FOLLOWUPS
DROP POLICY IF EXISTS "Approved delete followups" ON public.followups;
DROP POLICY IF EXISTS "Approved insert followups" ON public.followups;
DROP POLICY IF EXISTS "Approved select followups" ON public.followups;
DROP POLICY IF EXISTS "Approved update followups" ON public.followups;
CREATE POLICY "Approved select followups" ON public.followups FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert followups" ON public.followups FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update followups" ON public.followups FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete followups" ON public.followups FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- IMOBILIARIA_CONFIG
DROP POLICY IF EXISTS "Users insert own config" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "Users update own config" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "Users view own config" ON public.imobiliaria_config;
CREATE POLICY "Users view own config" ON public.imobiliaria_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own config" ON public.imobiliaria_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own config" ON public.imobiliaria_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- IMOVEIS
DROP POLICY IF EXISTS "Approved delete imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Approved insert imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Approved update imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Public view imoveis" ON public.imoveis;
CREATE POLICY "Public view imoveis" ON public.imoveis FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Approved insert imoveis" ON public.imoveis FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update imoveis" ON public.imoveis FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid())) WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete imoveis" ON public.imoveis FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- IMOVEIS_MERCADO
DROP POLICY IF EXISTS "Approved delete imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Approved insert imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Approved select imoveis_mercado" ON public.imoveis_mercado;
CREATE POLICY "Approved select imoveis_mercado" ON public.imoveis_mercado FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert imoveis_mercado" ON public.imoveis_mercado FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete imoveis_mercado" ON public.imoveis_mercado FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- LEAD_ATIVIDADES
DROP POLICY IF EXISTS "Approved delete lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Approved insert lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Approved select lead_atividades" ON public.lead_atividades;
CREATE POLICY "Approved select lead_atividades" ON public.lead_atividades FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert lead_atividades" ON public.lead_atividades FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete lead_atividades" ON public.lead_atividades FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- LEADS
DROP POLICY IF EXISTS "Approved delete leads" ON public.leads;
DROP POLICY IF EXISTS "Approved insert leads" ON public.leads;
DROP POLICY IF EXISTS "Approved select leads" ON public.leads;
DROP POLICY IF EXISTS "Approved update leads" ON public.leads;
DROP POLICY IF EXISTS "Public insert leads portal" ON public.leads;
CREATE POLICY "Approved select leads" ON public.leads FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update leads" ON public.leads FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete leads" ON public.leads FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Public insert leads portal" ON public.leads FOR INSERT TO anon WITH CHECK (true);

-- MENSAGEM_TEMPLATES
DROP POLICY IF EXISTS "Approved delete mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Approved insert mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Approved select mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Approved update mensagem_templates" ON public.mensagem_templates;
CREATE POLICY "Approved select mensagem_templates" ON public.mensagem_templates FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert mensagem_templates" ON public.mensagem_templates FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update mensagem_templates" ON public.mensagem_templates FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete mensagem_templates" ON public.mensagem_templates FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- MENSAGENS_WHATSAPP
DROP POLICY IF EXISTS "Approved delete mensagens_whatsapp" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Approved insert mensagens_whatsapp" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Approved select mensagens_whatsapp" ON public.mensagens_whatsapp;
CREATE POLICY "Approved select mensagens_whatsapp" ON public.mensagens_whatsapp FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert mensagens_whatsapp" ON public.mensagens_whatsapp FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete mensagens_whatsapp" ON public.mensagens_whatsapp FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- MODULO_CONFIG
DROP POLICY IF EXISTS "Auth select modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master delete modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master insert modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master update modulo_config" ON public.modulo_config;
CREATE POLICY "Auth select modulo_config" ON public.modulo_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master insert modulo_config" ON public.modulo_config FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()));
CREATE POLICY "Master update modulo_config" ON public.modulo_config FOR UPDATE TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "Master delete modulo_config" ON public.modulo_config FOR DELETE TO authenticated USING (is_master(auth.uid()));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users select own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users select own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PROFILES
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users master update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users master view profiles" ON public.profiles;
CREATE POLICY "Users master view profiles" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = id);
CREATE POLICY "Users master update profiles" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));

-- PROPRIETARIOS
DROP POLICY IF EXISTS "Approved delete proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Approved insert proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Approved select proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Approved update proprietarios" ON public.proprietarios;
CREATE POLICY "Approved select proprietarios" ON public.proprietarios FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert proprietarios" ON public.proprietarios FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update proprietarios" ON public.proprietarios FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete proprietarios" ON public.proprietarios FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- TRANSACOES
DROP POLICY IF EXISTS "Approved delete transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Approved insert transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Approved select transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Approved update transacoes" ON public.transacoes;
CREATE POLICY "Approved select transacoes" ON public.transacoes FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved insert transacoes" ON public.transacoes FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved update transacoes" ON public.transacoes FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "Approved delete transacoes" ON public.transacoes FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
