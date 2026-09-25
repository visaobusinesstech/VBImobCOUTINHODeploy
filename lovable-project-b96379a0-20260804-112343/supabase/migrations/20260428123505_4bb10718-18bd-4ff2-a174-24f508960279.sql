-- Adicionar coluna para armazenar os dados brutos extraídos para auditoria
ALTER TABLE public.lista_proprietarios_captacao 
ADD COLUMN IF NOT EXISTS dados_extraidos_raw JSONB DEFAULT '{}'::jsonb;

-- Atualizar comentário
COMMENT ON COLUMN public.lista_proprietarios_captacao.dados_extraidos_raw IS 'Dados originais extraídos (texto bruto) para auditoria de falhas no parsing';