DROP POLICY IF EXISTS "Sel proprios capt" ON public.lista_proprietarios_captacao;
DROP POLICY IF EXISTS "Ins proprios capt" ON public.lista_proprietarios_captacao;
DROP POLICY IF EXISTS "Upd proprios capt" ON public.lista_proprietarios_captacao;
DROP POLICY IF EXISTS "Del proprios capt" ON public.lista_proprietarios_captacao;

CREATE POLICY "lista_proprietarios_captacao_select"
ON public.lista_proprietarios_captacao
FOR SELECT
TO authenticated
USING (
  public.can_access_imobiliaria(imobiliaria_id)
  AND public.is_approved(auth.uid())
);

CREATE POLICY "lista_proprietarios_captacao_insert"
ON public.lista_proprietarios_captacao
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_imobiliaria(imobiliaria_id)
  AND public.is_approved(auth.uid())
);

CREATE POLICY "lista_proprietarios_captacao_update"
ON public.lista_proprietarios_captacao
FOR UPDATE
TO authenticated
USING (
  public.can_access_imobiliaria(imobiliaria_id)
  AND public.is_approved(auth.uid())
)
WITH CHECK (
  public.can_access_imobiliaria(imobiliaria_id)
  AND public.is_approved(auth.uid())
);

CREATE POLICY "lista_proprietarios_captacao_delete"
ON public.lista_proprietarios_captacao
FOR DELETE
TO authenticated
USING (
  public.can_access_imobiliaria(imobiliaria_id)
  AND public.is_approved(auth.uid())
);