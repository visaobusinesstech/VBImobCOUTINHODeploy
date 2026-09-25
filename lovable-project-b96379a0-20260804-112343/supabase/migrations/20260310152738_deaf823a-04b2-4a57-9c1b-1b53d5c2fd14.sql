
-- Fix ALL RLS policies from RESTRICTIVE to PERMISSIVE across all tables

-- ============ profiles ============
DROP POLICY IF EXISTS "Users and master can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and master can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users and master can view profiles" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));
CREATE POLICY "Users and master can update profiles" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id) OR is_master(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = id);

-- ============ leads ============
DROP POLICY IF EXISTS "Owner can select leads" ON public.leads;
DROP POLICY IF EXISTS "Owner can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Owner can update leads" ON public.leads;
DROP POLICY IF EXISTS "Owner can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Public can insert leads via portal" ON public.leads;

CREATE POLICY "Owner can select leads" ON public.leads FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update leads" ON public.leads FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete leads" ON public.leads FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Public can insert leads via portal" ON public.leads FOR INSERT TO anon WITH CHECK (true);

-- ============ followups ============
DROP POLICY IF EXISTS "Owner can select followups" ON public.followups;
DROP POLICY IF EXISTS "Owner can insert followups" ON public.followups;
DROP POLICY IF EXISTS "Owner can update followups" ON public.followups;
DROP POLICY IF EXISTS "Owner can delete followups" ON public.followups;

CREATE POLICY "Owner can select followups" ON public.followups FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert followups" ON public.followups FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update followups" ON public.followups FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete followups" ON public.followups FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ lead_atividades ============
DROP POLICY IF EXISTS "Owner can select lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Owner can insert lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Owner can delete lead_atividades" ON public.lead_atividades;

CREATE POLICY "Owner can select lead_atividades" ON public.lead_atividades FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert lead_atividades" ON public.lead_atividades FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete lead_atividades" ON public.lead_atividades FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ corretores ============
DROP POLICY IF EXISTS "Owner can select corretores" ON public.corretores;
DROP POLICY IF EXISTS "Owner can insert corretores" ON public.corretores;
DROP POLICY IF EXISTS "Owner can update corretores" ON public.corretores;
DROP POLICY IF EXISTS "Owner can delete corretores" ON public.corretores;

CREATE POLICY "Owner can select corretores" ON public.corretores FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert corretores" ON public.corretores FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update corretores" ON public.corretores FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete corretores" ON public.corretores FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ compromissos ============
DROP POLICY IF EXISTS "Owner can select compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Owner can insert compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Owner can update compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Owner can delete compromissos" ON public.compromissos;

CREATE POLICY "Owner can select compromissos" ON public.compromissos FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert compromissos" ON public.compromissos FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update compromissos" ON public.compromissos FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete compromissos" ON public.compromissos FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ imoveis ============
DROP POLICY IF EXISTS "Public can view imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Owner can insert imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Owner can update imoveis" ON public.imoveis;
DROP POLICY IF EXISTS "Owner can delete imoveis" ON public.imoveis;

CREATE POLICY "Public can view imoveis" ON public.imoveis FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owner can insert imoveis" ON public.imoveis FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update imoveis" ON public.imoveis FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id) WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete imoveis" ON public.imoveis FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ contratos ============
DROP POLICY IF EXISTS "Owner can select contratos" ON public.contratos;
DROP POLICY IF EXISTS "Owner can insert contratos" ON public.contratos;
DROP POLICY IF EXISTS "Owner can update contratos" ON public.contratos;
DROP POLICY IF EXISTS "Owner can delete contratos" ON public.contratos;

CREATE POLICY "Owner can select contratos" ON public.contratos FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update contratos" ON public.contratos FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete contratos" ON public.contratos FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ transacoes ============
DROP POLICY IF EXISTS "Owner can select transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Owner can insert transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Owner can update transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Owner can delete transacoes" ON public.transacoes;

CREATE POLICY "Owner can select transacoes" ON public.transacoes FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert transacoes" ON public.transacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update transacoes" ON public.transacoes FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete transacoes" ON public.transacoes FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ automacoes ============
DROP POLICY IF EXISTS "Owner can select automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Owner can insert automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Owner can update automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "Owner can delete automacoes" ON public.automacoes;

