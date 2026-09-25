
-- Atribuir todos os leads importados ao corretor Anderson Coutinho
-- e definir canal_origem baseado no lote de importação

-- Lote 1+2 (antes de 02:15) = DF Imóveis
UPDATE leads 
SET corretor_id = '3b2bdf2b-2622-4181-9cd1-1e35f2cfe67b',
    canal_origem = 'dfimoveis'
WHERE observacoes LIKE '%📅 Contato em%' 
  AND created_at < '2026-03-14 02:15:00+00';

-- Lote 3 (após 02:15 - arquivo "mensagem") = Chave na Mão
UPDATE leads 
SET corretor_id = '3b2bdf2b-2622-4181-9cd1-1e35f2cfe67b',
    canal_origem = 'chave_na_mao'
WHERE observacoes LIKE '%📅 Contato em%' 
  AND created_at >= '2026-03-14 02:15:00+00';
