
-- 1. Update can_access_imobiliaria to support shared access via master_autorizacoes
CREATE OR REPLACE FUNCTION public.can_access_imobiliaria(_imobiliaria_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _imobiliaria_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.master_autorizacoes
      WHERE user_id = auth.uid()
        AND master_id = _imobiliaria_id
        AND ativo = true
    )
$$;

-- 2. Update get_user_imobiliaria_id to return master's id if authorized
CREATE OR REPLACE FUNCTION public.get_user_imobiliaria_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT master_id FROM public.master_autorizacoes WHERE user_id = auth.uid() AND ativo = true LIMIT 1),
    auth.uid()
  )
$$;

-- 3. Update INSERT/UPDATE/DELETE policies for all shared tables to use can_access_imobiliaria

-- LEADS
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- CONTRATOS
DROP POLICY IF EXISTS "contratos_insert" ON public.contratos;
CREATE POLICY "contratos_insert" ON public.contratos FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "contratos_update" ON public.contratos;
CREATE POLICY "contratos_update" ON public.contratos FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "contratos_delete" ON public.contratos;
CREATE POLICY "contratos_delete" ON public.contratos FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- COMPROMISSOS (Agenda)
DROP POLICY IF EXISTS "compromissos_insert" ON public.compromissos;
CREATE POLICY "compromissos_insert" ON public.compromissos FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "compromissos_update" ON public.compromissos;
CREATE POLICY "compromissos_update" ON public.compromissos FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "compromissos_delete" ON public.compromissos;
CREATE POLICY "compromissos_delete" ON public.compromissos FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- CAPTACOES
DROP POLICY IF EXISTS "captacoes_insert" ON public.captacoes;
CREATE POLICY "captacoes_insert" ON public.captacoes FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "captacoes_update" ON public.captacoes;
CREATE POLICY "captacoes_update" ON public.captacoes FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "captacoes_delete" ON public.captacoes;
CREATE POLICY "captacoes_delete" ON public.captacoes FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- AVALIACOES_HISTORICO
DROP POLICY IF EXISTS "avaliacoes_historico_insert" ON public.avaliacoes_historico;
CREATE POLICY "avaliacoes_historico_insert" ON public.avaliacoes_historico FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "avaliacoes_historico_delete" ON public.avaliacoes_historico;
CREATE POLICY "avaliacoes_historico_delete" ON public.avaliacoes_historico FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- PROPRIETARIOS
DROP POLICY IF EXISTS "proprietarios_insert" ON public.proprietarios;
CREATE POLICY "proprietarios_insert" ON public.proprietarios FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "proprietarios_update" ON public.proprietarios;
CREATE POLICY "proprietarios_update" ON public.proprietarios FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "proprietarios_delete" ON public.proprietarios;
CREATE POLICY "proprietarios_delete" ON public.proprietarios FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- TRANSACOES
DROP POLICY IF EXISTS "transacoes_insert" ON public.transacoes;
CREATE POLICY "transacoes_insert" ON public.transacoes FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "transacoes_update" ON public.transacoes;
CREATE POLICY "transacoes_update" ON public.transacoes FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "transacoes_delete" ON public.transacoes;
CREATE POLICY "transacoes_delete" ON public.transacoes FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- FOLLOWUPS
DROP POLICY IF EXISTS "followups_insert" ON public.followups;
CREATE POLICY "followups_insert" ON public.followups FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "followups_update" ON public.followups;
CREATE POLICY "followups_update" ON public.followups FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "followups_delete" ON public.followups;
CREATE POLICY "followups_delete" ON public.followups FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- LEAD_ATIVIDADES
DROP POLICY IF EXISTS "lead_atividades_insert" ON public.lead_atividades;
CREATE POLICY "lead_atividades_insert" ON public.lead_atividades FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "lead_atividades_delete" ON public.lead_atividades;
CREATE POLICY "lead_atividades_delete" ON public.lead_atividades FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- CORRETORES
DROP POLICY IF EXISTS "corretores_insert" ON public.corretores;
CREATE POLICY "corretores_insert" ON public.corretores FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "corretores_update" ON public.corretores;
CREATE POLICY "corretores_update" ON public.corretores FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "corretores_delete" ON public.corretores;
CREATE POLICY "corretores_delete" ON public.corretores FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- IMOVEIS
DROP POLICY IF EXISTS "imoveis_insert" ON public.imoveis;
CREATE POLICY "imoveis_insert" ON public.imoveis FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "imoveis_update" ON public.imoveis;
CREATE POLICY "imoveis_update" ON public.imoveis FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "imoveis_delete" ON public.imoveis;
CREATE POLICY "imoveis_delete" ON public.imoveis FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- CLIENTES_RELACIONAMENTO
DROP POLICY IF EXISTS "clientes_rel_insert" ON public.clientes_relacionamento;
CREATE POLICY "clientes_rel_insert" ON public.clientes_relacionamento FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "clientes_rel_update" ON public.clientes_relacionamento;
CREATE POLICY "clientes_rel_update" ON public.clientes_relacionamento FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "clientes_rel_delete" ON public.clientes_relacionamento;
CREATE POLICY "clientes_rel_delete" ON public.clientes_relacionamento FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- PROPOSTAS
DROP POLICY IF EXISTS "propostas_insert" ON public.propostas;
CREATE POLICY "propostas_insert" ON public.propostas FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "propostas_update" ON public.propostas;
CREATE POLICY "propostas_update" ON public.propostas FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "propostas_delete" ON public.propostas;
CREATE POLICY "propostas_delete" ON public.propostas FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- CONTEUDOS_SEO
DROP POLICY IF EXISTS "conteudos_seo_insert" ON public.conteudos_seo;
CREATE POLICY "conteudos_seo_insert" ON public.conteudos_seo FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "conteudos_seo_update" ON public.conteudos_seo;
CREATE POLICY "conteudos_seo_update" ON public.conteudos_seo FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "conteudos_seo_delete" ON public.conteudos_seo;
CREATE POLICY "conteudos_seo_delete" ON public.conteudos_seo FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- MENSAGENS_WHATSAPP
DROP POLICY IF EXISTS "whatsapp_insert" ON public.mensagens_whatsapp;
CREATE POLICY "whatsapp_insert" ON public.mensagens_whatsapp FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "whatsapp_update" ON public.mensagens_whatsapp;
CREATE POLICY "whatsapp_update" ON public.mensagens_whatsapp FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "whatsapp_delete" ON public.mensagens_whatsapp;
CREATE POLICY "whatsapp_delete" ON public.mensagens_whatsapp FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- AUTOMACOES
DROP POLICY IF EXISTS "automacoes_insert" ON public.automacoes;
CREATE POLICY "automacoes_insert" ON public.automacoes FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "automacoes_update" ON public.automacoes;
CREATE POLICY "automacoes_update" ON public.automacoes FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "automacoes_delete" ON public.automacoes;
CREATE POLICY "automacoes_delete" ON public.automacoes FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- METAS_DASHBOARD
DROP POLICY IF EXISTS "metas_insert" ON public.metas_dashboard;
CREATE POLICY "metas_insert" ON public.metas_dashboard FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "metas_update" ON public.metas_dashboard;
CREATE POLICY "metas_update" ON public.metas_dashboard FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "metas_delete" ON public.metas_dashboard;
CREATE POLICY "metas_delete" ON public.metas_dashboard FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- MENSAGEM_TEMPLATES
DROP POLICY IF EXISTS "templates_insert" ON public.mensagem_templates;
CREATE POLICY "templates_insert" ON public.mensagem_templates FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "templates_update" ON public.mensagem_templates;
CREATE POLICY "templates_update" ON public.mensagem_templates FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "templates_delete" ON public.mensagem_templates;
CREATE POLICY "templates_delete" ON public.mensagem_templates FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- IMOVEIS_MERCADO
DROP POLICY IF EXISTS "imoveis_mercado_insert" ON public.imoveis_mercado;
CREATE POLICY "imoveis_mercado_insert" ON public.imoveis_mercado FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "imoveis_mercado_delete" ON public.imoveis_mercado;
CREATE POLICY "imoveis_mercado_delete" ON public.imoveis_mercado FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
