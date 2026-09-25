
-- Create transacoes table for financial management
CREATE TABLE public.transacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'entrada', -- entrada, saida
  categoria TEXT NOT NULL DEFAULT 'comissao', -- comissao, aluguel, repasse, despesa, outros
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, confirmado, atrasado, cancelado
  imovel_id UUID REFERENCES public.imoveis(id) ON DELETE SET NULL,
  corretor_id UUID REFERENCES public.corretores(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Owner can select transacoes"
  ON public.transacoes FOR SELECT
  TO authenticated
  USING (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can insert transacoes"
  ON public.transacoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can update transacoes"
  ON public.transacoes FOR UPDATE
  TO authenticated
  USING (auth.uid() = imobiliaria_id);

CREATE POLICY "Owner can delete transacoes"
  ON public.transacoes FOR DELETE
  TO authenticated
  USING (auth.uid() = imobiliaria_id);

-- Updated_at trigger
CREATE TRIGGER update_transacoes_updated_at
  BEFORE UPDATE ON public.transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
