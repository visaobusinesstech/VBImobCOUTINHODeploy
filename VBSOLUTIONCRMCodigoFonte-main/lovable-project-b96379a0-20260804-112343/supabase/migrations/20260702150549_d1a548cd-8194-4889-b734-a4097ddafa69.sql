ALTER TABLE public.imobiliaria_config
  ADD COLUMN IF NOT EXISTS sla_primeiro_contato_horas integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS sla_recontato_dias integer NOT NULL DEFAULT 7;