ALTER TABLE public.batch_exports 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_batch_exports_idempotency ON public.batch_exports(idempotency_key);

COMMENT ON COLUMN public.batch_exports.idempotency_key IS 'Unique key based on search params and filters to prevent duplicate exports in a short period';