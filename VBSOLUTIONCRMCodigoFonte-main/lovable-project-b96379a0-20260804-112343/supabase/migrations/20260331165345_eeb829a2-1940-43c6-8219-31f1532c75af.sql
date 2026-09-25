-- Create proprietarios storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('proprietarios', 'proprietarios', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "prop_storage_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proprietarios'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read their own files
CREATE POLICY "prop_storage_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'proprietarios'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own files
CREATE POLICY "prop_storage_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'proprietarios'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own files
CREATE POLICY "prop_storage_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'proprietarios'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);