
-- Create leads table for CRM pipeline
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  interesse TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  corretor_id UUID REFERENCES public.corretores(id) ON DELETE SET NULL,
  estagio TEXT NOT NULL DEFAULT 'novos',
  posicao INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS policies - owner access only
CREATE POLICY "Owner can select leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can insert leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (auth.uid() = imobiliaria_id);

-- Updated_at trigger
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
