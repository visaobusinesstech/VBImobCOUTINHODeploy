
-- Add column to track which reminder tier was already sent
ALTER TABLE public.compromissos 
ADD COLUMN IF NOT EXISTS lembrete_nivel integer NOT NULL DEFAULT 0;

-- lembrete_nivel meanings:
-- 0 = no reminder sent
-- 1 = 1 day before sent
-- 2 = 6 hours before sent
-- 3 = 3 hours before sent
-- 4 = 1 hour before sent
-- 5 = 15 minutes before sent

COMMENT ON COLUMN public.compromissos.lembrete_nivel IS 'Tracks escalated reminder tier: 0=none, 1=1day, 2=6h, 3=3h, 4=1h, 5=15min';
