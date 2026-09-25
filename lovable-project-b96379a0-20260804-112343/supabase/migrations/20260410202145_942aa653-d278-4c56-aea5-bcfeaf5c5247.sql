
CREATE TABLE public.prospeccao_diaria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  prospeccoes_aluguel integer NOT NULL DEFAULT 0,
  prospeccoes_venda integer NOT NULL DEFAULT 0,
  proprietarios_contatados integer NOT NULL DEFAULT 0,
  leads_conversados integer NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, data)
);

ALTER TABLE public.prospeccao_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospeccao_select" ON public.prospeccao_diaria
  FOR SELECT TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "prospeccao_insert" ON public.prospeccao_diaria
  FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "prospeccao_update" ON public.prospeccao_diaria
  FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "prospeccao_delete" ON public.prospeccao_diaria
  FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
