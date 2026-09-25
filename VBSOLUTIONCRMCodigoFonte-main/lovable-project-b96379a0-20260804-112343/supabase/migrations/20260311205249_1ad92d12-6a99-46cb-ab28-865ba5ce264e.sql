
-- Drop ALL restrictive policies and recreate as permissive

-- AUTOMACOES
DROP POLICY IF EXISTS "automacoes_select" ON public.automacoes;
DROP POLICY IF EXISTS "automacoes_insert" ON public.automacoes;
DROP POLICY IF EXISTS "automacoes_update" ON public.automacoes;
DROP POLICY IF EXISTS "automacoes_delete" ON public.automacoes;
CREATE POLICY "automacoes_select" ON public.automacoes AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "automacoes_insert" ON public.automacoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "automacoes_update" ON public.automacoes AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "automacoes_delete" ON public.automacoes AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- CLIENTES_RELACIONAMENTO
DROP POLICY IF EXISTS "clientes_rel_select" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "clientes_rel_insert" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "clientes_rel_update" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "clientes_rel_delete" ON public.clientes_relacionamento;
CREATE POLICY "clientes_rel_select" ON public.clientes_relacionamento AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "clientes_rel_insert" ON public.clientes_relacionamento AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "clientes_rel_update" ON public.clientes_relacionamento AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "clientes_rel_delete" ON public.clientes_relacionamento AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- COMPROMISSOS
DROP POLICY IF EXISTS "compromissos_select" ON public.compromissos;
DROP POLICY IF EXISTS "compromissos_insert" ON public.compromissos;
DROP POLICY IF EXISTS "compromissos_update" ON public.compromissos;
DROP POLICY IF EXISTS "compromissos_delete" ON public.compromissos;
CREATE POLICY "compromissos_select" ON public.compromissos AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "compromissos_insert" ON public.compromissos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "compromissos_update" ON public.compromissos AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "compromissos_delete" ON public.compromissos AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- CONTATOS_LANDING
DROP POLICY IF EXISTS "contatos_anon_insert" ON public.contatos_landing;
DROP POLICY IF EXISTS "contatos_auth_insert" ON public.contatos_landing;
DROP POLICY IF EXISTS "contatos_select" ON public.contatos_landing;
DROP POLICY IF EXISTS "contatos_update" ON public.contatos_landing;
CREATE POLICY "contatos_anon_insert" ON public.contatos_landing AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "contatos_auth_insert" ON public.contatos_landing AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contatos_select" ON public.contatos_landing AS PERMISSIVE FOR SELECT TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "contatos_update" ON public.contatos_landing AS PERMISSIVE FOR UPDATE TO authenticated USING (is_master(auth.uid()));

-- CONTRATOS
DROP POLICY IF EXISTS "contratos_select" ON public.contratos;
DROP POLICY IF EXISTS "contratos_insert" ON public.contratos;
DROP POLICY IF EXISTS "contratos_update" ON public.contratos;
DROP POLICY IF EXISTS "contratos_delete" ON public.contratos;
CREATE POLICY "contratos_select" ON public.contratos AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "contratos_insert" ON public.contratos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "contratos_update" ON public.contratos AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "contratos_delete" ON public.contratos AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- CORRETOR_PERMISSOES
DROP POLICY IF EXISTS "permissoes_select" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "permissoes_insert" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "permissoes_update" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "permissoes_delete" ON public.corretor_permissoes;
CREATE POLICY "permissoes_select" ON public.corretor_permissoes AS PERMISSIVE FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "permissoes_insert" ON public.corretor_permissoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "permissoes_update" ON public.corretor_permissoes AS PERMISSIVE FOR UPDATE TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "permissoes_delete" ON public.corretor_permissoes AS PERMISSIVE FOR DELETE TO authenticated USING (is_approved(auth.uid()));

