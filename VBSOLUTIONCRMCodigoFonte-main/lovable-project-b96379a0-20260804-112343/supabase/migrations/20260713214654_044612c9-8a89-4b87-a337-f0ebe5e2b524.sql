
-- Segredos HMAC por tenant e provedor (leads/pagamentos)
CREATE TABLE public.webhook_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  secret TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  descricao TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_secrets TO authenticated;
GRANT ALL ON public.webhook_secrets TO service_role;
ALTER TABLE public.webhook_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manages own webhook secrets"
  ON public.webhook_secrets FOR ALL TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id))
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));

CREATE TRIGGER trg_webhook_secrets_updated_at
  BEFORE UPDATE ON public.webhook_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_webhook_secrets_lookup ON public.webhook_secrets(imobiliaria_id, provider) WHERE ativo;

-- Registro de nonces recebidos, para bloquear replay
CREATE TABLE public.webhook_nonces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  provider TEXT NOT NULL,
  nonce TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '10 minutes',
  UNIQUE (imobiliaria_id, provider, nonce)
);
GRANT ALL ON public.webhook_nonces TO service_role;
ALTER TABLE public.webhook_nonces ENABLE ROW LEVEL SECURITY;
-- Somente service_role acessa (edge functions). Sem policies para authenticated/anon.

CREATE INDEX idx_webhook_nonces_cleanup ON public.webhook_nonces(expires_at);

CREATE OR REPLACE FUNCTION public.cleanup_webhook_nonces()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.webhook_nonces WHERE expires_at < now();
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_webhook_nonces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_webhook_nonces() TO service_role;
