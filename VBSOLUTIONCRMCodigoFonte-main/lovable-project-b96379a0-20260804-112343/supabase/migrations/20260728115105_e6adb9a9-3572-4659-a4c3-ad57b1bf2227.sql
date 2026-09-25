-- 1) Bloquear auto-concessão de plano: escrita em subscriptions só pelo servidor
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated, anon;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.subscriptions;
CREATE POLICY "Service role manages subscriptions"
ON public.subscriptions FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- registro do pedido de plano (para o admin liberar)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plano_solicitado_em timestamptz;

-- 2) Auditoria de deploy: somente Master
DROP POLICY IF EXISTS "Authenticated read post deploy audit runs" ON public.post_deploy_audit_runs;
DROP POLICY IF EXISTS "Authenticated update post deploy audit runs" ON public.post_deploy_audit_runs;
DROP POLICY IF EXISTS "Authenticated insert post deploy audit runs" ON public.post_deploy_audit_runs;
CREATE POLICY "Master read post deploy audit runs"
ON public.post_deploy_audit_runs FOR SELECT TO authenticated
USING (public.is_master(auth.uid()));
CREATE POLICY "Master insert post deploy audit runs"
ON public.post_deploy_audit_runs FOR INSERT TO authenticated
WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "Master update post deploy audit runs"
ON public.post_deploy_audit_runs FOR UPDATE TO authenticated
USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read post deploy actions" ON public.post_deploy_audit_actions;
DROP POLICY IF EXISTS "Authenticated update post deploy actions" ON public.post_deploy_audit_actions;
CREATE POLICY "Master read post deploy actions"
ON public.post_deploy_audit_actions FOR SELECT TO authenticated
USING (public.is_master(auth.uid()));
CREATE POLICY "Master update post deploy actions"
ON public.post_deploy_audit_actions FOR UPDATE TO authenticated
USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

-- 3) Lighthouse: somente Master
DROP POLICY IF EXISTS "Authenticated read lighthouse audits" ON public.lighthouse_audits;
CREATE POLICY "Master read lighthouse audits"
ON public.lighthouse_audits FOR SELECT TO authenticated
USING (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read regression alerts" ON public.lighthouse_regression_alertas;
DROP POLICY IF EXISTS "Authenticated resolve regression alerts" ON public.lighthouse_regression_alertas;
CREATE POLICY "Master read regression alerts"
ON public.lighthouse_regression_alertas FOR SELECT TO authenticated
USING (public.is_master(auth.uid()));
CREATE POLICY "Master resolve regression alerts"
ON public.lighthouse_regression_alertas FOR UPDATE TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()) AND status = ANY (ARRAY['open'::text, 'resolved'::text]));

-- 4) Tabelas com RLS sem política: uso exclusivo do servidor
REVOKE ALL ON public.firecrawl_captacao_cache FROM authenticated, anon;
REVOKE ALL ON public.webhook_nonces FROM authenticated, anon;
GRANT ALL ON public.firecrawl_captacao_cache TO service_role;
GRANT ALL ON public.webhook_nonces TO service_role;

DROP POLICY IF EXISTS "Service role manages firecrawl cache" ON public.firecrawl_captacao_cache;
CREATE POLICY "Service role manages firecrawl cache"
ON public.firecrawl_captacao_cache FOR ALL TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages webhook nonces" ON public.webhook_nonces;
CREATE POLICY "Service role manages webhook nonces"
ON public.webhook_nonces FOR ALL TO service_role
USING (true) WITH CHECK (true);