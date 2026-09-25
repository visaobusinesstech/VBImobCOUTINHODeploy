CREATE TABLE public.mensagem_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  tipo text NOT NULL, -- 'aniversario', 'casamento', 'profissao', 'filho_aniversario'
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, tipo)
);

ALTER TABLE public.mensagem_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select mensagem_templates" ON public.mensagem_templates FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert mensagem_templates" ON public.mensagem_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update mensagem_templates" ON public.mensagem_templates FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete mensagem_templates" ON public.mensagem_templates FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.mensagem_templates FOR EACH ROW EXECUTE FUNCTION handle_updated_at();