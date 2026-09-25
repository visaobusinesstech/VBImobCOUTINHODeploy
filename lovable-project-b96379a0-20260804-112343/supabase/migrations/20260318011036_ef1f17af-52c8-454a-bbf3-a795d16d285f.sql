
CREATE TABLE public.metas_dashboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'leads_mes',
  meta_valor numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.metas_dashboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_select" ON public.metas_dashboard FOR SELECT TO authenticated
  USING (can_access_imobiliaria(imobiliaria_id) AND is_approved(auth.uid()));

CREATE POLICY "metas_insert" ON public.metas_dashboard FOR INSERT TO authenticated
  WITH CHECK ((imobiliaria_id = auth.uid()) AND is_approved(auth.uid()));

CREATE POLICY "metas_update" ON public.metas_dashboard FOR UPDATE TO authenticated
  USING ((imobiliaria_id = auth.uid()) AND is_approved(auth.uid()));

CREATE POLICY "metas_delete" ON public.metas_dashboard FOR DELETE TO authenticated
  USING ((imobiliaria_id = auth.uid()) AND is_approved(auth.uid()));
