
-- Roteiros
CREATE TABLE public.condominio_roteiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  condominio_nome TEXT,
  canal TEXT NOT NULL CHECK (canal IN ('portaria','administradora','sindico','whatsapp','email','outro')),
  titulo TEXT NOT NULL,
  assunto TEXT,
  corpo TEXT NOT NULL,
  versao_atual INT NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cond_rot_imob ON public.condominio_roteiros(imobiliaria_id);
CREATE INDEX idx_cond_rot_canal ON public.condominio_roteiros(canal);
CREATE INDEX idx_cond_rot_cond ON public.condominio_roteiros(condominio_nome);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominio_roteiros TO authenticated;
GRANT ALL ON public.condominio_roteiros TO service_role;
ALTER TABLE public.condominio_roteiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rot_tenant_select" ON public.condominio_roteiros FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "rot_tenant_insert" ON public.condominio_roteiros FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "rot_tenant_update" ON public.condominio_roteiros FOR UPDATE USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "rot_tenant_delete" ON public.condominio_roteiros FOR DELETE USING (imobiliaria_id = auth.uid());
CREATE TRIGGER trg_cond_rot_updated BEFORE UPDATE ON public.condominio_roteiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Versões
CREATE TABLE public.condominio_roteiro_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id UUID NOT NULL REFERENCES public.condominio_roteiros(id) ON DELETE CASCADE,
  imobiliaria_id UUID NOT NULL,
  versao INT NOT NULL,
  titulo TEXT NOT NULL,
  assunto TEXT,
  corpo TEXT NOT NULL,
  nota TEXT,
  changed_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(roteiro_id, versao)
);
CREATE INDEX idx_cond_rot_ver_rot ON public.condominio_roteiro_versoes(roteiro_id, versao DESC);
GRANT SELECT, INSERT ON public.condominio_roteiro_versoes TO authenticated;
GRANT ALL ON public.condominio_roteiro_versoes TO service_role;
ALTER TABLE public.condominio_roteiro_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rotver_tenant_select" ON public.condominio_roteiro_versoes FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "rotver_tenant_insert" ON public.condominio_roteiro_versoes FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());

-- Trigger que grava versão sempre que titulo/assunto/corpo mudam (ou no insert)
CREATE OR REPLACE FUNCTION public.condo_roteiro_snapshot_versao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.condominio_roteiro_versoes(roteiro_id, imobiliaria_id, versao, titulo, assunto, corpo, changed_by, nota)
    VALUES (NEW.id, NEW.imobiliaria_id, NEW.versao_atual, NEW.titulo, NEW.assunto, NEW.corpo, NEW.created_by, 'Versão inicial');
    RETURN NEW;
  END IF;
  IF NEW.corpo IS DISTINCT FROM OLD.corpo
     OR NEW.titulo IS DISTINCT FROM OLD.titulo
     OR COALESCE(NEW.assunto,'') IS DISTINCT FROM COALESCE(OLD.assunto,'') THEN
    NEW.versao_atual := OLD.versao_atual + 1;
    INSERT INTO public.condominio_roteiro_versoes(roteiro_id, imobiliaria_id, versao, titulo, assunto, corpo, changed_by)
    VALUES (NEW.id, NEW.imobiliaria_id, NEW.versao_atual, NEW.titulo, NEW.assunto, NEW.corpo, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cond_rot_snapshot
  BEFORE INSERT OR UPDATE ON public.condominio_roteiros
  FOR EACH ROW EXECUTE FUNCTION public.condo_roteiro_snapshot_versao();

-- Envios
CREATE TABLE public.condominio_mensagens_enviadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  prospeccao_id UUID REFERENCES public.condominio_prospeccoes(id) ON DELETE SET NULL,
  condominio_nome TEXT NOT NULL,
  canal TEXT NOT NULL,
  roteiro_id UUID REFERENCES public.condominio_roteiros(id) ON DELETE SET NULL,
  versao INT,
  destinatario TEXT,
  destinatario_tipo TEXT,
  assunto TEXT,
  texto_final TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_by UUID DEFAULT auth.uid(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cond_env_imob ON public.condominio_mensagens_enviadas(imobiliaria_id, sent_at DESC);
CREATE INDEX idx_cond_env_cond ON public.condominio_mensagens_enviadas(condominio_nome);
CREATE INDEX idx_cond_env_prosp ON public.condominio_mensagens_enviadas(prospeccao_id);
GRANT SELECT, INSERT ON public.condominio_mensagens_enviadas TO authenticated;
GRANT ALL ON public.condominio_mensagens_enviadas TO service_role;
ALTER TABLE public.condominio_mensagens_enviadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "env_tenant_select" ON public.condominio_mensagens_enviadas FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "env_tenant_insert" ON public.condominio_mensagens_enviadas FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());
