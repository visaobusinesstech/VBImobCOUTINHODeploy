UPDATE public.profiles
SET plano = 'premium_plus',
    approved = true,
    trial_start = now()
WHERE id = '8fe034ae-a2d8-4a40-9d74-5040727832c0';