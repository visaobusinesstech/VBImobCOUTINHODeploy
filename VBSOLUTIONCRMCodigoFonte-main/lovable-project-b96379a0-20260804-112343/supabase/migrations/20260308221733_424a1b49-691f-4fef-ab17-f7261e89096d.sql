
-- Add trial and plan columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS trial_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'gratuito';

-- Set existing profiles to have trial_start as their created_at
UPDATE public.profiles SET trial_start = created_at WHERE trial_start IS NULL;

-- Update handle_new_user to auto-approve new signups with 14-day trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  IF user_count = 0 THEN
    -- First user becomes master and is auto-approved
    INSERT INTO public.profiles (id, nome, email, approved, is_master, trial_start, plano)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email, true, true, now(), 'gratuito');
  ELSE
    -- New users auto-approved with 14-day free trial
    INSERT INTO public.profiles (id, nome, email, approved, is_master, trial_start, plano)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email, true, false, now(), 'gratuito');
  END IF;
  
  RETURN NEW;
END;
$function$;
