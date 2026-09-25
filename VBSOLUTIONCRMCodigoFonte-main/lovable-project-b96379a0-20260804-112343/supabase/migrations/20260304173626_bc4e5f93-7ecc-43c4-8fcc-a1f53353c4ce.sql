ALTER TABLE public.clientes_relacionamento 
  ADD COLUMN data_mudanca date DEFAULT NULL,
  ADD COLUMN data_compra_imovel date DEFAULT NULL;