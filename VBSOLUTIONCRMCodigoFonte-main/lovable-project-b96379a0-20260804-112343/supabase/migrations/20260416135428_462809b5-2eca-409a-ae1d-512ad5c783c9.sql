
-- Allow shared users (via master_autorizacoes) to SELECT the master's imobiliaria_config
DROP POLICY IF EXISTS "config_select" ON public.imobiliaria_config;
CREATE POLICY "config_select" ON public.imobiliaria_config
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.master_autorizacoes
      WHERE master_autorizacoes.user_id = auth.uid()
        AND master_autorizacoes.master_id = imobiliaria_config.user_id
        AND master_autorizacoes.ativo = true
    )
  );
