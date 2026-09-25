
-- Table to track lead journey activities/events
CREATE TABLE public.lead_atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  imobiliaria_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nota',
  titulo TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select lead_atividades" ON public.lead_atividades FOR SELECT USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert lead_atividades" ON public.lead_atividades FOR INSERT WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete lead_atividades" ON public.lead_atividades FOR DELETE USING (auth.uid() = imobiliaria_id);

-- Index for fast lookups
CREATE INDEX idx_lead_atividades_lead_id ON public.lead_atividades(lead_id);

-- Auto-create activity when lead is created
CREATE OR REPLACE FUNCTION public.on_lead_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
  VALUES (NEW.id, NEW.imobiliaria_id, 'captacao', 'Lead captado', 'Lead "' || NEW.nome || '" adicionado ao pipeline');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_created
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.on_lead_created();

-- Auto-create activity when lead stage changes
CREATE OR REPLACE FUNCTION public.on_lead_stage_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estagio IS DISTINCT FROM NEW.estagio THEN
    INSERT INTO public.lead_atividades (lead_id, imobiliaria_id, tipo, titulo, descricao)
    VALUES (NEW.id, NEW.imobiliaria_id, 'estagio', 'Mudança de estágio', 'Movido de "' || OLD.estagio || '" para "' || NEW.estagio || '"');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_stage_changed
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.on_lead_stage_changed();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_atividades;
