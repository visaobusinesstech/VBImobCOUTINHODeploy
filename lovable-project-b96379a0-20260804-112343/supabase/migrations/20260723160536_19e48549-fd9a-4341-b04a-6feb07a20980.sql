
-- 1. Campos de cobrança na tabela transacoes
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS link_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS token_pagamento UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS pago_confirmado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pago_confirmado_por TEXT,
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT,
  ADD COLUMN IF NOT EXISTS lembrete_ultimo_envio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lembrete_enviado_count INT NOT NULL DEFAULT 0;

-- Backfill token para linhas existentes
UPDATE public.transacoes SET token_pagamento = gen_random_uuid() WHERE token_pagamento IS NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_token_pagamento ON public.transacoes(token_pagamento);
CREATE INDEX IF NOT EXISTS idx_transacoes_status_data ON public.transacoes(status, data) WHERE status = 'pendente';

-- 2. Config de lembretes por imobiliária
CREATE TABLE IF NOT EXISTS public.cobrancas_lembretes_config (
  imobiliaria_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  dias_antes INT[] NOT NULL DEFAULT ARRAY[5,1],
  dias_apos INT[] NOT NULL DEFAULT ARRAY[1,7],
  canal_whatsapp BOOLEAN NOT NULL DEFAULT true,
  canal_email BOOLEAN NOT NULL DEFAULT false,
  canal_notificacao BOOLEAN NOT NULL DEFAULT true,
  mensagem_template TEXT NOT NULL DEFAULT 'Olá {{nome}}, sua cobrança de {{descricao}} no valor de {{valor}} vence em {{data}}. Acesse o link para pagar: {{link}}',
  categorias TEXT[] NOT NULL DEFAULT ARRAY['aluguel','comissao','despesa'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas_lembretes_config TO authenticated;
GRANT ALL ON public.cobrancas_lembretes_config TO service_role;

ALTER TABLE public.cobrancas_lembretes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobrancas_config_own"
  ON public.cobrancas_lembretes_config
  FOR ALL
  USING (auth.uid() = imobiliaria_id)
  WITH CHECK (auth.uid() = imobiliaria_id);

CREATE OR REPLACE FUNCTION public.tg_cobrancas_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cobrancas_config_updated_at ON public.cobrancas_lembretes_config;
CREATE TRIGGER trg_cobrancas_config_updated_at
  BEFORE UPDATE ON public.cobrancas_lembretes_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_cobrancas_config_updated_at();

-- 3. Trigger para garantir token em novas transações
CREATE OR REPLACE FUNCTION public.tg_transacao_token()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.token_pagamento IS NULL THEN
    NEW.token_pagamento := gen_random_uuid();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_transacao_token ON public.transacoes;
CREATE TRIGGER trg_transacao_token
  BEFORE INSERT ON public.transacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_transacao_token();
