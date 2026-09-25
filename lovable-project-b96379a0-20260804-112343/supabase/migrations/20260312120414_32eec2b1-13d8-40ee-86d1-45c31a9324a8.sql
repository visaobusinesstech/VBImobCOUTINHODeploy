
CREATE TABLE public.avaliacoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'Apartamento',
  operacao text NOT NULL DEFAULT 'Venda',
  area numeric NOT NULL DEFAULT 0,
  quartos integer NOT NULL DEFAULT 0,
  bairro text,
  cidade text,
  estado text,
  preco_informado numeric DEFAULT 0,
  valor_minimo numeric NOT NULL DEFAULT 0,
  valor_ideal numeric NOT NULL DEFAULT 0,
  valor_maximo numeric NOT NULL DEFAULT 0,
  preco_m2_estimado numeric DEFAULT 0,
  preco_m2_regiao numeric DEFAULT 0,
  score_liquidez integer DEFAULT 0,
  classificacao_liquidez text DEFAULT 'media',
  analise_resumo text,
  pontos_fortes jsonb DEFAULT '[]'::jsonb,
  pontos_atencao jsonb DEFAULT '[]'::jsonb,
  estrategia_venda text,
  portais_recomendados jsonb DEFAULT '[]'::jsonb,
  sugestao_preco_inicial numeric DEFAULT 0,
  probabilidade_venda_30dias integer DEFAULT 0,
  probabilidade_venda_60dias integer DEFAULT 0,
  probabilidade_venda_90dias integer DEFAULT 0,
  preco_competitivo boolean DEFAULT false,
  imovel_id uuid,
  modo text DEFAULT 'manual',
  comparaveis_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avaliacoes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avaliacoes_historico_select" ON public.avaliacoes_historico
  FOR SELECT TO authenticated
  USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

CREATE POLICY "avaliacoes_historico_insert" ON public.avaliacoes_historico
  FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));

CREATE POLICY "avaliacoes_historico_delete" ON public.avaliacoes_historico
  FOR DELETE TO authenticated
  USING (imobiliaria_id = get_master_user_id() AND is_approved(auth.uid()));
