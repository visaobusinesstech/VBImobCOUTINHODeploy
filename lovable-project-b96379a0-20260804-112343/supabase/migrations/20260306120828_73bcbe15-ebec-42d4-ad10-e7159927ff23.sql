
-- Create compromissos table
CREATE TABLE public.compromissos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'reuniao',
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fim TIMESTAMP WITH TIME ZONE,
  local TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  corretor_id UUID REFERENCES public.corretores(id) ON DELETE SET NULL,
  imovel_id UUID REFERENCES public.imoveis(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  lembrete_whatsapp BOOLEAN NOT NULL DEFAULT false,
  telefone_lembrete TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compromissos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Owner can select compromissos" ON public.compromissos FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert compromissos" ON public.compromissos FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update compromissos" ON public.compromissos FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete compromissos" ON public.compromissos FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- Updated_at trigger
CREATE TRIGGER set_compromissos_updated_at BEFORE UPDATE ON public.compromissos FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.compromissos;
