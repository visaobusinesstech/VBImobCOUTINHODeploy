-- Ajustar a função para usar search_path seguro
CREATE OR REPLACE FUNCTION public.handle_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'active' OR NEW.status = 'trialing') THEN
    UPDATE public.profiles
    SET plano = NEW.plan_type,
        plano_solicitado = NULL
    WHERE id = NEW.user_id;
  ELSIF (NEW.status = 'canceled' OR NEW.status = 'unpaid') THEN
    UPDATE public.profiles
    SET plano = 'gratuito'
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revogar execução pública para segurança (apenas o sistema deve disparar triggers)
REVOKE ALL ON FUNCTION public.handle_subscription_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_subscription_change() TO postgres;
