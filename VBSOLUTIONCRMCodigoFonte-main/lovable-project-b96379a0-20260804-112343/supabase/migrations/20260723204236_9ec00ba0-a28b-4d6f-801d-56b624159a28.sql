
-- 1. captacao_fontes_dados: add UPDATE/DELETE tenant policies
CREATE POLICY "fontes update tenant" ON public.captacao_fontes_dados
FOR UPDATE TO authenticated
USING (imobiliaria_id = auth.uid() OR is_master(auth.uid()))
WITH CHECK (imobiliaria_id = auth.uid() OR is_master(auth.uid()));

CREATE POLICY "fontes delete tenant" ON public.captacao_fontes_dados
FOR DELETE TO authenticated
USING (imobiliaria_id = auth.uid() OR is_master(auth.uid()));

-- 2. propostas: drop default so imobiliaria_id must be explicitly provided/validated
ALTER TABLE public.propostas ALTER COLUMN imobiliaria_id DROP DEFAULT;

-- 3. lgpd_titular_verificacoes: explicit deny for anon/authenticated writes
CREATE POLICY "titular_verif no client insert" ON public.lgpd_titular_verificacoes
FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "titular_verif no client update" ON public.lgpd_titular_verificacoes
FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "titular_verif no client delete" ON public.lgpd_titular_verificacoes
FOR DELETE TO anon, authenticated
USING (false);