-- CORRETORES
DROP POLICY IF EXISTS "corretores_select" ON public.corretores;
DROP POLICY IF EXISTS "corretores_insert" ON public.corretores;
DROP POLICY IF EXISTS "corretores_update" ON public.corretores;
DROP POLICY IF EXISTS "corretores_delete" ON public.corretores;
CREATE POLICY "corretores_select" ON public.corretores AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "corretores_insert" ON public.corretores AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "corretores_update" ON public.corretores AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "corretores_delete" ON public.corretores AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- FOLLOWUPS
DROP POLICY IF EXISTS "followups_select" ON public.followups;
DROP POLICY IF EXISTS "followups_insert" ON public.followups;
DROP POLICY IF EXISTS "followups_update" ON public.followups;
DROP POLICY IF EXISTS "followups_delete" ON public.followups;
CREATE POLICY "followups_select" ON public.followups AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "followups_insert" ON public.followups AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "followups_update" ON public.followups AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "followups_delete" ON public.followups AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- IMOBILIARIA_CONFIG
DROP POLICY IF EXISTS "config_select" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "config_insert" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "config_update" ON public.imobiliaria_config;
CREATE POLICY "config_select" ON public.imobiliaria_config AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "config_insert" ON public.imobiliaria_config AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "config_update" ON public.imobiliaria_config AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- IMOVEIS
DROP POLICY IF EXISTS "imoveis_public_select" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_insert" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_update" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_delete" ON public.imoveis;
CREATE POLICY "imoveis_public_select" ON public.imoveis AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "imoveis_insert" ON public.imoveis AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "imoveis_update" ON public.imoveis AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "imoveis_delete" ON public.imoveis AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- IMOVEIS_MERCADO
DROP POLICY IF EXISTS "imoveis_mercado_select" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "imoveis_mercado_insert" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "imoveis_mercado_delete" ON public.imoveis_mercado;
CREATE POLICY "imoveis_mercado_select" ON public.imoveis_mercado AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "imoveis_mercado_insert" ON public.imoveis_mercado AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "imoveis_mercado_delete" ON public.imoveis_mercado AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- LEAD_ATIVIDADES
DROP POLICY IF EXISTS "lead_atividades_select" ON public.lead_atividades;
DROP POLICY IF EXISTS "lead_atividades_insert" ON public.lead_atividades;
DROP POLICY IF EXISTS "lead_atividades_delete" ON public.lead_atividades;
CREATE POLICY "lead_atividades_select" ON public.lead_atividades AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "lead_atividades_insert" ON public.lead_atividades AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "lead_atividades_delete" ON public.lead_atividades AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- LEADS
DROP POLICY IF EXISTS "leads_anon_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_anon_insert" ON public.leads AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "leads_select" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "leads_insert" ON public.leads AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "leads_update" ON public.leads AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "leads_delete" ON public.leads AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- MENSAGEM_TEMPLATES
DROP POLICY IF EXISTS "templates_select" ON public.mensagem_templates;
DROP POLICY IF EXISTS "templates_insert" ON public.mensagem_templates;
DROP POLICY IF EXISTS "templates_update" ON public.mensagem_templates;
DROP POLICY IF EXISTS "templates_delete" ON public.mensagem_templates;
CREATE POLICY "templates_select" ON public.mensagem_templates AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "templates_insert" ON public.mensagem_templates AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "templates_update" ON public.mensagem_templates AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "templates_delete" ON public.mensagem_templates AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- MENSAGENS_WHATSAPP
DROP POLICY IF EXISTS "whatsapp_select" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "whatsapp_insert" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "whatsapp_delete" ON public.mensagens_whatsapp;
CREATE POLICY "whatsapp_select" ON public.mensagens_whatsapp AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "whatsapp_insert" ON public.mensagens_whatsapp AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "whatsapp_delete" ON public.mensagens_whatsapp AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- MODULO_CONFIG
DROP POLICY IF EXISTS "modulo_config_select" ON public.modulo_config;
DROP POLICY IF EXISTS "modulo_config_insert" ON public.modulo_config;
DROP POLICY IF EXISTS "modulo_config_update" ON public.modulo_config;
DROP POLICY IF EXISTS "modulo_config_delete" ON public.modulo_config;
CREATE POLICY "modulo_config_select" ON public.modulo_config AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "modulo_config_insert" ON public.modulo_config AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()));
CREATE POLICY "modulo_config_update" ON public.modulo_config AS PERMISSIVE FOR UPDATE TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "modulo_config_delete" ON public.modulo_config AS PERMISSIVE FOR DELETE TO authenticated USING (is_master(auth.uid()));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
DROP POLICY IF EXISTS "notif_delete" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert" ON public.notifications AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_update" ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_delete" ON public.notifications AS PERMISSIVE FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PROFILES
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));
CREATE POLICY "profiles_insert" ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));

-- PROPRIETARIOS
DROP POLICY IF EXISTS "proprietarios_select" ON public.proprietarios;
DROP POLICY IF EXISTS "proprietarios_insert" ON public.proprietarios;
DROP POLICY IF EXISTS "proprietarios_update" ON public.proprietarios;
DROP POLICY IF EXISTS "proprietarios_delete" ON public.proprietarios;
CREATE POLICY "proprietarios_select" ON public.proprietarios AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "proprietarios_insert" ON public.proprietarios AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "proprietarios_update" ON public.proprietarios AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "proprietarios_delete" ON public.proprietarios AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- TRANSACOES
DROP POLICY IF EXISTS "transacoes_select" ON public.transacoes;
DROP POLICY IF EXISTS "transacoes_insert" ON public.transacoes;
DROP POLICY IF EXISTS "transacoes_update" ON public.transacoes;
DROP POLICY IF EXISTS "transacoes_delete" ON public.transacoes;
CREATE POLICY "transacoes_select" ON public.transacoes AS PERMISSIVE FOR SELECT TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "transacoes_insert" ON public.transacoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "transacoes_update" ON public.transacoes AS PERMISSIVE FOR UPDATE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
CREATE POLICY "transacoes_delete" ON public.transacoes AS PERMISSIVE FOR DELETE TO authenticated USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));
