-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT NOT NULL, -- active, trialing, past_due, canceled, incomplete
  price_id TEXT,
  plan_type TEXT NOT NULL, -- lite, basico, etc
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Adicionar customer_id ao perfil se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'customer_id') THEN
    ALTER TABLE public.profiles ADD COLUMN customer_id TEXT;
  END IF;
END $$;

-- Função para atualizar o plano no perfil
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para mudanças de assinatura
CREATE OR REPLACE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_change();
