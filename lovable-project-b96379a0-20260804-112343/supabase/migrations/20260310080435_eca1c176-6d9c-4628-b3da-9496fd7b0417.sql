
ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS email_cliente text,
  ADD COLUMN IF NOT EXISTS google_maps_link text,
  ADD COLUMN IF NOT EXISTS confirmado boolean NOT NULL DEFAULT false;
