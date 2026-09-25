
CREATE TABLE public.photo_extraction_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  imovel_id UUID NULL,
  source_url TEXT NOT NULL,
  portal TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INT NOT NULL DEFAULT 5,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  last_error_code TEXT NULL,
  last_block_reason TEXT NULL,
  result JSONB NULL,
  origin TEXT NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT photo_extraction_queue_status_chk
    CHECK (status IN ('pending','processing','done','failed','cancelled'))
);

CREATE INDEX idx_peq_status_nextrun ON public.photo_extraction_queue (status, next_run_at) WHERE status IN ('pending','processing');
CREATE INDEX idx_peq_user ON public.photo_extraction_queue (user_id, created_at DESC);
CREATE INDEX idx_peq_portal ON public.photo_extraction_queue (portal, status);

GRANT SELECT, INSERT, UPDATE ON public.photo_extraction_queue TO authenticated;
GRANT ALL ON public.photo_extraction_queue TO service_role;

ALTER TABLE public.photo_extraction_queue ENABLE ROW LEVEL SECURITY;

-- Users see their own queue; master sees all
CREATE POLICY "peq_select_own_or_master"
ON public.photo_extraction_queue FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.email = 'acoutinhoimoveis@gmail.com'
  )
);

-- Users can enqueue for themselves
CREATE POLICY "peq_insert_own"
ON public.photo_extraction_queue FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users may only cancel their own pending items (no arbitrary status changes)
CREATE POLICY "peq_update_cancel_own"
ON public.photo_extraction_queue FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status IN ('pending','failed'))
WITH CHECK (user_id = auth.uid() AND status IN ('pending','cancelled'));

CREATE OR REPLACE FUNCTION public.update_photo_extraction_queue_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_peq_updated
BEFORE UPDATE ON public.photo_extraction_queue
FOR EACH ROW EXECUTE FUNCTION public.update_photo_extraction_queue_updated_at();

-- Atomic claim function for worker: locks up to _limit ready rows and returns them as 'processing'
CREATE OR REPLACE FUNCTION public.claim_photo_extraction_jobs(_limit INT DEFAULT 5)
RETURNS SETOF public.photo_extraction_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.photo_extraction_queue
    WHERE status = 'pending'
      AND next_run_at <= now()
    ORDER BY priority ASC, next_run_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.photo_extraction_queue q
     SET status = 'processing',
         started_at = now(),
         attempts = q.attempts + 1
   FROM picked
   WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_photo_extraction_jobs(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_photo_extraction_jobs(INT) TO service_role;
