
ALTER TABLE public.radarzap_metricas_alertas_config
  ADD COLUMN IF NOT EXISTS descoberta_alertar_zero boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS descoberta_alertar_erro boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS descoberta_alertar_timeout boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS descoberta_timeout_ms integer NOT NULL DEFAULT 60000,
  ADD COLUMN IF NOT EXISTS descoberta_min_erros integer NOT NULL DEFAULT 1;

ALTER TABLE public.radarzap_metricas_alertas_log
  DROP CONSTRAINT IF EXISTS radarzap_metricas_alertas_log_tipo_check;

ALTER TABLE public.radarzap_metricas_alertas_log
  ADD CONSTRAINT radarzap_metricas_alertas_log_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'taxa_geracao','taxa_aprovacao',
    'descoberta_zero','descoberta_erro','descoberta_timeout'
  ]));
