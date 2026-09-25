
-- Fix 1: Set search_path on cleanup_old_notifications function
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
END;
$function$;

-- Fix 2: Tighten RLS "always true" INSERT policies on leads (anon)
-- Restrict anon inserts to only allow setting specific safe fields
DROP POLICY IF EXISTS "leads_anon_insert" ON public.leads;
CREATE POLICY "leads_anon_insert"
  ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (
    nome IS NOT NULL
    AND char_length(nome) <= 200
    AND imobiliaria_id IS NOT NULL
    AND estagio = 'novos'
  );

-- Fix contatos_landing anon insert
DROP POLICY IF EXISTS "contatos_anon_insert" ON public.contatos_landing;
CREATE POLICY "contatos_anon_insert"
  ON public.contatos_landing
  FOR INSERT
  TO anon
  WITH CHECK (
    nome IS NOT NULL
    AND char_length(nome) <= 200
    AND email IS NOT NULL
    AND char_length(email) <= 255
    AND mensagem IS NOT NULL
    AND char_length(mensagem) <= 2000
  );

-- Fix contatos_landing auth insert
DROP POLICY IF EXISTS "contatos_auth_insert" ON public.contatos_landing;
CREATE POLICY "contatos_auth_insert"
  ON public.contatos_landing
  FOR INSERT
  TO authenticated
  WITH CHECK (
    nome IS NOT NULL
    AND char_length(nome) <= 200
    AND email IS NOT NULL
    AND char_length(email) <= 255
    AND mensagem IS NOT NULL
    AND char_length(mensagem) <= 2000
  );
