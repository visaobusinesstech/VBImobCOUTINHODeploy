
-- Rotação e versionamento de webhook_secrets
-- Permite múltiplas chaves ativas por (imobiliaria_id, provider) durante janelas de rotação.

-- 1) Novas colunas
ALTER TABLE public.webhook_secrets
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS replaced_by uuid REFERENCES public.webhook_secrets(id) ON DELETE SET NULL;

-- 2) Remover unique antigo (só um segredo por tenant/provider) e criar novos
ALTER TABLE public.webhook_secrets
  DROP CONSTRAINT IF EXISTS webhook_secrets_imobiliaria_id_provider_key;

-- Versão é única dentro do escopo tenant/provider
CREATE UNIQUE INDEX IF NOT EXISTS webhook_secrets_tenant_provider_version_uniq
  ON public.webhook_secrets (imobiliaria_id, provider, version);

-- Lookup rápido de ativos e não expirados
CREATE INDEX IF NOT EXISTS webhook_secrets_active_lookup_idx
  ON public.webhook_secrets (imobiliaria_id, provider, ativo)
  WHERE ativo = true;

-- 3) Trigger updated_at (se já não existir)
DROP TRIGGER IF EXISTS trg_webhook_secrets_updated_at ON public.webhook_secrets;
CREATE TRIGGER trg_webhook_secrets_updated_at
  BEFORE UPDATE ON public.webhook_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RPC para rotacionar: insere nova versão ativa e marca a anterior para expirar após grace period
CREATE OR REPLACE FUNCTION public.rotate_webhook_secret(
  _provider text,
  _new_secret text,
  _grace_period_hours integer DEFAULT 24,
  _label text DEFAULT NULL
)
RETURNS TABLE(new_id uuid, new_version integer, previous_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_next_version integer;
  v_new_id uuid;
  v_expires timestamptz;
  v_prev_id uuid;
BEGIN
  v_tenant := auth.uid();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF _new_secret IS NULL OR length(_new_secret) < 16 THEN
    RAISE EXCEPTION 'segredo_muito_curto' USING ERRCODE = '22023';
  END IF;

  IF _grace_period_hours < 0 OR _grace_period_hours > 24*30 THEN
    RAISE EXCEPTION 'grace_period_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
  FROM public.webhook_secrets
  WHERE imobiliaria_id = v_tenant AND provider = _provider;

  v_expires := now() + make_interval(hours => _grace_period_hours);

  -- Marca versão ativa anterior (a mais recente) com expires_at e replaced_by
  UPDATE public.webhook_secrets ws
     SET rotated_at = now(),
         expires_at = COALESCE(ws.expires_at, v_expires)
   WHERE ws.imobiliaria_id = v_tenant
     AND ws.provider = _provider
     AND ws.ativo = true
     AND ws.expires_at IS NULL
  RETURNING ws.id INTO v_prev_id;

  INSERT INTO public.webhook_secrets (
    imobiliaria_id, provider, secret, ativo, version, label
  ) VALUES (
    v_tenant, _provider, _new_secret, true, v_next_version, _label
  )
  RETURNING id INTO v_new_id;

  IF v_prev_id IS NOT NULL THEN
    UPDATE public.webhook_secrets
       SET replaced_by = v_new_id
     WHERE id = v_prev_id;
  END IF;

  RETURN QUERY SELECT v_new_id, v_next_version, v_expires;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rotate_webhook_secret(text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_webhook_secret(text, text, integer, text) TO authenticated;

-- 5) RPC de manutenção: desativa segredos expirados
CREATE OR REPLACE FUNCTION public.expire_webhook_secrets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.webhook_secrets
     SET ativo = false,
         updated_at = now()
   WHERE ativo = true
     AND expires_at IS NOT NULL
     AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_webhook_secrets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_webhook_secrets() TO service_role;

-- 6) Backfill: versão 1 para linhas existentes (já default, mas garante consistência)
UPDATE public.webhook_secrets SET version = 1 WHERE version IS NULL;
