-- Create table for tenant AI analysis
CREATE TABLE public.analise_inquilino (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  inquilino_nome TEXT NOT NULL DEFAULT '',
  inquilino_cpf TEXT,
  inquilino_email TEXT,
  inquilino_telefone TEXT,
  inquilino_renda NUMERIC DEFAULT 0,
  inquilino_profissao TEXT,
  tipo_garantia TEXT DEFAULT 'fiador',
  fiador_nome TEXT,
  fiador_cpf TEXT,
  fiador_renda NUMERIC DEFAULT 0,
  fiador_profissao TEXT,
  fiador_imovel_proprio BOOLEAN DEFAULT false,
  seguradora_nome TEXT,
  seguradora_apolice TEXT,
  caucao_valor NUMERIC DEFAULT 0,
  valor_aluguel NUMERIC NOT NULL DEFAULT 0,
  valor_condominio NUMERIC DEFAULT 0,
  valor_iptu NUMERIC DEFAULT 0,
  score_geral INTEGER DEFAULT 0,
  risco TEXT DEFAULT 'pendente',
  capacidade_pagamento_pct NUMERIC DEFAULT 0,
  analise_detalhada JSONB DEFAULT '{}'::jsonb,
  resumo_ia TEXT,
  recomendacao_ia TEXT,
  pontos_positivos JSONB DEFAULT '[]'::jsonb,
  pontos_negativos JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analise_inquilino ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "analise_inquilino_select" ON public.analise_inquilino
  FOR SELECT USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "analise_inquilino_insert" ON public.analise_inquilino
  FOR INSERT WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "analise_inquilino_update" ON public.analise_inquilino
  FOR UPDATE USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "analise_inquilino_delete" ON public.analise_inquilino
  FOR DELETE USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_analise_inquilino_updated_at
  BEFORE UPDATE ON public.analise_inquilino
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();