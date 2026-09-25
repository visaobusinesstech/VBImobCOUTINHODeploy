
-- Table for company settings
CREATE TABLE public.imobiliaria_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome_empresa text NOT NULL DEFAULT '',
  cnpj text DEFAULT '',
  endereco text DEFAULT '',
  cidade text DEFAULT '',
  estado text DEFAULT 'SP',
  cep text DEFAULT '',
  telefone text DEFAULT '',
  email text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.imobiliaria_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own config" ON public.imobiliaria_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own config" ON public.imobiliaria_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own config" ON public.imobiliaria_config FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_imobiliaria_config_updated_at
  BEFORE UPDATE ON public.imobiliaria_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "Users can upload own logo" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own logo" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Logos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
