
CREATE OR REPLACE FUNCTION public._debug_recent_email_changes()
RETURNS TABLE(id uuid, email text, email_change text, email_change_sent_at timestamptz, updated_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id, email, email_change, email_change_sent_at, updated_at, last_sign_in_at
  FROM auth.users
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 15;
$$;
REVOKE ALL ON FUNCTION public._debug_recent_email_changes() FROM PUBLIC, anon, authenticated;
