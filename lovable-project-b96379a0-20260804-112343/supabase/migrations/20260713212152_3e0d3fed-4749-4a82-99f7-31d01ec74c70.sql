
-- Revoke anon on all remaining SECURITY DEFINER functions (RLS helpers only need authenticated)
REVOKE EXECUTE ON FUNCTION public.can_access_imobiliaria(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_master(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_corretor(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_contrato_file(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_imobiliaria_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_master_user_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_followup_counts(boolean,integer) FROM PUBLIC, anon;

-- Restrict fully to service_role: admin/cleanup functions
REVOKE EXECUTE ON FUNCTION public.check_ip_abuse(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ai_usage_count(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_serper_cache() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_deleted_backup(uuid) FROM PUBLIC, anon;

-- Storage: prevent broad listing on public buckets while preserving direct-URL public reads.
-- Public buckets (`public=true` on storage.buckets) serve files via the CDN without a policy check,
-- so listing via storage.objects can be safely restricted to owners.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND cmd='SELECT'
      AND (qual ILIKE '%bucket_id = ''imoveis''%' OR qual ILIKE '%bucket_id = ''logos''%')
      AND 'anon' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Explicit owner-only listing policies (uploads via signed URLs still work; public reads use CDN)
CREATE POLICY "imoveis owner list" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'imoveis' AND owner = auth.uid());

CREATE POLICY "logos owner list" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'logos' AND owner = auth.uid());
