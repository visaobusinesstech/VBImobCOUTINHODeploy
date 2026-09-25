
-- ============================================================
-- ATUALIZAR RLS DE TODAS AS TABELAS COM imobiliaria_id
-- SELECT: can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid())
-- INSERT: imobiliaria_id = auth.uid() AND is_approved(auth.uid())
-- UPDATE/DELETE: imobiliaria_id = auth.uid() AND is_approved(auth.uid())
-- ============================================================

-- 1. automacoes
DROP POLICY IF EXISTS "automacoes_select" ON public.automacoes;
DROP POLICY IF EXISTS "automacoes_insert" ON public.automacoes;
DROP POLICY IF EXISTS "automacoes_update" ON public.automacoes;
DROP POLICY IF EXISTS "automacoes_delete" ON public.automacoes;

CREATE POLICY "automacoes_select" ON public.automacoes FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "automacoes_insert" ON public.automacoes FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "automacoes_update" ON public.automacoes FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "automacoes_delete" ON public.automacoes FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 2. avaliacoes_historico
DROP POLICY IF EXISTS "avaliacoes_historico_select" ON public.avaliacoes_historico;
DROP POLICY IF EXISTS "avaliacoes_historico_insert" ON public.avaliacoes_historico;
DROP POLICY IF EXISTS "avaliacoes_historico_delete" ON public.avaliacoes_historico;

CREATE POLICY "avaliacoes_historico_select" ON public.avaliacoes_historico FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "avaliacoes_historico_insert" ON public.avaliacoes_historico FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "avaliacoes_historico_delete" ON public.avaliacoes_historico FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 3. captacoes
DROP POLICY IF EXISTS "captacoes_select" ON public.captacoes;
DROP POLICY IF EXISTS "captacoes_insert" ON public.captacoes;
DROP POLICY IF EXISTS "captacoes_update" ON public.captacoes;
DROP POLICY IF EXISTS "captacoes_delete" ON public.captacoes;

CREATE POLICY "captacoes_select" ON public.captacoes FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "captacoes_insert" ON public.captacoes FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "captacoes_update" ON public.captacoes FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "captacoes_delete" ON public.captacoes FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 4. clientes_relacionamento
DROP POLICY IF EXISTS "clientes_rel_select" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "clientes_rel_insert" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "clientes_rel_update" ON public.clientes_relacionamento;
DROP POLICY IF EXISTS "clientes_rel_delete" ON public.clientes_relacionamento;

CREATE POLICY "clientes_rel_select" ON public.clientes_relacionamento FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "clientes_rel_insert" ON public.clientes_relacionamento FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "clientes_rel_update" ON public.clientes_relacionamento FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "clientes_rel_delete" ON public.clientes_relacionamento FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 5. compromissos
DROP POLICY IF EXISTS "compromissos_select" ON public.compromissos;
DROP POLICY IF EXISTS "compromissos_insert" ON public.compromissos;
DROP POLICY IF EXISTS "compromissos_update" ON public.compromissos;
DROP POLICY IF EXISTS "compromissos_delete" ON public.compromissos;

CREATE POLICY "compromissos_select" ON public.compromissos FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "compromissos_insert" ON public.compromissos FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "compromissos_update" ON public.compromissos FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "compromissos_delete" ON public.compromissos FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 6. conteudos_seo
DROP POLICY IF EXISTS "conteudos_seo_select" ON public.conteudos_seo;
DROP POLICY IF EXISTS "conteudos_seo_insert" ON public.conteudos_seo;
DROP POLICY IF EXISTS "conteudos_seo_update" ON public.conteudos_seo;
DROP POLICY IF EXISTS "conteudos_seo_delete" ON public.conteudos_seo;

CREATE POLICY "conteudos_seo_select" ON public.conteudos_seo FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "conteudos_seo_insert" ON public.conteudos_seo FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "conteudos_seo_update" ON public.conteudos_seo FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "conteudos_seo_delete" ON public.conteudos_seo FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 7. contratos
DROP POLICY IF EXISTS "contratos_select" ON public.contratos;
DROP POLICY IF EXISTS "contratos_insert" ON public.contratos;
DROP POLICY IF EXISTS "contratos_update" ON public.contratos;
DROP POLICY IF EXISTS "contratos_delete" ON public.contratos;

CREATE POLICY "contratos_select" ON public.contratos FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "contratos_insert" ON public.contratos FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "contratos_update" ON public.contratos FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "contratos_delete" ON public.contratos FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 8. corretores
DROP POLICY IF EXISTS "corretores_select" ON public.corretores;
DROP POLICY IF EXISTS "corretores_insert" ON public.corretores;
DROP POLICY IF EXISTS "corretores_update" ON public.corretores;
DROP POLICY IF EXISTS "corretores_delete" ON public.corretores;

CREATE POLICY "corretores_select" ON public.corretores FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "corretores_insert" ON public.corretores FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "corretores_update" ON public.corretores FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "corretores_delete" ON public.corretores FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 9. followups
DROP POLICY IF EXISTS "followups_select" ON public.followups;
DROP POLICY IF EXISTS "followups_insert" ON public.followups;
DROP POLICY IF EXISTS "followups_update" ON public.followups;
DROP POLICY IF EXISTS "followups_delete" ON public.followups;