CREATE POLICY "Owner can select automacoes" ON public.automacoes FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert automacoes" ON public.automacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update automacoes" ON public.automacoes FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete automacoes" ON public.automacoes FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ clientes_relacionamento ============
DROP POLICY IF EXISTS "Owner can select clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Owner can insert clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Owner can update clientes_relacionamento" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "Owner can delete clientes_relacionamento" ON public.clientes_relacionamento;

CREATE POLICY "Owner can select clientes_relacionamento" ON public.clientes_relacionamento FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert clientes_relacionamento" ON public.clientes_relacionamento FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update clientes_relacionamento" ON public.clientes_relacionamento FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete clientes_relacionamento" ON public.clientes_relacionamento FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ mensagem_templates ============
DROP POLICY IF EXISTS "Owner can select mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Owner can insert mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Owner can update mensagem_templates" ON public.mensagem_templates;
DROP POLICY IF EXISTS "Owner can delete mensagem_templates" ON public.mensagem_templates;

CREATE POLICY "Owner can select mensagem_templates" ON public.mensagem_templates FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert mensagem_templates" ON public.mensagem_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update mensagem_templates" ON public.mensagem_templates FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete mensagem_templates" ON public.mensagem_templates FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ proprietarios ============
DROP POLICY IF EXISTS "Owner can select proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Owner can insert proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Owner can update proprietarios" ON public.proprietarios;
DROP POLICY IF EXISTS "Owner can delete proprietarios" ON public.proprietarios;

CREATE POLICY "Owner can select proprietarios" ON public.proprietarios FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert proprietarios" ON public.proprietarios FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update proprietarios" ON public.proprietarios FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete proprietarios" ON public.proprietarios FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ imoveis_mercado ============
DROP POLICY IF EXISTS "Owner can select imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Owner can insert imoveis_mercado" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "Owner can delete imoveis_mercado" ON public.imoveis_mercado;

CREATE POLICY "Owner can select imoveis_mercado" ON public.imoveis_mercado FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert imoveis_mercado" ON public.imoveis_mercado FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete imoveis_mercado" ON public.imoveis_mercado FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- ============ modulo_config ============
DROP POLICY IF EXISTS "Authenticated can select modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master can insert modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master can update modulo_config" ON public.modulo_config;
DROP POLICY IF EXISTS "Master can delete modulo_config" ON public.modulo_config;

CREATE POLICY "Authenticated can select modulo_config" ON public.modulo_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master can insert modulo_config" ON public.modulo_config FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()));
CREATE POLICY "Master can update modulo_config" ON public.modulo_config FOR UPDATE TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "Master can delete modulo_config" ON public.modulo_config FOR DELETE TO authenticated USING (is_master(auth.uid()));

-- ============ imobiliaria_config ============
DROP POLICY IF EXISTS "Users can view own config" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "Users can insert own config" ON public.imobiliaria_config;
DROP POLICY IF EXISTS "Users can update own config" ON public.imobiliaria_config;

CREATE POLICY "Users can view own config" ON public.imobiliaria_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own config" ON public.imobiliaria_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own config" ON public.imobiliaria_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ notifications ============
DROP POLICY IF EXISTS "Users can select own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can select own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ contatos_landing ============
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contatos_landing;
DROP POLICY IF EXISTS "Master can read contacts" ON public.contatos_landing;
DROP POLICY IF EXISTS "Master can update contacts" ON public.contatos_landing;

CREATE POLICY "Anyone can submit contact form" ON public.contatos_landing FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Master can read contacts" ON public.contatos_landing FOR SELECT TO authenticated USING (is_master(auth.uid()));
CREATE POLICY "Master can update contacts" ON public.contatos_landing FOR UPDATE TO authenticated USING (is_master(auth.uid()));

-- ============ corretor_permissoes ============
DROP POLICY IF EXISTS "Owner can select permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Owner can insert permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Owner can update permissoes" ON public.corretor_permissoes;
DROP POLICY IF EXISTS "Owner can delete permissoes" ON public.corretor_permissoes;

CREATE POLICY "Owner can select permissoes" ON public.corretor_permissoes FOR SELECT TO authenticated USING (owns_corretor(corretor_id));
CREATE POLICY "Owner can insert permissoes" ON public.corretor_permissoes FOR INSERT TO authenticated WITH CHECK (owns_corretor(corretor_id));
CREATE POLICY "Owner can update permissoes" ON public.corretor_permissoes FOR UPDATE TO authenticated USING (owns_corretor(corretor_id));
CREATE POLICY "Owner can delete permissoes" ON public.corretor_permissoes FOR DELETE TO authenticated USING (owns_corretor(corretor_id));
