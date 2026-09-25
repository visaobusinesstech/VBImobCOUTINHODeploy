
-- Table for relationship data (wedding, children, profession)
CREATE TABLE public.clientes_relacionamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id uuid NOT NULL,
  nome text NOT NULL,
  telefone text,
  email text,
  aniversario date,
  data_casamento date,
  profissao text,
  data_profissao date,
  filhos jsonb DEFAULT '[]'::jsonb,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.clientes_relacionamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select clientes_relacionamento" ON public.clientes_relacionamento FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert clientes_relacionamento" ON public.clientes_relacionamento FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update clientes_relacionamento" ON public.clientes_relacionamento FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete clientes_relacionamento" ON public.clientes_relacionamento FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- Updated_at trigger
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.clientes_relacionamento FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_relacionamento;
