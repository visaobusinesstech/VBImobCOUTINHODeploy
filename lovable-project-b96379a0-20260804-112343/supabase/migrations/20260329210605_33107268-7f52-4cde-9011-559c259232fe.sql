CREATE TABLE public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'evolution', 'zapi')),
  api_url TEXT,
  api_key TEXT,
  instance_name TEXT,
  token_zapi TEXT,
  instance_id_zapi TEXT,
  ativo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(imobiliaria_id)
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own whatsapp config" ON public.whatsapp_config
  FOR ALL TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id))
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));

CREATE TRIGGER set_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();