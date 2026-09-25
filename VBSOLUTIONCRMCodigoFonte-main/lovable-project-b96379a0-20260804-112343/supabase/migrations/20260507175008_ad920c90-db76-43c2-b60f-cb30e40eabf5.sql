-- Tabela para gerenciar exportações em lote
CREATE TABLE IF NOT EXISTS public.batch_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    imobiliaria_id UUID NOT NULL,
    filename TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    download_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.batch_exports ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view their own exports" 
ON public.batch_exports FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exports" 
ON public.batch_exports FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Tabela para os itens da fila de exportação
CREATE TABLE IF NOT EXISTS public.export_queue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES public.batch_exports(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.export_queue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export items" 
ON public.export_queue_items FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.batch_exports 
    WHERE id = export_queue_items.export_id 
    AND user_id = auth.uid()
));

CREATE POLICY "Users can insert their own export items" 
ON public.export_queue_items FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.batch_exports 
    WHERE id = export_id 
    AND user_id = auth.uid()
));

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_batch_exports_updated_at
BEFORE UPDATE ON public.batch_exports
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();