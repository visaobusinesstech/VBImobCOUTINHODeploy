
-- Tabela de Proprietários
CREATE TABLE public.proprietarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  nome text NOT NULL,
  cpf_cnpj text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  estado text DEFAULT 'SP',
  cep text,
  banco text,
  agencia text,
  conta text,
  pix text,
  tipo text NOT NULL DEFAULT 'ambos', -- 'venda', 'aluguel', 'ambos'
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proprietarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select proprietarios" ON public.proprietarios FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert proprietarios" ON public.proprietarios FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update proprietarios" ON public.proprietarios FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete proprietarios" ON public.proprietarios FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

-- Novos campos em contratos
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS matricula text,
  ADD COLUMN IF NOT EXISTS proprietario_id uuid REFERENCES public.proprietarios(id),
  ADD COLUMN IF NOT EXISTS indice_correcao text DEFAULT 'IGPM',
  ADD COLUMN IF NOT EXISTS percentual_correcao numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_proxima_correcao date,
  ADD COLUMN IF NOT EXISTS dia_vencimento_aluguel integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS data_vencimento_apolice date,
  ADD COLUMN IF NOT EXISTS tipo_garantia text DEFAULT 'seguro_fianca',
  ADD COLUMN IF NOT EXISTS contrato_anexo_url text,
  ADD COLUMN IF NOT EXISTS apolice_anexo_url text,
  ADD COLUMN IF NOT EXISTS vistoria_anexo_url text;

-- Trigger updated_at para proprietarios
CREATE TRIGGER handle_updated_at_proprietarios BEFORE UPDATE ON public.proprietarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
