
CREATE TABLE public.condominio_prospeccao_agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id UUID NOT NULL,
  prospeccao_id UUID NOT NULL REFERENCES public.condominio_prospeccoes(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL CHECK (etapa IN ('portaria','administradora','sindico','canais_publicos','registro_lgpd','custom')),
  descricao TEXT,
  agendado_para TIMESTAMPTZ NOT NULL,
  tentativa_num INT NOT NULL DEFAULT 1,
  max_tentativas INT NOT NULL DEFAULT 3,
  intervalo_dias INT NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida','sem_resposta','cancelada','pausada','expirada')),
  pausado_ate TIMESTAMPTZ,
  motivo_pausa TEXT,
  parent_id UUID REFERENCES public.condominio_prospeccao_agendamentos(id) ON DELETE SET NULL,
  observacao TEXT,
  concluido_em TIMESTAMPTZ,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prosp_ag_imob ON public.condominio_prospeccao_agendamentos(imobiliaria_id);
CREATE INDEX idx_prosp_ag_prosp ON public.condominio_prospeccao_agendamentos(prospeccao_id);
CREATE INDEX idx_prosp_ag_status ON public.condominio_prospeccao_agendamentos(status);
CREATE INDEX idx_prosp_ag_when ON public.condominio_prospeccao_agendamentos(agendado_para);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominio_prospeccao_agendamentos TO authenticated;
GRANT ALL ON public.condominio_prospeccao_agendamentos TO service_role;

ALTER TABLE public.condominio_prospeccao_agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prosp_ag_tenant_select" ON public.condominio_prospeccao_agendamentos FOR SELECT USING (imobiliaria_id = auth.uid());
CREATE POLICY "prosp_ag_tenant_insert" ON public.condominio_prospeccao_agendamentos FOR INSERT WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "prosp_ag_tenant_update" ON public.condominio_prospeccao_agendamentos FOR UPDATE USING (imobiliaria_id = auth.uid()) WITH CHECK (imobiliaria_id = auth.uid());
CREATE POLICY "prosp_ag_tenant_delete" ON public.condominio_prospeccao_agendamentos FOR DELETE USING (imobiliaria_id = auth.uid());

CREATE TRIGGER trg_prosp_ag_updated BEFORE UPDATE ON public.condominio_prospeccao_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para concluir uma tentativa e (opcionalmente) criar a próxima
CREATE OR REPLACE FUNCTION public.condo_prosp_agendamento_concluir(
  _id UUID,
  _resultado TEXT,           -- 'concluida' ou 'sem_resposta'
  _observacao TEXT DEFAULT NULL,
  _agendar_proxima BOOLEAN DEFAULT true
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ag RECORD;
  nova_id UUID;
  proxima_data TIMESTAMPTZ;
BEGIN
  SELECT * INTO ag FROM public.condominio_prospeccao_agendamentos
    WHERE id = _id AND imobiliaria_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou sem permissão';
  END IF;
  IF _resultado NOT IN ('concluida','sem_resposta') THEN
    RAISE EXCEPTION 'Resultado inválido';
  END IF;

  UPDATE public.condominio_prospeccao_agendamentos
    SET status = _resultado,
        observacao = COALESCE(_observacao, observacao),
        concluido_em = now()
    WHERE id = _id;

  IF _resultado = 'concluida' OR NOT _agendar_proxima THEN
    RETURN NULL;
  END IF;

  IF ag.tentativa_num >= ag.max_tentativas THEN
    UPDATE public.condominio_prospeccao_agendamentos
      SET status = 'pausada',
          pausado_ate = now() + interval '14 days',
          motivo_pausa = 'Limite de tentativas atingido — pausado por 14 dias'
      WHERE id = _id;
    RETURN NULL;
  END IF;

  proxima_data := now() + (ag.intervalo_dias || ' days')::interval;

  INSERT INTO public.condominio_prospeccao_agendamentos(
    imobiliaria_id, prospeccao_id, etapa, descricao,
    agendado_para, tentativa_num, max_tentativas, intervalo_dias,
    parent_id, created_by
  ) VALUES (
    ag.imobiliaria_id, ag.prospeccao_id, ag.etapa, ag.descricao,
    proxima_data, ag.tentativa_num + 1, ag.max_tentativas, ag.intervalo_dias,
    ag.id, auth.uid()
  ) RETURNING id INTO nova_id;

  RETURN nova_id;
END;
$$;

REVOKE ALL ON FUNCTION public.condo_prosp_agendamento_concluir(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.condo_prosp_agendamento_concluir(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
