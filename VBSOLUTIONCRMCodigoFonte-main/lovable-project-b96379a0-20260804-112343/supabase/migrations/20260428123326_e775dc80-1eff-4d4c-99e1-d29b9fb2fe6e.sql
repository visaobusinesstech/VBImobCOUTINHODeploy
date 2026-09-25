-- Adicionar colunas para suporte a revisão manual
ALTER TABLE public.lista_proprietarios_captacao 
ADD COLUMN IF NOT EXISTS status_revisao TEXT DEFAULT 'aprovado',
ADD COLUMN IF NOT EXISTS motivo_revisao TEXT;

-- Atualizar comentários para documentação
COMMENT ON COLUMN public.lista_proprietarios_captacao.status_revisao IS 'Status da validação: aprovado, pendente_revisao, revisado';
COMMENT ON COLUMN public.lista_proprietarios_captacao.motivo_revisao IS 'Descrição do motivo pelo qual o lead caiu na revisão manual';

-- Criar índice para performance na fila de revisão
CREATE INDEX IF NOT EXISTS idx_proprietarios_revisao ON public.lista_proprietarios_captacao(status_revisao) WHERE status_revisao = 'pendente_revisao';