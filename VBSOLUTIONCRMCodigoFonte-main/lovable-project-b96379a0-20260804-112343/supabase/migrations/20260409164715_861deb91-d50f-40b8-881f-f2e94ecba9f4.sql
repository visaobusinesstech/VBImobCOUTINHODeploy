
-- =====================================================
-- 1. FIX PRIVILEGE ESCALATION ON PROFILES TABLE
-- =====================================================

-- Drop the existing overly-permissive update policy
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

-- Create restricted update policy: users can update their own row but NOT sensitive columns
-- We use a BEFORE UPDATE trigger to enforce column-level restrictions
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the current user is NOT master, prevent changes to sensitive fields
  IF NOT public.is_master(auth.uid()) THEN
    NEW.is_master := OLD.is_master;
    NEW.approved := OLD.approved;
    NEW.plano := OLD.plano;
    NEW.trial_start := OLD.trial_start;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_sensitive_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_sensitive_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_fields();

-- Recreate the update policy (same scope, but now trigger protects sensitive fields)
CREATE POLICY "profiles_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_master(auth.uid()));

-- =====================================================
-- 2. FIX DELETED_RECORDS_BACKUP MISSING POLICIES
-- =====================================================

-- INSERT: only via trigger (service role), block direct inserts
DROP POLICY IF EXISTS "deleted_records_backup_insert" ON public.deleted_records_backup;
CREATE POLICY "deleted_records_backup_insert"
  ON public.deleted_records_backup
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- UPDATE: block all updates from authenticated users
DROP POLICY IF EXISTS "deleted_records_backup_update" ON public.deleted_records_backup;
CREATE POLICY "deleted_records_backup_update"
  ON public.deleted_records_backup
  FOR UPDATE
  TO authenticated
  USING (false);

-- DELETE: only master can delete backup records
DROP POLICY IF EXISTS "deleted_records_backup_delete" ON public.deleted_records_backup;
CREATE POLICY "deleted_records_backup_delete"
  ON public.deleted_records_backup
  FOR DELETE
  TO authenticated
  USING (public.is_master(auth.uid()));

-- =====================================================
-- 3. FIX IMOBILIARIA_CONFIG MISSING DELETE POLICY
-- =====================================================

DROP POLICY IF EXISTS "imobiliaria_config_delete" ON public.imobiliaria_config;
CREATE POLICY "imobiliaria_config_delete"
  ON public.imobiliaria_config
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 4. FIX LOGOS BUCKET MISSING DELETE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Users can delete their own logo" ON storage.objects;
CREATE POLICY "Users can delete their own logo"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- =====================================================
-- 5. FIX REALTIME CHANNEL AUTHORIZATION
-- =====================================================
-- Note: Realtime authorization is best handled by enabling RLS 
-- on the source table (notifications already has RLS).
-- The realtime.messages table is internal to Supabase and 
-- channel-level auth should use topic-based filtering in code.
-- We ensure notifications policies are strict.

-- Verify notifications has proper SELECT policy scoped to user
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
