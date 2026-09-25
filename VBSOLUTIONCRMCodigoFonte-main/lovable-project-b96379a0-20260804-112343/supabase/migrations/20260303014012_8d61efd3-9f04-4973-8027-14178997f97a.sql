
-- Add approval columns to profiles
ALTER TABLE public.profiles ADD COLUMN approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN is_master boolean NOT NULL DEFAULT false;

-- Update trigger to auto-approve first user as master
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  IF user_count = 0 THEN
    -- First user becomes master and is auto-approved
    INSERT INTO public.profiles (id, nome, email, approved, is_master)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email, true, true);
  ELSE
    -- Subsequent users need master approval
    INSERT INTO public.profiles (id, nome, email, approved, is_master)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email, false, false);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Allow master to see all profiles (for approval)
CREATE POLICY "Master can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT is_master FROM public.profiles WHERE id = auth.uid()) = true
  OR auth.uid() = id
);

-- Drop old select policy that conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Allow master to update any profile (to approve)
CREATE POLICY "Master can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (SELECT is_master FROM public.profiles WHERE id = auth.uid()) = true
  OR auth.uid() = id
);

-- Drop old update policy that conflicts
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
