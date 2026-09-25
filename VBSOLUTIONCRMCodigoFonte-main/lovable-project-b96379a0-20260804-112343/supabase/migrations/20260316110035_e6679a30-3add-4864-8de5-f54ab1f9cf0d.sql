
DROP POLICY IF EXISTS "transacoes_select" ON public.transacoes;

CREATE POLICY "transacoes_select"
ON public.transacoes
FOR SELECT
TO authenticated
USING (
  (imobiliaria_id = get_master_user_id()) AND (auth.uid() = '0f78835c-9aa7-411d-97d3-33d499953a1f'::uuid)
);
