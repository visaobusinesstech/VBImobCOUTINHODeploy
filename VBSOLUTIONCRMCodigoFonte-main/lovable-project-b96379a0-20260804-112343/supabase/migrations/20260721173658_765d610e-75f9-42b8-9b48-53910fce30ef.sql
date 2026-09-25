
-- =========================================================
-- Curadoria Viral com IA
-- =========================================================

-- 1) curadoria_temas
CREATE TABLE public.curadoria_temas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  palavras_chave TEXT[] NOT NULL DEFAULT '{}',
  fontes_permitidas TEXT[] NOT NULL DEFAULT '{}',
  fontes_bloqueadas TEXT[] NOT NULL DEFAULT '{}',
  idioma TEXT NOT NULL DEFAULT 'pt-BR',
  periodo_busca TEXT NOT NULL DEFAULT 'qdr:w', -- qdr:d, qdr:w, qdr:m
  max_por_execucao INTEGER NOT NULL DEFAULT 10,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_execucao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curadoria_temas TO authenticated;
GRANT ALL ON public.curadoria_temas TO service_role;
ALTER TABLE public.curadoria_temas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curadoria_temas_owner_all" ON public.curadoria_temas
  FOR ALL USING (auth.uid() = imobiliaria_id) WITH CHECK (auth.uid() = imobiliaria_id);

-- 2) curadoria_descobertas
CREATE TABLE public.curadoria_descobertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tema_id UUID NOT NULL REFERENCES public.curadoria_temas(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  titulo TEXT NOT NULL,
  resumo TEXT,
  autor TEXT,
  fonte_nome TEXT,
  fonte_dominio TEXT,
  imagem_url TEXT,
  publicado_em TIMESTAMP WITH TIME ZONE,
  score_viralidade NUMERIC NOT NULL DEFAULT 0,
  sinais JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'nova', -- nova, descartada, rascunho_gerado, publicada
  conteudo_seo_id UUID,
  motivo_descarte TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, url_hash)
);
CREATE INDEX idx_curadoria_descobertas_imob_status ON public.curadoria_descobertas(imobiliaria_id, status, score_viralidade DESC);
CREATE INDEX idx_curadoria_descobertas_tema ON public.curadoria_descobertas(tema_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curadoria_descobertas TO authenticated;
GRANT ALL ON public.curadoria_descobertas TO service_role;
ALTER TABLE public.curadoria_descobertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curadoria_descobertas_owner_all" ON public.curadoria_descobertas
  FOR ALL USING (auth.uid() = imobiliaria_id) WITH CHECK (auth.uid() = imobiliaria_id);

-- 3) curadoria_configuracao
CREATE TABLE public.curadoria_configuracao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  modo_publicacao TEXT NOT NULL DEFAULT 'manual', -- manual, automatico, agendado
  frequencia_horas INTEGER NOT NULL DEFAULT 4,
  max_posts_por_dia INTEGER NOT NULL DEFAULT 3,
  aprovacao_obrigatoria BOOLEAN NOT NULL DEFAULT true,
  score_minimo NUMERIC NOT NULL DEFAULT 50,
  filtros_globais JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curadoria_configuracao TO authenticated;
GRANT ALL ON public.curadoria_configuracao TO service_role;
ALTER TABLE public.curadoria_configuracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curadoria_configuracao_owner_all" ON public.curadoria_configuracao
  FOR ALL USING (auth.uid() = imobiliaria_id) WITH CHECK (auth.uid() = imobiliaria_id);

-- 4) curadoria_execucoes_log
CREATE TABLE public.curadoria_execucoes_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tema_id UUID REFERENCES public.curadoria_temas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'descoberta', -- descoberta, geracao, publicacao
  status TEXT NOT NULL DEFAULT 'sucesso', -- sucesso, erro, parcial
  descobertas_encontradas INTEGER NOT NULL DEFAULT 0,
  descobertas_novas INTEGER NOT NULL DEFAULT 0,
  posts_gerados INTEGER NOT NULL DEFAULT 0,
  duracao_ms INTEGER,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_curadoria_execucoes_log_imob ON public.curadoria_execucoes_log(imobiliaria_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curadoria_execucoes_log TO authenticated;
GRANT ALL ON public.curadoria_execucoes_log TO service_role;
ALTER TABLE public.curadoria_execucoes_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curadoria_execucoes_log_owner_select" ON public.curadoria_execucoes_log
  FOR SELECT USING (auth.uid() = imobiliaria_id);
CREATE POLICY "curadoria_execucoes_log_owner_insert" ON public.curadoria_execucoes_log
  FOR INSERT WITH CHECK (auth.uid() = imobiliaria_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.curadoria_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_curadoria_temas_updated
  BEFORE UPDATE ON public.curadoria_temas
  FOR EACH ROW EXECUTE FUNCTION public.curadoria_touch_updated_at();

CREATE TRIGGER trg_curadoria_descobertas_updated
  BEFORE UPDATE ON public.curadoria_descobertas
  FOR EACH ROW EXECUTE FUNCTION public.curadoria_touch_updated_at();

CREATE TRIGGER trg_curadoria_configuracao_updated
  BEFORE UPDATE ON public.curadoria_configuracao
  FOR EACH ROW EXECUTE FUNCTION public.curadoria_touch_updated_at();
