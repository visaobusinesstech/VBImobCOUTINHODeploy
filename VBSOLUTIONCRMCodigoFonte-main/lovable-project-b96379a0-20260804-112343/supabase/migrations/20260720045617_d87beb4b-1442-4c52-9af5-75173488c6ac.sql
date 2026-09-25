
CREATE TABLE public.seo_correcoes_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  route_path TEXT NOT NULL,
  tag_key TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, route_path, tag_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_correcoes_checklist TO authenticated;
GRANT ALL ON public.seo_correcoes_checklist TO service_role;

ALTER TABLE public.seo_correcoes_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manages own SEO checklist"
  ON public.seo_correcoes_checklist FOR ALL
  USING (auth.uid() = imobiliaria_id)
  WITH CHECK (auth.uid() = imobiliaria_id);

CREATE TRIGGER seo_correcoes_checklist_updated_at
  BEFORE UPDATE ON public.seo_correcoes_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_seo_correcoes_tenant_route
  ON public.seo_correcoes_checklist (imobiliaria_id, route_path);
