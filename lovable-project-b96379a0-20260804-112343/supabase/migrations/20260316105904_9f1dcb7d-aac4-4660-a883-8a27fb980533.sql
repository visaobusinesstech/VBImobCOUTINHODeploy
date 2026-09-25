
DROP POLICY IF EXISTS "transacoes_select" ON public.transacoes;

CREATE POLICY "transacoes_select"
ON public.transacoes
FOR SELECT
TO authenticated
USING (
  (imobiliaria_id = get_master_user_id()) AND is_master(auth.uid())
);
