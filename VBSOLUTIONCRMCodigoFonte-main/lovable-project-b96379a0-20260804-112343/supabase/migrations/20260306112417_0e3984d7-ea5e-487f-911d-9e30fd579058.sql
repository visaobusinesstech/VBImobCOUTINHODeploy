
CREATE TABLE public.followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  data_followup DATE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'ligacao',
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select followups" ON public.followups FOR SELECT TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can insert followups" ON public.followups FOR INSERT TO authenticated WITH CHECK (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can update followups" ON public.followups FOR UPDATE TO authenticated USING (auth.uid() = imobiliaria_id);
CREATE POLICY "Owner can delete followups" ON public.followups FOR DELETE TO authenticated USING (auth.uid() = imobiliaria_id);

CREATE TRIGGER handle_followups_updated_at BEFORE UPDATE ON public.followups FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.followups;
