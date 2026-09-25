-- 1) Configuração de nichos no perfil da imobiliária
ALTER TABLE public.imobiliaria_config
  ADD COLUMN IF NOT EXISTS blog_nichos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blog_topicos text;

-- 2) Análises de nicho (cache de resultados IA)
CREATE TABLE IF NOT EXISTS public.blog_analises_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  nichos jsonb NOT NULL DEFAULT '[]'::jsonb,
  topicos text,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  modelo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_analises_ia TO authenticated;
GRANT ALL ON public.blog_analises_ia TO service_role;

ALTER TABLE public.blog_analises_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analise IA por imobiliaria (select)"
  ON public.blog_analises_ia FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE POLICY "Analise IA por imobiliaria (insert)"
  ON public.blog_analises_ia FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "Analise IA por imobiliaria (delete)"
  ON public.blog_analises_ia FOR DELETE TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_blog_analises_imob_created
  ON public.blog_analises_ia (imobiliaria_id, created_at DESC);

-- 3) Sugestões de conteúdo geradas pela IA
CREATE TABLE IF NOT EXISTS public.blog_sugestoes_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  analise_id uuid REFERENCES public.blog_analises_ia(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  angulo text,
  formato text,
  keyword_primaria text,
  keywords_secundarias jsonb NOT NULL DEFAULT '[]'::jsonb,
  estrutura jsonb NOT NULL DEFAULT '[]'::jsonb,
  publico_alvo text,
  potencial_seo text,
  potencial_engajamento text,
  status text NOT NULL DEFAULT 'nova',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_sugestoes_ia TO authenticated;
GRANT ALL ON public.blog_sugestoes_ia TO service_role;

ALTER TABLE public.blog_sugestoes_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sugestoes IA por imobiliaria (select)"
  ON public.blog_sugestoes_ia FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE POLICY "Sugestoes IA por imobiliaria (insert)"
  ON public.blog_sugestoes_ia FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "Sugestoes IA por imobiliaria (update)"
  ON public.blog_sugestoes_ia FOR UPDATE TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE POLICY "Sugestoes IA por imobiliaria (delete)"
  ON public.blog_sugestoes_ia FOR DELETE TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_blog_sugestoes_imob_created
  ON public.blog_sugestoes_ia (imobiliaria_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_sugestoes_status
  ON public.blog_sugestoes_ia (imobiliaria_id, status);

CREATE TRIGGER trg_blog_sugestoes_ia_updated
  BEFORE UPDATE ON public.blog_sugestoes_ia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();