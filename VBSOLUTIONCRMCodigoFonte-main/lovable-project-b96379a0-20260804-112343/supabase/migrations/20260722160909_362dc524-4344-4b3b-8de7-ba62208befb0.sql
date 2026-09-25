
CREATE TABLE IF NOT EXISTS public.radarzap_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  invite_url text NOT NULL,
  nome text,
  descricao text,
  categoria text,
  cidade text,
  uf text DEFAULT 'DF',
  bairro text,
  origem text DEFAULT 'busca',
  status text DEFAULT 'novo',
  ultimo_scan timestamptz,
  total_mensagens int DEFAULT 0,
  total_leads int DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (imobiliaria_id, invite_url)
);
CREATE INDEX IF NOT EXISTS idx_radarzap_grupos_imob ON public.radarzap_grupos(imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_radarzap_grupos_status ON public.radarzap_grupos(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radarzap_grupos TO authenticated;
GRANT ALL ON public.radarzap_grupos TO service_role;
ALTER TABLE public.radarzap_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "radarzap_grupos_tenant" ON public.radarzap_grupos
  FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.radarzap_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  grupo_id uuid REFERENCES public.radarzap_grupos(id) ON DELETE SET NULL,
  texto text NOT NULL,
  autor_hash text,
  autor_contato text,
  data_mensagem timestamptz DEFAULT now(),
  analisado boolean DEFAULT false,
  tem_imovel boolean DEFAULT false,
  intencao text,
  score_intencao int DEFAULT 0,
  extraido jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_radarzap_msg_imob ON public.radarzap_mensagens(imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_radarzap_msg_grupo ON public.radarzap_mensagens(grupo_id);
CREATE INDEX IF NOT EXISTS idx_radarzap_msg_analisado ON public.radarzap_mensagens(analisado);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radarzap_mensagens TO authenticated;
GRANT ALL ON public.radarzap_mensagens TO service_role;
ALTER TABLE public.radarzap_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "radarzap_msg_tenant" ON public.radarzap_mensagens
  FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.radarzap_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  mensagem_id uuid REFERENCES public.radarzap_mensagens(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.radarzap_grupos(id) ON DELETE SET NULL,
  tipo_imovel text,
  operacao text,
  bairro text,
  cidade text,
  preco numeric,
  contato text,
  proprietario_nome text,
  resumo text,
  status text DEFAULT 'novo',
  lead_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_radarzap_leads_imob ON public.radarzap_leads(imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_radarzap_leads_status ON public.radarzap_leads(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radarzap_leads TO authenticated;
GRANT ALL ON public.radarzap_leads TO service_role;
ALTER TABLE public.radarzap_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "radarzap_leads_tenant" ON public.radarzap_leads
  FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());
