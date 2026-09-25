
-- Add column for plan request pending master approval
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano_solicitado TEXT DEFAULT NULL;
