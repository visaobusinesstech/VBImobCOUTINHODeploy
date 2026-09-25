CREATE TABLE public.nutricao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria_id uuid NOT NULL,
  fluxo_id uuid NOT NULL REFERENCES public.nutricao_fluxos(id) ON DELETE CASCADE,
  inscricao_id uuid REFERENCES public.nutricao_inscricoes(id) ON DELETE SET NULL,
  envio_id uuid REFERENCES public.nutricao_envios(id) ON DELETE SET NULL,
  etapa_id uuid REFERENCES public.nutricao_etapas(id) ON DELETE SET NULL,
  lead_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('abertura','clique','resposta','agendamento','fechamento')),
  canal text,
  valor numeric,
  observacao text,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutricao_eventos TO authenticated;
GRANT ALL ON public.nutricao_eventos TO service_role;

ALTER TABLE public.nutricao_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own nutricao_eventos" ON public.nutricao_eventos
  FOR ALL TO authenticated
  USING (imobiliaria_id = auth.uid())
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE INDEX nutricao_eventos_fluxo_idx ON public.nutricao_eventos (fluxo_id, tipo, ocorrido_em DESC);
CREATE INDEX nutricao_eventos_envio_idx ON public.nutricao_eventos (envio_id);
CREATE UNIQUE INDEX nutricao_eventos_envio_tipo_uidx ON public.nutricao_eventos (envio_id, tipo) WHERE envio_id IS NOT NULL;

CREATE TRIGGER update_nutricao_eventos_updated_at
  BEFORE UPDATE ON public.nutricao_eventos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();