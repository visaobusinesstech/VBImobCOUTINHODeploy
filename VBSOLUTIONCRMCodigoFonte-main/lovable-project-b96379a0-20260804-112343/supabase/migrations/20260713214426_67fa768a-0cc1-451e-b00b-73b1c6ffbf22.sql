
-- 1) Tabela de auditoria de segurança
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL CHECK (event_type IN (
    'rls_denied',           -- tentativa que retornou vazio por RLS
    'service_role_call',    -- chamada de edge function usando service_role
    'sensitive_mutation',   -- INSERT/UPDATE/DELETE em tabela sensível
    'cross_tenant_attempt', -- ator tentou operar em tenant diferente
    'privilege_escalation', -- tentativa de mexer em campos protegidos
    'auth_event'            -- login, signup, reset, etc.
  )),
  actor_user_id uuid,              -- quem tentou (auth.uid()); NULL para anon
  tenant_id uuid,                  -- imobiliária alvo do recurso
  actor_tenant_id uuid,            -- imobiliária efetiva do ator (get_user_imobiliaria_id)
  table_name text,
  record_id text,
  action text NOT NULL,            -- 'select' | 'insert' | 'update' | 'delete' | 'call' | ...
  outcome text NOT NULL CHECK (outcome IN ('allowed','denied','error')),
  reason text,                     -- descrição textual do motivo (curta)
  source text NOT NULL CHECK (source IN ('client','edge_function','trigger','cron','system')),
  edge_function text,              -- nome da function quando source='edge_function'
  correlation_id uuid,             -- para amarrar múltiplos eventos da mesma requisição
  request_ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS security_audit_log_created_at_idx ON public.security_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_tenant_idx ON public.security_audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_actor_idx ON public.security_audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_event_idx ON public.security_audit_log (event_type, outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_corr_idx ON public.security_audit_log (correlation_id);

-- 2) Grants (regra pública-schema-grants)
GRANT SELECT, INSERT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;
-- anon NUNCA lê; INSERT limitado ao caso de RLS-denied via RPC controlada
GRANT INSERT ON public.security_audit_log TO anon;

-- 3) RLS: masters veem tudo; usuário comum vê só onde é ator OU tenant é seu; inserção só como próprio ator
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit master reads all" ON public.security_audit_log;
CREATE POLICY "audit master reads all"
  ON public.security_audit_log FOR SELECT
  TO authenticated
  USING (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "audit self/tenant reads" ON public.security_audit_log;
CREATE POLICY "audit self/tenant reads"
  ON public.security_audit_log FOR SELECT
  TO authenticated
  USING (
    actor_user_id = auth.uid()
    OR (tenant_id IS NOT NULL AND public.can_access_imobiliaria(tenant_id))
  );

DROP POLICY IF EXISTS "audit self inserts" ON public.security_audit_log;
CREATE POLICY "audit self inserts"
  ON public.security_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND source IN ('client','edge_function')
  );

-- anon pode inserir apenas eventos anônimos de client (nunca com actor_user_id preenchido)
DROP POLICY IF EXISTS "audit anon inserts" ON public.security_audit_log;
CREATE POLICY "audit anon inserts"
  ON public.security_audit_log FOR INSERT
  TO anon
  WITH CHECK (
    actor_user_id IS NULL
    AND source = 'client'
    AND event_type IN ('rls_denied','auth_event')
  );

-- Ninguém que não seja service_role pode alterar/apagar histórico
DROP POLICY IF EXISTS "audit no update client" ON public.security_audit_log;
CREATE POLICY "audit no update client"
  ON public.security_audit_log FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "audit no delete client" ON public.security_audit_log;
CREATE POLICY "audit no delete client"
  ON public.security_audit_log FOR DELETE
  TO authenticated
  USING (false);

