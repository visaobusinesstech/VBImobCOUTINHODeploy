
-- Bucket para anexos de contratos
INSERT INTO storage.buckets (id, name, public) VALUES ('contratos', 'contratos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for contratos bucket
CREATE POLICY "Auth users can upload contratos files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contratos');
CREATE POLICY "Auth users can view contratos files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contratos');
CREATE POLICY "Auth users can update contratos files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contratos');
CREATE POLICY "Auth users can delete contratos files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contratos');
