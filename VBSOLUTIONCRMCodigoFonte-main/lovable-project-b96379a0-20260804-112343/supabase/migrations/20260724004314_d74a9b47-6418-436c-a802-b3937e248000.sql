ALTER TABLE public.radarzap_descoberta_execucoes
  ADD COLUMN IF NOT EXISTS ignorar_dedup_all boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reprocessar_invites text[] NOT NULL DEFAULT '{}'::text[];