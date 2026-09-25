
-- 1. Tabela de autorizações do master para ver dados de outros usuários
CREATE TABLE public.master_autorizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_id, user_id)
);

ALTER TABLE public.master_autorizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_auth_select" ON public.master_autorizacoes
FOR SELECT TO authenticated
USING (is_master(auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "master_auth_insert" ON public.master_autorizacoes
FOR INSERT TO authenticated
WITH CHECK (is_master(auth.uid()));

CREATE POLICY "master_auth_update" ON public.master_autorizacoes
FOR UPDATE TO authenticated
USING (is_master(auth.uid()));

CREATE POLICY "master_auth_delete" ON public.master_autorizacoes
FOR DELETE TO authenticated
USING (is_master(auth.uid()));

-- 2. Função para verificar se o usuário pode acessar dados de uma imobiliária
CREATE OR REPLACE FUNCTION public.can_access_imobiliaria(_imobiliaria_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Próprios dados
    _imobiliaria_id = auth.uid()
    OR
    -- Master com autorização
    (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_master = true)
      AND EXISTS (
        SELECT 1 FROM public.master_autorizacoes
        WHERE master_id = auth.uid()
        AND user_id = _imobiliaria_id
        AND ativo = true
      )
    )
$$;

-- 3. Atualizar get_user_imobiliaria_id para retornar auth.uid() (cada user é sua própria imobiliária)
CREATE OR REPLACE FUNCTION public.get_user_imobiliaria_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- 4. Atualizar trigger de propostas para usar auth.uid()
CREATE OR REPLACE FUNCTION public.set_proposta_imobiliaria_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  NEW.imobiliaria_id := auth.uid();
  RETURN NEW;
END;
$function$;

-- 5. Atualizar default da coluna propostas.imobiliaria_id
ALTER TABLE public.propostas ALTER COLUMN imobiliaria_id SET DEFAULT auth.uid();
