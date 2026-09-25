
-- 1. Backfill + colunas de aprovação
UPDATE public.lista_proprietarios_captacao
SET status_revisao = 'pendente'
WHERE status_revisao IS NULL
   OR status_revisao NOT IN ('pendente','em_revisao','aprovado','rejeitado');

ALTER TABLE public.lista_proprietarios_captacao
  ALTER COLUMN status_revisao SET DEFAULT 'pendente',
  ALTER COLUMN status_revisao SET NOT NULL,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revisado_por uuid,
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS rejeitado_motivo text;

-- 2. Trigger de validação de status + auditoria
CREATE OR REPLACE FUNCTION public.lista_proprietarios_captacao_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_revisao NOT IN ('pendente','em_revisao','aprovado','rejeitado') THEN
    RAISE EXCEPTION 'status_revisao invalido: %', NEW.status_revisao;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status_revisao IS DISTINCT FROM NEW.status_revisao THEN
    IF NEW.status_revisao = 'aprovado' THEN
      NEW.aprovado_por := COALESCE(NEW.aprovado_por, auth.uid());
      NEW.aprovado_em  := COALESCE(NEW.aprovado_em, now());
    END IF;
    IF NEW.status_revisao = 'rejeitado' AND (NEW.rejeitado_motivo IS NULL OR length(trim(NEW.rejeitado_motivo)) < 3) THEN
      RAISE EXCEPTION 'rejeitado_motivo obrigatorio ao rejeitar candidato';
    END IF;
    NEW.revisado_por := auth.uid();
    NEW.revisado_em  := now();

    BEGIN
      INSERT INTO public.security_audit_log (
        user_id, imobiliaria_id, event_type, table_name, record_id, metadata
      ) VALUES (
        auth.uid(),
        NEW.imobiliaria_id,
        'captacao_aprovacao_lgpd',
        'lista_proprietarios_captacao',
        NEW.id,
        jsonb_build_object(
          'de', OLD.status_revisao,
          'para', NEW.status_revisao,
          'motivo', NEW.rejeitado_motivo
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- não bloqueia a atualização se log falhar
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lista_prop_status_guard ON public.lista_proprietarios_captacao;
CREATE TRIGGER trg_lista_prop_status_guard
BEFORE INSERT OR UPDATE ON public.lista_proprietarios_captacao
FOR EACH ROW EXECUTE FUNCTION public.lista_proprietarios_captacao_status_guard();

-- 3. Função de checagem para edge functions e UI
CREATE OR REPLACE FUNCTION public.candidato_pode_contatar(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lista_proprietarios_captacao
    WHERE id = _id AND status_revisao = 'aprovado'
  );
$$;

GRANT EXECUTE ON FUNCTION public.candidato_pode_contatar(uuid) TO authenticated, service_role;

-- 4. Permissão granular: quem pode aprovar
CREATE OR REPLACE FUNCTION public.pode_aprovar_captacao(_user_id uuid, _imobiliaria_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id = _imobiliaria_id  -- dono da imobiliária sempre pode
    OR EXISTS (
      SELECT 1 FROM public.user_permissoes
      WHERE user_id = _user_id
        AND modulo = 'captacao.aprovar'
        AND ativo = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.pode_aprovar_captacao(uuid, uuid) TO authenticated, service_role;

-- 5. Policy adicional: bloqueia UPDATE de status_revisao para quem não pode aprovar
DROP POLICY IF EXISTS "lista_prop_aprovacao_restrita" ON public.lista_proprietarios_captacao;
CREATE POLICY "lista_prop_aprovacao_restrita"
ON public.lista_proprietarios_captacao
FOR UPDATE
TO authenticated
USING (
  imobiliaria_id = auth.uid()
  OR public.pode_aprovar_captacao(auth.uid(), imobiliaria_id)
)
WITH CHECK (
  imobiliaria_id = auth.uid()
  OR public.pode_aprovar_captacao(auth.uid(), imobiliaria_id)
);
