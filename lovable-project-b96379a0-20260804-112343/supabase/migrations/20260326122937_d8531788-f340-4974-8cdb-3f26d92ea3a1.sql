ALTER TABLE public.proprietarios
ADD COLUMN IF NOT EXISTS saldo_devedor boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parcela_atraso_financiamento boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parcela_atraso_condominio boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parcela_atraso_iptu boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS quitado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS averbacao boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS dados_imovel_endereco text,
ADD COLUMN IF NOT EXISTS dados_imovel_tipo text,
ADD COLUMN IF NOT EXISTS dados_imovel_area numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS exclusividade_contrato_url text;