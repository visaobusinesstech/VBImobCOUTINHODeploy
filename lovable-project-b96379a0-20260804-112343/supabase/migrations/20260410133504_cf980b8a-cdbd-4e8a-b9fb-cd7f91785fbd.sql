
CREATE TABLE public.contrato_comprovantes_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  arquivo_url text NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, ano, mes)
);

ALTER TABLE public.contrato_comprovantes_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comprovantes"
  ON public.contrato_comprovantes_mensais FOR SELECT
  TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "Users can insert own comprovantes"
  ON public.contrato_comprovantes_mensais FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "Users can update own comprovantes"
  ON public.contrato_comprovantes_mensais FOR UPDATE
  TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id))
  WITH CHECK (public.can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "Users can delete own comprovantes"
  ON public.contrato_comprovantes_mensais FOR DELETE
  TO authenticated
  USING (public.can_access_imobiliaria(imobiliaria_id));
