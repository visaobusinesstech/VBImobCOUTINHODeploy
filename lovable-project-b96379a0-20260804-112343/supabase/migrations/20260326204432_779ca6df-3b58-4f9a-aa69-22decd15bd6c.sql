-- Backup de segurança para impedir perda definitiva de dados do portal
CREATE TABLE IF NOT EXISTS public.deleted_records_backup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  original_id UUID,
  imobiliaria_id UUID,
  owner_user_id UUID,
  deleted_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  row_data JSONB NOT NULL,
  restored_at TIMESTAMP WITH TIME ZONE,
  restored_by UUID,
  CONSTRAINT deleted_records_backup_source_table_check CHECK (
    source_table IN ('imoveis', 'imoveis_mercado', 'lealts', 'contatos_landing')
  )
);

ALTER TABLE public.deleted_records_backup DROP CONSTRAINT IF EXISTS deleted_records_backup_source_table_check;
ALTER TABLE public.deleted_records_backup
ADD CONSTRAINT deleted_records_backup_source_table_check CHECK (
  source_table IN ('imoveis', 'imoveis_mercado', 'leads', 'contatos_landing')
);

CREATE INDEX IF NOT EXISTS idx_deleted_records_backup_source_table ON public.deleted_records_backup(source_table);
CREATE INDEX IF NOT EXISTS idx_deleted_records_backup_imobiliaria_id ON public.deleted_records_backup(imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_deleted_records_backup_deleted_at ON public.deleted_records_backup(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_records_backup_original_id ON public.deleted_records_backup(original_id);

ALTER TABLE public.deleted_records_backup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Backup records can be viewed by owner" ON public.deleted_records_backup;
CREATE POLICY "Backup records can be viewed by owner"
ON public.deleted_records_backup
FOR SELECT
TO authenticated
USING (
  (source_table = 'contatos_landing' AND is_master(auth.uid()))
  OR (imobiliaria_id IS NOT NULL AND can_access_imobiliaria(imobiliaria_id))
  OR (owner_user_id IS NOT NULL AND owner_user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.backup_deleted_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_json JSONB;
  row_imobiliaria_id UUID;
  row_owner_user_id UUID;
BEGIN
  row_json := to_jsonb(OLD);
  row_imobiliaria_id := CASE
    WHEN row_json ? 'imobiliaria_id' AND NULLIF(row_json->>'imobiliaria_id', '') IS NOT NULL
      THEN (row_json->>'imobiliaria_id')::UUID
    ELSE NULL
  END;

  row_owner_user_id := CASE
    WHEN row_json ? 'user_id' AND NULLIF(row_json->>'user_id', '') IS NOT NULL
      THEN (row_json->>'user_id')::UUID
    ELSE NULL
  END;

  INSERT INTO public.deleted_records_backup (
    source_table,
    original_id,
    imobiliaria_id,
    owner_user_id,
    deleted_by,
    row_data
  )
  VALUES (
    TG_TABLE_NAME,
    OLD.id,
    row_imobiliaria_id,
    row_owner_user_id,
    auth.uid(),
    row_json
  );

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_deleted_backup(_backup_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  backup_record public.deleted_records_backup%ROWTYPE;
BEGIN
  SELECT *
  INTO backup_record
  FROM public.deleted_records_backup
  WHERE id = _backup_id
    AND restored_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backup não encontrado ou já restaurado';
  END IF;

  IF backup_record.source_table = 'contatos_landing' THEN
    IF NOT is_master(auth.uid()) THEN
      RAISE EXCEPTION 'Sem permissão para restaurar este registro';
    END IF;
  ELSIF backup_record.imobiliaria_id IS NOT NULL THEN
    IF NOT can_access_imobiliaria(backup_record.imobiliaria_id) THEN
      RAISE EXCEPTION 'Sem permissão para restaurar este registro';
    END IF;
  ELSIF backup_record.owner_user_id IS NOT NULL THEN
    IF backup_record.owner_user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Sem permissão para restaurar este registro';
    END IF;
  ELSE
    RAISE EXCEPTION 'Sem permissão para restaurar este registro';
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
    backup_record.source_table,
    backup_record.source_table
  ) USING backup_record.row_data;

  UPDATE public.deleted_records_backup
  SET restored_at = now(),
      restored_by = auth.uid()
  WHERE id = backup_record.id;

  RETURN TRUE;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.imoveis') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS backup_imoveis_before_delete ON public.imoveis;
    CREATE TRIGGER backup_imoveis_before_delete
    BEFORE DELETE ON public.imoveis
    FOR EACH ROW
    EXECUTE FUNCTION public.backup_deleted_row();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.imoveis_mercado') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS backup_imoveis_mercado_before_delete ON public.imoveis_mercado;
    CREATE TRIGGER backup_imoveis_mercado_before_delete
    BEFORE DELETE ON public.imoveis_mercado
    FOR EACH ROW
    EXECUTE FUNCTION public.backup_deleted_row();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.leads') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS backup_leads_before_delete ON public.leads;
    CREATE TRIGGER backup_leads_before_delete
    BEFORE DELETE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.backup_deleted_row();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.contatos_landing') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS backup_contatos_landing_before_delete ON public.contatos_landing;
    CREATE TRIGGER backup_contatos_landing_before_delete
    BEFORE DELETE ON public.contatos_landing
    FOR EACH ROW
    EXECUTE FUNCTION public.backup_deleted_row();
  END IF;
END $$;