CREATE UNIQUE INDEX IF NOT EXISTS lista_proprietarios_captacao_unique_tel
ON public.lista_proprietarios_captacao (
  imobiliaria_id,
  operacao,
  regexp_replace(coalesce(telefone, ''), '\D', '', 'g')
)
WHERE telefone IS NOT NULL AND length(regexp_replace(telefone, '\D', '', 'g')) >= 8;