
CREATE OR REPLACE FUNCTION public._debug_email_state(_search text)
RETURNS TABLE(id uuid, email text, email_confirmed_at timestamptz, email_change text, email_change_sent_at timestamptz, updated_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id, email, email_confirmed_at, email_change, email_change_sent_at, updated_at, last_sign_in_at
  FROM auth.users
  WHERE email ILIKE '%'||_search||'%' OR email_change ILIKE '%'||_search||'%'
  LIMIT 5;
$$;
REVOKE ALL ON FUNCTION public._debug_email_state(text) FROM PUBLIC, anon, authenticated;
