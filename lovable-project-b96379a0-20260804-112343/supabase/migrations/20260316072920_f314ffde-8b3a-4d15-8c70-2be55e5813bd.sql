
-- Create captacoes table for property capture from different channels
CREATE TABLE public.captacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'porteiro',
  nome_contato text NOT NULL DEFAULT '',
  telefone_contato text,
  email_contato text,
  endereco_imovel text,
  bairro text,
  cidade text,
  estado text DEFAULT 'SP',
  tipo_imovel text DEFAULT 'Apartamento',
  operacao text DEFAULT 'Venda',
  nome_construtora text,
  nome_condominio text,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.captacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies (permissive, same pattern as other tables)
CREATE POLICY captacoes_select ON public.captacoes FOR SELECT TO authenticated
  USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

CREATE POLICY captacoes_insert ON public.captacoes FOR INSERT TO authenticated
  WITH CHECK ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

CREATE POLICY captacoes_update ON public.captacoes FOR UPDATE TO authenticated
  USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

CREATE POLICY captacoes_delete ON public.captacoes FOR DELETE TO authenticated
  USING ((imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid()));

-- updated_at trigger
CREATE TRIGGER set_captacoes_updated_at
  BEFORE UPDATE ON public.captacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
