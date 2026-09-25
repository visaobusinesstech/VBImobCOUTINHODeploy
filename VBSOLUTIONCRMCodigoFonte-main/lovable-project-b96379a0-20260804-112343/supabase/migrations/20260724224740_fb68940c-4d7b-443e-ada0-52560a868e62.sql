
CREATE TABLE IF NOT EXISTS public.condominio_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  condominio_id UUID NULL REFERENCES public.condominios_df(id) ON DELETE SET NULL,
  condominio_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('administradora','sindico','portaria','imobiliaria','outro')),
  nome TEXT,
  cargo TEXT,
  telefone TEXT,
  email TEXT,
  url_fonte TEXT NOT NULL,
  trecho_fonte TEXT,
  confianca INTEGER NOT NULL DEFAULT 50 CHECK (confianca BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','verificado','invalido','contatado')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condo_ct_imob ON public.condominio_contatos(imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_condo_ct_nome ON public.condominio_contatos(condominio_nome);
CREATE INDEX IF NOT EXISTS idx_condo_ct_tipo ON public.condominio_contatos(tipo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_condo_ct_dedup
  ON public.condominio_contatos(imobiliaria_id, condominio_nome, COALESCE(telefone,''), COALESCE(email,''), tipo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominio_contatos TO authenticated;
GRANT ALL ON public.condominio_contatos TO service_role;

ALTER TABLE public.condominio_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_tenant_select" ON public.condominio_contatos
  FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "cc_tenant_insert" ON public.condominio_contatos
  FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "cc_tenant_update" ON public.condominio_contatos
  FOR UPDATE USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "cc_tenant_delete" ON public.condominio_contatos
  FOR DELETE USING (imobiliaria_id = auth.uid());

CREATE TRIGGER trg_condo_ct_updated
  BEFORE UPDATE ON public.condominio_contatos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.condominio_enriquecimento_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  condominio_nome TEXT NOT NULL,
  bairro TEXT,
  cep TEXT,
  consultas JSONB NOT NULL DEFAULT '[]'::jsonb,
  fontes JSONB NOT NULL DEFAULT '[]'::jsonb,
  contatos_encontrados INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sucesso' CHECK (status IN ('sucesso','parcial','erro','sem_resultados')),
  erro TEXT,
  duracao_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cer_imob ON public.condominio_enriquecimento_runs(imobiliaria_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.condominio_enriquecimento_runs TO authenticated;
GRANT ALL ON public.condominio_enriquecimento_runs TO service_role;

ALTER TABLE public.condominio_enriquecimento_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cer_tenant_select" ON public.condominio_enriquecimento_runs
  FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "cer_tenant_insert" ON public.condominio_enriquecimento_runs
  FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "cer_tenant_delete" ON public.condominio_enriquecimento_runs
  FOR DELETE USING (imobiliaria_id = auth.uid());
