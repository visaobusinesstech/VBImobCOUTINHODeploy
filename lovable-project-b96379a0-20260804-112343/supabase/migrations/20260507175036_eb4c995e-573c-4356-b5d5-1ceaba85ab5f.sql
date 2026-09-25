-- Criar bucket se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao Storage
CREATE POLICY "Users can upload their own exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can see their own exports"
ON storage.objects FOR SELECT
USING (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can download from exports"
ON storage.objects FOR SELECT
USING (bucket_id = 'exports');