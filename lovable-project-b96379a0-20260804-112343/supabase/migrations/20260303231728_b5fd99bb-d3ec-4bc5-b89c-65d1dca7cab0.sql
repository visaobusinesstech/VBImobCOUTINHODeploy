
-- Create automacoes table
CREATE TABLE public.automacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id uuid NOT NULL,
  nome text NOT NULL,
  trigger_desc text NOT NULL,
  acao text NOT NULL,
  tipo text NOT NULL DEFAULT 'whatsapp',
  categoria text NOT NULL DEFAULT 'comunicacao',
  ativo boolean NOT NULL DEFAULT true,
  execucoes integer NOT NULL DEFAULT 0,
  ultima_execucao timestamp with time zone,
  plataforma_url text,
  plataforma_nome text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Owner can select automacoes" ON public.automacoes FOR SELECT USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert automacoes" ON public.automacoes FOR INSERT WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update automacoes" ON public.automacoes FOR UPDATE USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete automacoes" ON public.automacoes FOR DELETE USING (auth.uid() = imobiliaria_id);

-- Updated_at trigger
CREATE TRIGGER update_automacoes_updated_at
  BEFORE UPDATE ON public.automacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
