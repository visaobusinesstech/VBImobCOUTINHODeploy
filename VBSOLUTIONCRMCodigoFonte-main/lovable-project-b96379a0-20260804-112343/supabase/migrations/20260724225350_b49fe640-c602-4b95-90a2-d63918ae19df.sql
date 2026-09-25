
CREATE TABLE public.condominio_prospeccoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  condominio_id UUID REFERENCES public.condominios_df(id) ON DELETE SET NULL,
  condominio_nome TEXT NOT NULL,
  bairro TEXT,
  cep TEXT,
  endereco TEXT,
  telefone_portaria TEXT,
  telefone_sindico TEXT,
  nome_adm TEXT,
  email_adm TEXT,
  etapas_concluidas JSONB NOT NULL DEFAULT '[]'::jsonb,
  progresso INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluida','pausada','cancelada')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_condo_prosp_imob ON public.condominio_prospeccoes(imobiliaria_id);
CREATE INDEX idx_condo_prosp_nome ON public.condominio_prospeccoes(condominio_nome);
CREATE INDEX idx_condo_prosp_status ON public.condominio_prospeccoes(status);
CREATE UNIQUE INDEX idx_condo_prosp_imob_nome ON public.condominio_prospeccoes(imobiliaria_id, lower(condominio_nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominio_prospeccoes TO authenticated;
GRANT ALL ON public.condominio_prospeccoes TO service_role;

ALTER TABLE public.condominio_prospeccoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prosp_tenant_select" ON public.condominio_prospeccoes FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "prosp_tenant_insert" ON public.condominio_prospeccoes FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "prosp_tenant_update" ON public.condominio_prospeccoes FOR UPDATE USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "prosp_tenant_delete" ON public.condominio_prospeccoes FOR DELETE USING (imobiliaria_id = auth.uid());

CREATE TRIGGER trg_condo_prosp_updated
  BEFORE UPDATE ON public.condominio_prospeccoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Historico de mudanças
CREATE TABLE public.condominio_prospeccao_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospeccao_id UUID NOT NULL REFERENCES public.condominio_prospeccoes(id) ON DELETE CASCADE,
  imobiliaria_id UUID NOT NULL,
  tipo TEXT NOT NULL, -- 'criacao','etapa_concluida','etapa_removida','status','campo','nota'
  etapa TEXT,
  valor_anterior JSONB,
  valor_novo JSONB,
  nota TEXT,
  changed_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_condo_prosp_hist_prosp ON public.condominio_prospeccao_historico(prospeccao_id, created_at DESC);
CREATE INDEX idx_condo_prosp_hist_imob ON public.condominio_prospeccao_historico(imobiliaria_id);

GRANT SELECT, INSERT ON public.condominio_prospeccao_historico TO authenticated;
GRANT ALL ON public.condominio_prospeccao_historico TO service_role;

ALTER TABLE public.condominio_prospeccao_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prosp_hist_tenant_select" ON public.condominio_prospeccao_historico FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "prosp_hist_tenant_insert" ON public.condominio_prospeccao_historico FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());

-- Trigger para registrar mudanças automaticamente
CREATE OR REPLACE FUNCTION public.condo_prospeccao_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  antigas JSONB;
  novas JSONB;
  adicionadas JSONB;
  removidas JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.condominio_prospeccao_historico(prospeccao_id, imobiliaria_id, tipo, valor_novo, changed_by)
    VALUES (NEW.id, NEW.imobiliaria_id, 'criacao',
            jsonb_build_object('condominio_nome', NEW.condominio_nome, 'status', NEW.status),
            NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.condominio_prospeccao_historico(prospeccao_id, imobiliaria_id, tipo, valor_anterior, valor_novo, changed_by)
      VALUES (NEW.id, NEW.imobiliaria_id, 'status', to_jsonb(OLD.status), to_jsonb(NEW.status), auth.uid());
    END IF;

    IF NEW.etapas_concluidas IS DISTINCT FROM OLD.etapas_concluidas THEN
      antigas := COALESCE(OLD.etapas_concluidas, '[]'::jsonb);
      novas := COALESCE(NEW.etapas_concluidas, '[]'::jsonb);

      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO adicionadas
      FROM jsonb_array_elements_text(novas) x
      WHERE x NOT IN (SELECT jsonb_array_elements_text(antigas));

      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO removidas
      FROM jsonb_array_elements_text(antigas) x
      WHERE x NOT IN (SELECT jsonb_array_elements_text(novas));

      IF jsonb_array_length(adicionadas) > 0 THEN
        INSERT INTO public.condominio_prospeccao_historico(prospeccao_id, imobiliaria_id, tipo, valor_novo, changed_by)
        VALUES (NEW.id, NEW.imobiliaria_id, 'etapa_concluida', adicionadas, auth.uid());
      END IF;

      IF jsonb_array_length(removidas) > 0 THEN
        INSERT INTO public.condominio_prospeccao_historico(prospeccao_id, imobiliaria_id, tipo, valor_anterior, changed_by)
        VALUES (NEW.id, NEW.imobiliaria_id, 'etapa_removida', removidas, auth.uid());
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_condo_prosp_log
  AFTER INSERT OR UPDATE ON public.condominio_prospeccoes
  FOR EACH ROW EXECUTE FUNCTION public.condo_prospeccao_log_changes();
