
CREATE TABLE IF NOT EXISTS public.condominio_iniciativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  condominio_id UUID NULL REFERENCES public.condominios_df(id) ON DELETE SET NULL,
  condominio_nome TEXT NOT NULL,
  bairro TEXT,
  cep TEXT,
  canal TEXT NOT NULL CHECK (canal IN ('whatsapp_business','email','facebook_groups','anuncio_geo','portaria','sindico','administradora','outro')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','em_andamento','aguardando_retorno','concluido','sem_sucesso','cancelado')),
  responsavel TEXT,
  data_agendada TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  resultado TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condo_inic_imob ON public.condominio_iniciativas(imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_condo_inic_nome ON public.condominio_iniciativas(condominio_nome);
CREATE INDEX IF NOT EXISTS idx_condo_inic_status ON public.condominio_iniciativas(status);
CREATE INDEX IF NOT EXISTS idx_condo_inic_canal ON public.condominio_iniciativas(canal);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominio_iniciativas TO authenticated;
GRANT ALL ON public.condominio_iniciativas TO service_role;

ALTER TABLE public.condominio_iniciativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iniciativas_tenant_select" ON public.condominio_iniciativas
  FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "iniciativas_tenant_insert" ON public.condominio_iniciativas
  FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "iniciativas_tenant_update" ON public.condominio_iniciativas
  FOR UPDATE USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "iniciativas_tenant_delete" ON public.condominio_iniciativas
  FOR DELETE USING (imobiliaria_id = auth.uid());

CREATE TRIGGER trg_condo_inic_updated
  BEFORE UPDATE ON public.condominio_iniciativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log timeline per iniciativa
CREATE TABLE IF NOT EXISTS public.condominio_iniciativa_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciativa_id UUID NOT NULL REFERENCES public.condominio_iniciativas(id) ON DELETE CASCADE,
  imobiliaria_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('nota','status_change','mensagem_enviada','resposta_recebida','anexo','sistema')),
  conteudo TEXT NOT NULL,
  autor TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condo_inic_log_inic ON public.condominio_iniciativa_logs(iniciativa_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.condominio_iniciativa_logs TO authenticated;
GRANT ALL ON public.condominio_iniciativa_logs TO service_role;

ALTER TABLE public.condominio_iniciativa_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iniciativa_logs_tenant_select" ON public.condominio_iniciativa_logs
  FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "iniciativa_logs_tenant_insert" ON public.condominio_iniciativa_logs
  FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "iniciativa_logs_tenant_delete" ON public.condominio_iniciativa_logs
  FOR DELETE USING (imobiliaria_id = auth.uid());

-- Auto log status changes
CREATE OR REPLACE FUNCTION public.condo_iniciativa_log_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.condominio_iniciativa_logs(iniciativa_id, imobiliaria_id, tipo, conteudo, metadata)
    VALUES (NEW.id, NEW.imobiliaria_id, 'sistema',
      'Iniciativa criada no canal ' || NEW.canal || ' (status: ' || NEW.status || ')',
      jsonb_build_object('canal', NEW.canal, 'status', NEW.status));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.condominio_iniciativa_logs(iniciativa_id, imobiliaria_id, tipo, conteudo, metadata)
    VALUES (NEW.id, NEW.imobiliaria_id, 'status_change',
      'Status alterado de "' || OLD.status || '" para "' || NEW.status || '"',
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_condo_inic_log_status
  AFTER INSERT OR UPDATE ON public.condominio_iniciativas
  FOR EACH ROW EXECUTE FUNCTION public.condo_iniciativa_log_status();
