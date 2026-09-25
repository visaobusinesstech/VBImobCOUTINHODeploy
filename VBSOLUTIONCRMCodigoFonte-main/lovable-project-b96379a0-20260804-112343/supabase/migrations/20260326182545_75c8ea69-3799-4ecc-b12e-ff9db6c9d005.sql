
CREATE OR REPLACE FUNCTION public.on_contrato_created_transacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create main revenue transaction from the contract
  INSERT INTO public.transacoes (
    imobiliaria_id, descricao, tipo, categoria, valor, data, status,
    imovel_id, corretor_id, canal_origem, recorrencia,
    corretor_nome, parceiro_nome, captador_nome,
    comissao_percentual, comissao_valor,
    parceiro_comissao_percentual, parceiro_comissao_valor,
    captador_comissao_percentual, captador_comissao_valor
  ) VALUES (
    NEW.imobiliaria_id,
    CASE 
      WHEN NEW.tipo = 'Locação' THEN 'Aluguel - ' || NEW.titulo
      ELSE 'Comissão Venda - ' || NEW.titulo
    END,
    'entrada',
    CASE WHEN NEW.tipo = 'Locação' THEN 'aluguel' ELSE 'comissao' END,
    NEW.valor,
    COALESCE(NEW.data_inicio, CURRENT_DATE),
    'pendente',
    NEW.imovel_id,
    NEW.corretor_id,
    NEW.canal_origem,
    CASE WHEN NEW.tipo = 'Locação' THEN 'mensal' ELSE 'nenhuma' END,
    NEW.corretor_nome,
    NEW.parceiro_nome,
    NEW.captador_nome,
    NEW.comissao_percentual,
    NEW.comissao_valor,
    NEW.parceiro_comissao_percentual,
    NEW.parceiro_comissao_valor,
    NEW.captador_comissao_percentual,
    NEW.captador_comissao_valor
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contrato_created_transacao
  AFTER INSERT ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.on_contrato_created_transacao();
