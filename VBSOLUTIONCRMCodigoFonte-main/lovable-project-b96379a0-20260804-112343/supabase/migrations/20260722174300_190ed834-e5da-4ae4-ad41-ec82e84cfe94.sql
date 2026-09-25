
CREATE TABLE public.radarzap_leads_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.radarzap_leads(id) ON DELETE CASCADE,
  imobiliaria_id uuid NOT NULL,
  acao text NOT NULL,
  actor_user_id uuid,
  status_anterior text,
  status_novo text,
  campos_alterados jsonb NOT NULL DEFAULT '{}'::jsonb,
  revisao_notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.radarzap_leads_auditoria TO authenticated;
GRANT ALL ON public.radarzap_leads_auditoria TO service_role;

ALTER TABLE public.radarzap_leads_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "radarzap_auditoria_tenant_select" ON public.radarzap_leads_auditoria
  FOR SELECT TO authenticated
  USING (imobiliaria_id = auth.uid());

CREATE POLICY "radarzap_auditoria_tenant_insert" ON public.radarzap_leads_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (imobiliaria_id = auth.uid());

CREATE INDEX idx_rz_aud_lead ON public.radarzap_leads_auditoria(lead_id);
CREATE INDEX idx_rz_aud_imob_created ON public.radarzap_leads_auditoria(imobiliaria_id, created_at DESC);
CREATE INDEX idx_rz_aud_acao ON public.radarzap_leads_auditoria(acao);

-- Trigger: captura mudanças relevantes em radarzap_leads
CREATE OR REPLACE FUNCTION public.tg_radarzap_leads_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_changes jsonb := '{}'::jsonb;
  v_acao text := 'editado';
  v_field text;
  v_tracked text[] := ARRAY['proprietario_nome','contato','resumo','preco','bairro','cidade','tipo_imovel','operacao','is_principal','dedup_group_id','revisao_notas'];
  v_old_val text;
  v_new_val text;
BEGIN
  -- Mudança de status = aprovado/rejeitado
  IF COALESCE(NEW.status,'') <> COALESCE(OLD.status,'') THEN
    IF lower(COALESCE(NEW.status,'')) = 'aprovado' THEN
      v_acao := 'aprovado';
    ELSIF lower(COALESCE(NEW.status,'')) = 'rejeitado' THEN
      v_acao := 'rejeitado';
    ELSE
      v_acao := 'status_alterado';
    END IF;
    v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('antes', OLD.status, 'depois', NEW.status));
  END IF;

  -- Campos rastreados
  FOREACH v_field IN ARRAY v_tracked LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field, v_field)
      INTO v_old_val, v_new_val USING OLD, NEW;
    IF COALESCE(v_old_val,'') <> COALESCE(v_new_val,'') THEN
      v_changes := v_changes || jsonb_build_object(v_field, jsonb_build_object('antes', v_old_val, 'depois', v_new_val));
    END IF;
  END LOOP;

  IF v_changes = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.radarzap_leads_auditoria(
    lead_id, imobiliaria_id, acao, actor_user_id,
    status_anterior, status_novo, campos_alterados, revisao_notas
  ) VALUES (
    NEW.id, NEW.imobiliaria_id, v_acao, COALESCE(v_actor, NEW.aprovado_por),
    OLD.status, NEW.status, v_changes, NEW.revisao_notas
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_radarzap_leads_auditoria
AFTER UPDATE ON public.radarzap_leads
FOR EACH ROW EXECUTE FUNCTION public.tg_radarzap_leads_auditoria();
