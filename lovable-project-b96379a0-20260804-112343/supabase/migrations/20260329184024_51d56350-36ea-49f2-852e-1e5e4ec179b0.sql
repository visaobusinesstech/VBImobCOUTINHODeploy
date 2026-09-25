
-- Fix 1: Make contratos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'contratos';

-- Fix 2: Replace permissive storage policies with ownership-scoped ones
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Auth users can upload contratos files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can view contratos files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update contratos files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete contratos files" ON storage.objects;

-- Create a helper function to check contratos ownership via imobiliaria_id
CREATE OR REPLACE FUNCTION public.owns_contrato_file(file_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contratos c
    WHERE c.id::text = split_part(file_path, '/', 1)
      AND public.can_access_imobiliaria(c.imobiliaria_id)
  )
$$;

-- New scoped policies
CREATE POLICY "contratos_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contratos'
    AND public.owns_contrato_file(name)
  );

CREATE POLICY "contratos_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contratos'
    AND public.owns_contrato_file(name)
  );

CREATE POLICY "contratos_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contratos'
    AND public.owns_contrato_file(name)
  );

CREATE POLICY "contratos_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'contratos'
    AND public.owns_contrato_file(name)
  );

-- Fix 3: Remove sensitive tables from Realtime publication, keep only notifications
ALTER PUBLICATION supabase_realtime DROP TABLE public.leads;
ALTER PUBLICATION supabase_realtime DROP TABLE public.transacoes;
ALTER PUBLICATION supabase_realtime DROP TABLE public.contratos;
ALTER PUBLICATION supabase_realtime DROP TABLE public.lead_atividades;
ALTER PUBLICATION supabase_realtime DROP TABLE public.clientes_relacionamento;
ALTER PUBLICATION supabase_realtime DROP TABLE public.followups;
ALTER PUBLICATION supabase_realtime DROP TABLE public.compromissos;
ALTER PUBLICATION supabase_realtime DROP TABLE public.mensagens_whatsapp;
