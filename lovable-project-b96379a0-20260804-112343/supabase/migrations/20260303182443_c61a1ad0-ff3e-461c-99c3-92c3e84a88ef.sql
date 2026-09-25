
-- Create contratos table
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  cliente TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Venda', -- Venda, Locação
  valor NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, aguardando, assinado, vencendo, cancelado
  data_inicio DATE,
  data_fim DATE,
  imovel_id UUID REFERENCES public.imoveis(id) ON DELETE SET NULL,
  corretor_id UUID REFERENCES public.corretores(id) ON DELETE SET NULL,
  -- Locação specific fields
  inquilino TEXT,
  proprietario TEXT,
  contrato_url TEXT,
  vistoria_entrada BOOLEAN NOT NULL DEFAULT false,
  vistoria_video BOOLEAN NOT NULL DEFAULT false,
  apolice_seguro BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select contratos"
  ON public.contratos FOR SELECT TO authenticated
  USING (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can insert contratos"
  ON public.contratos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can update contratos"
  ON public.contratos FOR UPDATE TO authenticated
  USING (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can delete contratos"
  ON public.contratos FOR DELETE TO authenticated
  USING (auth.uid() = imobiliaria_id);

CREATE TRIGGER update_contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
