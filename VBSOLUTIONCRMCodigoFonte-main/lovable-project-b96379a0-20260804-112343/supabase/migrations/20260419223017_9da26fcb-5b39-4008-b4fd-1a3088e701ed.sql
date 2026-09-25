-- Remove duplicates keeping the oldest record per (imobiliaria_id, telefone, operacao)
DELETE FROM public.lista_proprietarios_captacao a
USING public.lista_proprietarios_captacao b
WHERE a.ctid > b.ctid
  AND a.imobiliaria_id = b.imobiliaria_id
  AND a.operacao = b.operacao
  AND COALESCE(NULLIF(regexp_replace(a.telefone, '\D', '', 'g'), ''), 'NO_PHONE_' || a.id::text)
    = COALESCE(NULLIF(regexp_replace(b.telefone, '\D', '', 'g'), ''), 'NO_PHONE_' || b.id::text);

-- Add unique index on normalized phone (only when phone exists)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lista_propr_capt_tel
ON public.lista_proprietarios_captacao (
  imobiliaria_id,
  operacao,
  (regexp_replace(telefone, '\D', '', 'g'))
)
WHERE telefone IS NOT NULL AND regexp_replace(telefone, '\D', '', 'g') <> '';