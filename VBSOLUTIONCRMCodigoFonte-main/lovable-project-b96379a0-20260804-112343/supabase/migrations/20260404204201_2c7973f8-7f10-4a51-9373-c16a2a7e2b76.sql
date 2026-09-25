
-- When a new user is created, automatically disable the WhatsApp module
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  IF user_count = 0 THEN
    INSERT INTO public.profiles (id, nome, email, approved, is_master, trial_start, plano)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email, true, true, now(), 'gratuito');
  ELSE
    INSERT INTO public.profiles (id, nome, email, approved, is_master, trial_start, plano)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email, true, false, now(), 'gratuito');
  END IF;

  -- Disable WhatsApp module by default for all new users
  INSERT INTO public.modulo_config (imobiliaria_id, modulo, ativo)
  VALUES (NEW.id, 'whatsapp', false)
  ON CONFLICT (imobiliaria_id, modulo) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Also disable WhatsApp for all existing users who don't have an explicit config
INSERT INTO public.modulo_config (imobiliaria_id, modulo, ativo)
SELECT p.id, 'whatsapp', false
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.modulo_config mc
  WHERE mc.imobiliaria_id = p.id AND mc.modulo = 'whatsapp'
)
ON CONFLICT (imobiliaria_id, modulo) DO NOTHING;
