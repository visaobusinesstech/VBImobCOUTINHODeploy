
-- Tabela de permissões por usuário (quais módulos cada user pode acessar)
CREATE TABLE public.user_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, modulo)
);

ALTER TABLE public.user_permissoes ENABLE ROW LEVEL SECURITY;

-- Master pode gerenciar tudo
CREATE POLICY "user_permissoes_select"
ON public.user_permissoes FOR SELECT
TO authenticated
USING (
  is_master(auth.uid()) OR auth.uid() = user_id
);

CREATE POLICY "user_permissoes_insert"
ON public.user_permissoes FOR INSERT
TO authenticated
WITH CHECK (is_master(auth.uid()));

CREATE POLICY "user_permissoes_update"
ON public.user_permissoes FOR UPDATE
TO authenticated
USING (is_master(auth.uid()));

CREATE POLICY "user_permissoes_delete"
ON public.user_permissoes FOR DELETE
TO authenticated
USING (is_master(auth.uid()));

-- Reverter RLS de transacoes ao padrão original
DROP POLICY IF EXISTS "transacoes_select" ON public.transacoes;
CREATE POLICY "transacoes_select"
ON public.transacoes
FOR SELECT
TO authenticated
USING (
  (imobiliaria_id = get_master_user_id()) AND is_approved(auth.uid())
);
