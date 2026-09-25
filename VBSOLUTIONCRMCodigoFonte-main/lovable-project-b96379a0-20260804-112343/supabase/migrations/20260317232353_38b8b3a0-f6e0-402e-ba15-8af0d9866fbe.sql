ALTER TABLE public.transacoes
  ADD COLUMN corretor_nome text DEFAULT NULL,
  ADD COLUMN parceiro_nome text DEFAULT NULL,
  ADD COLUMN captador_nome text DEFAULT NULL,
  ADD COLUMN comissao_percentual numeric DEFAULT 0,
  ADD COLUMN comissao_valor numeric DEFAULT 0,
  ADD COLUMN parceiro_comissao_percentual numeric DEFAULT 0,
  ADD COLUMN parceiro_comissao_valor numeric DEFAULT 0,
  ADD COLUMN captador_comissao_percentual numeric DEFAULT 0,
  ADD COLUMN captador_comissao_valor numeric DEFAULT 0,
  ADD COLUMN divisao_comissao text DEFAULT NULL,
  ADD COLUMN data_recebimento date DEFAULT NULL;