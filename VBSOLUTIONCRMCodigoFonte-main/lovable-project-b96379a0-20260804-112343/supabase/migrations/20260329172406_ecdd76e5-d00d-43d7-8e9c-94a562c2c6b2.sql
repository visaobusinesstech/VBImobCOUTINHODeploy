
-- Make contratos bucket public so getPublicUrl works
UPDATE storage.buckets SET public = true WHERE id = 'contratos';

-- Create table for yearly contract attachments
CREATE TABLE public.contrato_anexos_anuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  ano integer NOT NULL,
  label text NOT NULL DEFAULT '',
  arquivo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contrato_anexos_anuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anexos_anuais_select" ON public.contrato_anexos_anuais FOR SELECT TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "anexos_anuais_insert" ON public.contrato_anexos_anuais FOR INSERT TO authenticated
  WITH CHECK (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "anexos_anuais_delete" ON public.contrato_anexos_anuais FOR DELETE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "anexos_anuais_update" ON public.contrato_anexos_anuais FOR UPDATE TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));