CREATE POLICY "followups_select" ON public.followups FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "followups_insert" ON public.followups FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "followups_update" ON public.followups FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "followups_delete" ON public.followups FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 10. imoveis (manter SELECT público para portal)
DROP POLICY IF EXISTS "imoveis_insert" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_update" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_delete" ON public.imoveis;

CREATE POLICY "imoveis_insert" ON public.imoveis FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "imoveis_update" ON public.imoveis FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "imoveis_delete" ON public.imoveis FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 11. imoveis_mercado
DROP POLICY IF EXISTS "imoveis_mercado_select" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "imoveis_mercado_insert" ON public.imoveis_mercado;
DROP POLICY IF EXISTS "imoveis_mercado_delete" ON public.imoveis_mercado;

CREATE POLICY "imoveis_mercado_select" ON public.imoveis_mercado FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "imoveis_mercado_insert" ON public.imoveis_mercado FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "imoveis_mercado_delete" ON public.imoveis_mercado FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 12. lead_atividades
DROP POLICY IF EXISTS "lead_atividades_select" ON public.lead_atividades;
DROP POLICY IF EXISTS "lead_atividades_insert" ON public.lead_atividades;
DROP POLICY IF EXISTS "lead_atividades_delete" ON public.lead_atividades;

CREATE POLICY "lead_atividades_select" ON public.lead_atividades FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "lead_atividades_insert" ON public.lead_atividades FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "lead_atividades_delete" ON public.lead_atividades FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 13. leads (manter INSERT anônimo para portal)
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;

CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 14. mensagem_templates
DROP POLICY IF EXISTS "templates_select" ON public.mensagem_templates;
DROP POLICY IF EXISTS "templates_insert" ON public.mensagem_templates;
DROP POLICY IF EXISTS "templates_update" ON public.mensagem_templates;
DROP POLICY IF EXISTS "templates_delete" ON public.mensagem_templates;

CREATE POLICY "templates_select" ON public.mensagem_templates FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "templates_insert" ON public.mensagem_templates FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "templates_update" ON public.mensagem_templates FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "templates_delete" ON public.mensagem_templates FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 15. mensagens_whatsapp
DROP POLICY IF EXISTS "whatsapp_select" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "whatsapp_insert" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "whatsapp_delete" ON public.mensagens_whatsapp;

CREATE POLICY "whatsapp_select" ON public.mensagens_whatsapp FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "whatsapp_insert" ON public.mensagens_whatsapp FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "whatsapp_delete" ON public.mensagens_whatsapp FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 16. modulo_config (master only para gerenciar)
DROP POLICY IF EXISTS "modulo_config_select" ON public.modulo_config;
DROP POLICY IF EXISTS "modulo_config_insert" ON public.modulo_config;
DROP POLICY IF EXISTS "modulo_config_update" ON public.modulo_config;
DROP POLICY IF EXISTS "modulo_config_delete" ON public.modulo_config;

CREATE POLICY "modulo_config_select" ON public.modulo_config FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) OR is_master(auth.uid()));
CREATE POLICY "modulo_config_insert" ON public.modulo_config FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "modulo_config_update" ON public.modulo_config FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid());
CREATE POLICY "modulo_config_delete" ON public.modulo_config FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid());

-- 17. proprietarios
DROP POLICY IF EXISTS "proprietarios_select" ON public.proprietarios;
DROP POLICY IF EXISTS "proprietarios_insert" ON public.proprietarios;
DROP POLICY IF EXISTS "proprietarios_update" ON public.proprietarios;
DROP POLICY IF EXISTS "proprietarios_delete" ON public.proprietarios;

CREATE POLICY "proprietarios_select" ON public.proprietarios FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "proprietarios_insert" ON public.proprietarios FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "proprietarios_update" ON public.proprietarios FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "proprietarios_delete" ON public.proprietarios FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 18. transacoes
DROP POLICY IF EXISTS "transacoes_select" ON public.transacoes;
DROP POLICY IF EXISTS "transacoes_insert" ON public.transacoes;
DROP POLICY IF EXISTS "transacoes_update" ON public.transacoes;
DROP POLICY IF EXISTS "transacoes_delete" ON public.transacoes;

CREATE POLICY "transacoes_select" ON public.transacoes FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "transacoes_insert" ON public.transacoes FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "transacoes_update" ON public.transacoes FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "transacoes_delete" ON public.transacoes FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));

-- 19. propostas
DROP POLICY IF EXISTS "propostas_select" ON public.propostas;
DROP POLICY IF EXISTS "propostas_insert" ON public.propostas;
DROP POLICY IF EXISTS "propostas_update" ON public.propostas;
DROP POLICY IF EXISTS "propostas_delete" ON public.propostas;

CREATE POLICY "propostas_select" ON public.propostas FOR SELECT TO authenticated
USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
CREATE POLICY "propostas_insert" ON public.propostas FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "propostas_update" ON public.propostas FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
CREATE POLICY "propostas_delete" ON public.propostas FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND is_approved(auth.uid()));
