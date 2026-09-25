
ALTER TABLE public.imoveis
  ADD COLUMN suites integer NOT NULL DEFAULT 0,
  ADD COLUMN aceita_permuta boolean NOT NULL DEFAULT false,
  ADD COLUMN valor_condominio numeric NOT NULL DEFAULT 0,
  ADD COLUMN valor_iptu numeric NOT NULL DEFAULT 0,
  ADD COLUMN andar text DEFAULT NULL,
  ADD COLUMN posicao_solar text DEFAULT NULL,
  ADD COLUMN aceita_financiamento boolean NOT NULL DEFAULT false,
  ADD COLUMN tem_escritura boolean NOT NULL DEFAULT false;
