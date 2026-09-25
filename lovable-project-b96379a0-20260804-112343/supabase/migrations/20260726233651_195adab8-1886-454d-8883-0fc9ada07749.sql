CREATE TABLE public.condominio_historico_notas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  historico_id UUID NOT NULL REFERENCES public.condominio_prospeccao_historico(id) ON DELETE CASCADE,
  prospeccao_id UUID NOT NULL REFERENCES public.condominio_prospeccoes(id) ON DELETE CASCADE,
  imobiliaria_id UUID NOT NULL,
  autor_id UUID NOT NULL DEFAULT auth.uid(),
  autor_nome TEXT,
  visibilidade TEXT NOT NULL DEFAULT 'time',
  texto TEXT,
  anexo_path TEXT,
  anexo_nome TEXT,
  anexo_tipo TEXT,
  anexo_tamanho BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT condominio_historico_notas_visibilidade_chk CHECK (visibilidade IN ('privada','time')),
  CONSTRAINT condominio_historico_notas_conteudo_chk CHECK (
    (texto IS NOT NULL AND length(btrim(texto)) > 0) OR anexo_path IS NOT NULL
  )
);

CREATE INDEX idx_condo_hist_notas_hist ON public.condominio_historico_notas (historico_id, created_at DESC);
CREATE INDEX idx_condo_hist_notas_prosp ON public.condominio_historico_notas (prospeccao_id, created_at DESC);
CREATE INDEX idx_condo_hist_notas_imob ON public.condominio_historico_notas (imobiliaria_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominio_historico_notas TO authenticated;
GRANT ALL ON public.condominio_historico_notas TO service_role;

ALTER TABLE public.condominio_historico_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hist_notas_select" ON public.condominio_historico_notas
FOR SELECT TO authenticated
USING (imobiliaria_id = auth.uid() AND (visibilidade = 'time' OR autor_id = auth.uid()));

CREATE POLICY "hist_notas_insert" ON public.condominio_historico_notas
FOR INSERT TO authenticated
WITH CHECK (imobiliaria_id = auth.uid() AND autor_id = auth.uid());

CREATE POLICY "hist_notas_update" ON public.condominio_historico_notas
FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() AND autor_id = auth.uid())
WITH CHECK (imobiliaria_id = auth.uid() AND autor_id = auth.uid());

CREATE POLICY "hist_notas_delete" ON public.condominio_historico_notas
FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() AND autor_id = auth.uid());

CREATE TRIGGER condo_hist_notas_updated_at
BEFORE UPDATE ON public.condominio_historico_notas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();