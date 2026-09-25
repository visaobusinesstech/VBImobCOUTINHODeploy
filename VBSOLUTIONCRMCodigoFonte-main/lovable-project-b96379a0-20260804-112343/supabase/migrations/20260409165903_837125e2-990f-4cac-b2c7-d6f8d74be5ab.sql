
-- Create private bucket for property legal documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('imoveis-docs', 'imoveis-docs', false)
ON CONFLICT (id) DO NOTHING;

-- SELECT: owner can view their own docs
CREATE POLICY "Users can view their own property docs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'imoveis-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- INSERT: owner can upload their own docs
CREATE POLICY "Users can upload their own property docs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imoveis-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- DELETE: owner can delete their own docs
CREATE POLICY "Users can delete their own property docs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'imoveis-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);
