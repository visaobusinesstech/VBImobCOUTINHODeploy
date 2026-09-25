
-- Create security definer function to check master status
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_master FROM public.profiles WHERE id = _user_id),
    false
  );
$$;

-- Drop recursive policies
DROP POLICY IF EXISTS "Master can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Master can update all profiles" ON public.profiles;

-- Recreate with security definer function
CREATE POLICY "Users and master can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR public.is_master(auth.uid())
);

CREATE POLICY "Users and master can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR public.is_master(auth.uid())
);
