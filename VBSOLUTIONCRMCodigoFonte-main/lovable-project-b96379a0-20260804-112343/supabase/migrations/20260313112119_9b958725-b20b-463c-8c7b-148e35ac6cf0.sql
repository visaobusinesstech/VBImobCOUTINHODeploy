
-- 1. Create propostas table
CREATE TABLE public.propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  imovel_id uuid REFERENCES public.imoveis(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL DEFAULT '',
  cliente_telefone text,
  cliente_email text,
  valor numeric NOT NULL DEFAULT 0,
  forma_pagamento text DEFAULT 'a_vista',
  observacoes text,
  status text NOT NULL DEFAULT 'em_negociacao',
  numero_proposta integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propostas_select" ON public.propostas FOR SELECT TO authenticated
  USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "propostas_insert" ON public.propostas FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "propostas_update" ON public.propostas FOR UPDATE TO authenticated
  USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
CREATE POLICY "propostas_delete" ON public.propostas FOR DELETE TO authenticated
  USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

-- 2. Add exclusivity date fields to imoveis
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS exclusividade_inicio date,
  ADD COLUMN IF NOT EXISTS exclusividade_fim date,
  ADD COLUMN IF NOT EXISTS comissao_percentual numeric DEFAULT 0;
