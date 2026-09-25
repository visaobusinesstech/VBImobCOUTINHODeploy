CREATE OR REPLACE FUNCTION public.set_updated_at_lista_capt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.lista_proprietarios_captacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  nome_proprietario TEXT NOT NULL DEFAULT '',
  telefone TEXT,
  email TEXT,
  operacao TEXT NOT NULL DEFAULT 'venda',
  titulo_imovel TEXT,
  bairro TEXT,
  cidade TEXT,
  preco NUMERIC,
  q_score INTEGER,
  observacoes TEXT,
  origem TEXT DEFAULT 'captacao',
  imovel_id_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lista_proprietarios_captacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sel proprios capt" ON public.lista_proprietarios_captacao
  FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "Ins proprios capt" ON public.lista_proprietarios_captacao
  FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "Upd proprios capt" ON public.lista_proprietarios_captacao
  FOR UPDATE USING (imobiliaria_id = auth.uid());
CREATE POLICY "Del proprios capt" ON public.lista_proprietarios_captacao
  FOR DELETE USING (imobiliaria_id = auth.uid());

CREATE INDEX idx_lista_prop_capt_imobiliaria ON public.lista_proprietarios_captacao(imobiliaria_id);
CREATE INDEX idx_lista_prop_capt_operacao ON public.lista_proprietarios_captacao(operacao);

CREATE TRIGGER set_lista_prop_capt_updated_at
  BEFORE UPDATE ON public.lista_proprietarios_captacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_lista_capt();