-- 4) RPC do cliente: log_rls_denied_attempt
CREATE OR REPLACE FUNCTION public.log_rls_denied_attempt(
  _table_name text,
  _action text,
  _record_id text DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL,
  _reason text DEFAULT 'silent-empty-result',
  _correlation_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  v_actor_tenant uuid;
BEGIN
  IF _action NOT IN ('select','insert','update','delete','upload','download','call') THEN
    RAISE EXCEPTION 'invalid action: %', _action USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_actor_tenant := public.get_user_imobiliaria_id();
  EXCEPTION WHEN OTHERS THEN
    v_actor_tenant := NULL;
  END;

  INSERT INTO public.security_audit_log (
    event_type, actor_user_id, tenant_id, actor_tenant_id,
    table_name, record_id, action, outcome, reason,
    source, correlation_id, metadata
  ) VALUES (
    'rls_denied', auth.uid(), _tenant_id, v_actor_tenant,
    _table_name, _record_id, _action, 'denied', COALESCE(_reason,'silent-empty-result'),
    'client', _correlation_id, COALESCE(_metadata,'{}'::jsonb)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.log_rls_denied_attempt(text,text,text,uuid,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_rls_denied_attempt(text,text,text,uuid,text,uuid,jsonb) TO authenticated, anon;

-- 5) RPC para edge functions com service_role
CREATE OR REPLACE FUNCTION public.log_service_role_call(
  _edge_function text,
  _action text,
  _actor_user_id uuid DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL,
  _table_name text DEFAULT NULL,
  _record_id text DEFAULT NULL,
  _outcome text DEFAULT 'allowed',
  _reason text DEFAULT NULL,
  _correlation_id uuid DEFAULT NULL,
  _request_ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF _outcome NOT IN ('allowed','denied','error') THEN
    RAISE EXCEPTION 'invalid outcome: %', _outcome USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.security_audit_log (
    event_type, actor_user_id, tenant_id, actor_tenant_id,
    table_name, record_id, action, outcome, reason,
    source, edge_function, correlation_id, request_ip, user_agent, metadata
  ) VALUES (
    'service_role_call', _actor_user_id, _tenant_id, _tenant_id,
    _table_name, _record_id, _action, _outcome, _reason,
    'edge_function', _edge_function, _correlation_id, _request_ip, _user_agent,
    COALESCE(_metadata,'{}'::jsonb)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.log_service_role_call(text,text,uuid,uuid,text,text,text,text,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_service_role_call(text,text,uuid,uuid,text,text,text,text,uuid,text,text,jsonb) TO service_role;

-- 6) Trigger genérico para mutações sensíveis
CREATE OR REPLACE FUNCTION public.audit_sensitive_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_actor_tenant uuid;
  v_record_id text;
  v_event text := 'sensitive_mutation';
  v_action text := lower(TG_OP);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant := (to_jsonb(OLD) ->> 'imobiliaria_id')::uuid;
    v_record_id := (to_jsonb(OLD) ->> 'id');
  ELSE
    v_tenant := (to_jsonb(NEW) ->> 'imobiliaria_id')::uuid;
    v_record_id := (to_jsonb(NEW) ->> 'id');
  END IF;

  BEGIN
    v_actor_tenant := public.get_user_imobiliaria_id();
  EXCEPTION WHEN OTHERS THEN
    v_actor_tenant := NULL;
  END;

  -- Marca tentativa cross-tenant quando o ator tem tenant conhecido e é diferente
  IF v_actor_tenant IS NOT NULL AND v_tenant IS NOT NULL AND v_actor_tenant <> v_tenant THEN
    v_event := 'cross_tenant_attempt';
  END IF;

  INSERT INTO public.security_audit_log (
    event_type, actor_user_id, tenant_id, actor_tenant_id,
    table_name, record_id, action, outcome, reason,
    source, metadata
  ) VALUES (
    v_event, auth.uid(), v_tenant, v_actor_tenant,
    TG_TABLE_NAME, v_record_id, v_action, 'allowed',
    NULL, 'trigger',
    jsonb_build_object('op', TG_OP)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 7) Aplicar em tabelas sensíveis
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','imoveis','transacoes','contratos','propostas','proprietarios']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s
         AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_mutation()',
      t
    );
  END LOOP;
END $$;
