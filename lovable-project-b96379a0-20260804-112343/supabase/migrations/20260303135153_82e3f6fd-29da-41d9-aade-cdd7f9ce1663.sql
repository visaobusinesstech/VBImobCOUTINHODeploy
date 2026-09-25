
-- Create handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create imoveis table
CREATE TABLE public.imoveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Apartamento',
  operacao TEXT NOT NULL DEFAULT 'Venda',
  preco NUMERIC NOT NULL DEFAULT 0,
  endereco TEXT,
  cidade TEXT,
  bairro TEXT,
  estado TEXT DEFAULT 'SP',
  cep TEXT,
  quartos INTEGER NOT NULL DEFAULT 0,
  banheiros INTEGER NOT NULL DEFAULT 0,
  vagas INTEGER NOT NULL DEFAULT 0,
  area NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  exclusivo BOOLEAN NOT NULL DEFAULT false,
  destaque BOOLEAN NOT NULL DEFAULT false,
  fotos TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Owner can select imoveis" ON public.imoveis
  FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can insert imoveis" ON public.imoveis
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can update imoveis" ON public.imoveis
  FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can delete imoveis" ON public.imoveis
  FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- Updated_at trigger
CREATE TRIGGER update_imoveis_updated_at
  BEFORE UPDATE ON public.imoveis
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Storage bucket for property photos
INSERT INTO storage.buckets (id, name, public) VALUES ('imoveis', 'imoveis', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload imoveis photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'imoveis' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can update their imoveis photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'imoveis' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete their imoveis photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'imoveis' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view imoveis photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'imoveis');
