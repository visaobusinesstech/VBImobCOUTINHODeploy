
-- Fix ALL RLS policies to be PERMISSIVE instead of RESTRICTIVE
-- This is critical for data loading across the entire application

-- ============ automacoes ============
DROP POLICY IF EXISTS "Approved delete automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Approved insert automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Approved select automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Approved update automacoes" ON public.automacoes;

CREATE POLICY "automacoes_select" ON public.automacoes FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "automacoes_insert" ON public.automacoes FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "automacoes_update" ON public.automacoes FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "automacoes_delete" ON public.automacoes FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ clientes_relacionamento ============
DROP POLICY IF EXISTS "Approved delete clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Approved insert clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Approved select clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Approved update clientes_relacionamento" ON public.clientes_relacionamento;

CREATE POLICY "clientes_rel_select" ON public.clientes_relacionamento FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "clientes_rel_insert" ON public.clientes_relacionamento FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "clientes_rel_update" ON public.clientes_relacionamento FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "clientes_rel_delete" ON public.clientes_relacionamento FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ compromissos ============
DROP POLICY IF EXISTS "Approved delete compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Approved insert compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Approved select compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Approved update compromissos" ON public.compromissos;

CREATE POLICY "compromissos_select" ON public.compromissos FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "compromissos_insert" ON public.compromissos FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "compromissos_update" ON public.compromissos FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "compromissos_delete" ON public.compromissos FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ contatos_landing ============
DROP POLICY IF EXISTS "Anyone submit contact" ON public.contatos_landing;
DROP POLICY IF EXISTS "Master read contacts" ON public.contatos_landing;
DROP POLICY IF EXISTS "Master update contacts" ON public.contatos_landing;

CREATE POLICY "contatos_anon_insert" ON public.contatos_landing FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "contatos_auth_insert" ON public.contatos_landing FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contatos_select" ON public.contatos_landing FOR SELECT TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "contatos_update" ON public.contatos_landing FOR UPDATE TO authenticated USING (is_master(auth.uid()));

-- ============ contratos ============
DROP POLICY IF EXISTS "Approved delete contratos" ON public.contratos;
DROP POLICY IF EXISTS "Approved insert contratos" ON public.contratos;
DROP POLICY IF EXISTS "Approved select contratos" ON public.contratos;
DROP POLICY IF EXISTS "Approved update contratos" ON public.contratos;

CREATE POLICY "contratos_select" ON public.contratos FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "contratos_insert" ON public.contratos FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "contratos_update" ON public.contratos FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "contratos_delete" ON public.contratos FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ corretor_permissoes ============
DROP POLICY IF EXISTS "Approved delete permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Approved insert permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Approved select permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Approved update permissoes" ON public.corretor_permissoes;

CREATE POLICY "permissoes_select" ON public.corretor_permissoes FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "permissoes_insert" ON public.corretor_permissoes FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "permissoes_update" ON public.corretor_permissoes FOR UPDATE TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "permissoes_delete" ON public.corretor_permissoes FOR DELETE TO authenticated USING (is_approved(auth.uid()));

-- ============ corretores ============
DROP POLICY IF EXISTS "Approved delete corretores" ON public.corretores;
DROP POLICY IF EXISTS "Approved insert corretores" ON public.corretores;
DROP POLICY IF EXISTS "Approved select corretores" ON public.corretores;
DROP POLICY IF EXISTS "Approved update corretores" ON public.corretores;

CREATE POLICY "corretores_select" ON public.corretores FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "corretores_insert" ON public.corretores FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "corretores_update" ON public.corretores FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "corretores_delete" ON public.corretores FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ followups ============
DROP POLICY IF EXISTS "Approved delete followups" ON public.followups;
DROP POLICY IF EXISTS "Approved insert followups" ON public.followups;
DROP POLICY IF EXISTS "Approved select followups" ON public.followups;
DROP POLICY IF EXISTS "Approved update followups" ON public.followups;

CREATE POLICY "followups_select" ON public.followups FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "followups_insert" ON public.followups FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "followups_update" ON public.followups FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "followups_delete" ON public.followups FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ imobiliaria_config ============
DROP POLICY IF EXISTS "Users insert own config" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "Users update own config" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "Users view own config" ON public.imobiliaria_config;

