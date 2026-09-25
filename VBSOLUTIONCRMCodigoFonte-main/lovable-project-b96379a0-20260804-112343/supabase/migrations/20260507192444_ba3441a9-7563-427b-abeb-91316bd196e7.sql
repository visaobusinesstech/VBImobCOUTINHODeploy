-- Ensure idempotency_key column exists (from previous turn)
ALTER TABLE public.batch_exports 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Remove existing rows with null idempotency_key if any, or just apply unique constraint
-- To be safe without losing data, we only apply to future rows or use a partial index
-- Partial unique index is better because it only blocks active duplicates

DROP INDEX IF EXISTS idx_batch_exports_idempotency_active;
CREATE UNIQUE INDEX idx_batch_exports_idempotency_active 
ON public.batch_exports (imobiliaria_id, idempotency_key) 
WHERE (status IN ('pending', 'processing'));

COMMENT ON INDEX idx_batch_exports_idempotency_active IS 'Atomic prevention of duplicate exports with same params currently in progress';