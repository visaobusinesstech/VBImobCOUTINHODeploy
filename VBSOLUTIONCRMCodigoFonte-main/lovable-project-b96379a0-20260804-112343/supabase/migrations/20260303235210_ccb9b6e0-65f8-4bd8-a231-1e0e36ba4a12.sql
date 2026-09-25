
-- Feature flags table for module-level toggles per imobiliaria
CREATE TABLE public.modulo_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  modulo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(imobiliaria_id, modulo)
);

ALTER TABLE public.modulo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select modulo_config" ON public.modulo_config FOR SELECT USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert modulo_config" ON public.modulo_config FOR INSERT WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update modulo_config" ON public.modulo_config FOR UPDATE USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete modulo_config" ON public.modulo_config FOR DELETE USING (auth.uid() = imobiliaria_id);

CREATE TRIGGER update_modulo_config_updated_at BEFORE UPDATE ON public.modulo_config FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
