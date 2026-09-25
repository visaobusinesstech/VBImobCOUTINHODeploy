
CREATE TABLE IF NOT EXISTS public.whatsapp_captacao_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id uuid NOT NULL UNIQUE,
  template_body text NOT NULL DEFAULT '{{saudacao}} Sou corretor(a) parceiro(a) e vi o seu anúncio ({{descricao}}).

Link de referência: {{url_anuncio}}

Tenho interesse real em conversar sobre ele. Posso te ligar ou seguimos por aqui mesmo?',
  variables jsonb NOT NULL DEFAULT '[
    {"key":"saudacao","label":"Saudação","exemplo":"Olá, João!"},
    {"key":"descricao","label":"Descrição do imóvel","exemplo":"Apto 2 quartos · Asa Norte · Brasília"},
    {"key":"url_anuncio","label":"Link do anúncio","exemplo":"https://exemplo.com/anuncio/123"}
  ]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_captacao_templates TO authenticated;
GRANT ALL ON public.whatsapp_captacao_templates TO service_role;

ALTER TABLE public.whatsapp_captacao_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_own_template" ON public.whatsapp_captacao_templates
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid() OR public.can_access_imobiliaria(imobiliaria_id));

CREATE POLICY "tenant_insert_own_template" ON public.whatsapp_captacao_templates
  FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "tenant_update_own_template" ON public.whatsapp_captacao_templates
  FOR UPDATE TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "tenant_delete_own_template" ON public.whatsapp_captacao_templates
  FOR DELETE TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE TRIGGER trg_whatsapp_captacao_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_captacao_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
