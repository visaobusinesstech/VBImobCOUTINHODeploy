
CREATE TABLE public.mensagens_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes_relacionamento(id) ON DELETE SET NULL,
  proprietario_id UUID REFERENCES public.proprietarios(id) ON DELETE SET NULL,
  corretor_id UUID REFERENCES public.corretores(id) ON DELETE SET NULL,
  telefone_destino TEXT NOT NULL,
  nome_contato TEXT NOT NULL DEFAULT '',
  mensagem TEXT NOT NULL,
  direcao TEXT NOT NULL DEFAULT 'enviada',
  contexto TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved can select mensagens_whatsapp"
  ON public.mensagens_whatsapp FOR SELECT TO authenticated
  USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

CREATE POLICY "Approved can insert mensagens_whatsapp"
  ON public.mensagens_whatsapp FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

CREATE POLICY "Approved can delete mensagens_whatsapp"
  ON public.mensagens_whatsapp FOR DELETE TO authenticated
  USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_whatsapp;
