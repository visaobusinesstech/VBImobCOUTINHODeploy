
CREATE TABLE public.imoveis_mercado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  portal text NOT NULL,
  url_anuncio text,
  titulo text NOT NULL,
  tipo text DEFAULT 'Apartamento',
  operacao text DEFAULT 'Venda',
  bairro text,
  cidade text,
  estado text DEFAULT 'SP',
  preco numeric DEFAULT 0,
  area numeric DEFAULT 0,
  quartos integer DEFAULT 0,
  banheiros integer DEFAULT 0,
  vagas integer DEFAULT 0,
  preco_m2 numeric DEFAULT 0,
  dias_anuncio integer DEFAULT 0,
  data_scraping timestamp with time zone DEFAULT now(),
  dados_raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.imoveis_mercado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select imoveis_mercado" ON public.imoveis_mercado FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert imoveis_mercado" ON public.imoveis_mercado FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete imoveis_mercado" ON public.imoveis_mercado FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);
