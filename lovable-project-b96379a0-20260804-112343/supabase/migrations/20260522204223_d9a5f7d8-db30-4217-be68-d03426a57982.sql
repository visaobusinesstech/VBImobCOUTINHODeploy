UPDATE storage.buckets SET public = false WHERE id = 'exports';

DROP POLICY IF EXISTS "Public can download from exports" ON storage.objects;
DROP POLICY IF EXISTS "Public access to exports" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own exports" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own exports" ON storage.objects;

CREATE POLICY "Users can read their own exports" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'exports' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own exports" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exports' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Qualquer um pode inserir logs" ON public.system_logs;

ALTER TABLE public.error_threshold_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Masters can view threshold logs" ON public.error_threshold_logs;
CREATE POLICY "Masters can view threshold logs" ON public.error_threshold_logs
FOR SELECT TO authenticated
USING (public.is_master(auth.uid()));