CREATE POLICY "config_select" ON public.imobiliaria_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "config_insert" ON public.imobiliaria_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "config_update" ON public.imobiliaria_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ imoveis ============
DROP POLICY IF EXISTS "Approved delete imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Approved insert imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Approved update imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Public view imoveis" ON public.imoveis;

CREATE POLICY "imoveis_public_select" ON public.imoveis FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "imoveis_insert" ON public.imoveis FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "imoveis_update" ON public.imoveis FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "imoveis_delete" ON public.imoveis FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ imoveis_mercado ============
DROP POLICY IF EXISTS "Approved delete imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Approved insert imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Approved select imoveis_mercado" ON public.imoveis_mercado;

CREATE POLICY "imoveis_mercado_select" ON public.imoveis_mercado FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "imoveis_mercado_insert" ON public.imoveis_mercado FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "imoveis_mercado_delete" ON public.imoveis_mercado FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ lead_atividades ============
DROP POLICY IF EXISTS "Approved delete lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Approved insert lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Approved select lead_atividades" ON public.lead_atividades;

CREATE POLICY "lead_atividades_select" ON public.lead_atividades FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "lead_atividades_insert" ON public.lead_atividades FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "lead_atividades_delete" ON public.lead_atividades FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ leads ============
DROP POLICY IF EXISTS "Approved delete leads" ON public.leads;
DROP POLICY IF EXISTS "Approved insert leads" ON public.leads;
DROP POLICY IF EXISTS "Approved select leads" ON public.leads;
DROP POLICY IF EXISTS "Approved update leads" ON public.leads;
DROP POLICY IF EXISTS "Public insert leads portal" ON public.leads;

CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "leads_anon_insert" ON public.leads FOR INSERT TO anon WITH CHECK (true);

-- ============ mensagem_templates ============
DROP POLICY IF EXISTS "Approved delete mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Approved insert mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Approved select mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Approved update mensagem_templates" ON public.mensagem_templates;

CREATE POLICY "templates_select" ON public.mensagem_templates FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "templates_insert" ON public.mensagem_templates FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "templates_update" ON public.mensagem_templates FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "templates_delete" ON public.mensagem_templates FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ mensagens_whatsapp ============
DROP POLICY IF EXISTS "Approved delete mensagens_whatsapp" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Approved insert mensagens_whatsapp" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Approved select mensagens_whatsapp" ON public.mensagens_whatsapp;

CREATE POLICY "whatsapp_select" ON public.mensagens_whatsapp FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "whatsapp_insert" ON public.mensagens_whatsapp FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "whatsapp_delete" ON public.mensagens_whatsapp FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ modulo_config ============
DROP POLICY IF EXISTS "Auth select modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master delete modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master insert modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master update modulo_config" ON public.modulo_config;

CREATE POLICY "modulo_config_select" ON public.modulo_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "modulo_config_insert" ON public.modulo_config FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()));
CREATE POLICY "modulo_config_update" ON public.modulo_config FOR UPDATE TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "modulo_config_delete" ON public.modulo_config FOR DELETE TO authenticated USING (is_master(auth.uid()));

-- ============ notifications ============
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users select own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;

CREATE POLICY "notif_select" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ profiles ============
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users master update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users master view profiles" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));

-- ============ proprietarios ============
DROP POLICY IF EXISTS "Approved delete proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Approved insert proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Approved select proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Approved update proprietarios" ON public.proprietarios;

CREATE POLICY "proprietarios_select" ON public.proprietarios FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "proprietarios_insert" ON public.proprietarios FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "proprietarios_update" ON public.proprietarios FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "proprietarios_delete" ON public.proprietarios FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- ============ transacoes ============
DROP POLICY IF EXISTS "Approved delete transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Approved insert transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Approved select transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Approved update transacoes" ON public.transacoes;

CREATE POLICY "transacoes_select" ON public.transacoes FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "transacoes_insert" ON public.transacoes FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "transacoes_update" ON public.transacoes FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "transacoes_delete" ON public.transacoes FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
