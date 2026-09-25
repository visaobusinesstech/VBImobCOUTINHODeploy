
CREATE OR REPLACE FUNCTION public.on_contrato_updated_sync_transacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the linked transaction when contract fields change
  UPDATE public.transacoes
  SET
    descricao = CASE 
      WHEN NEW.tipo = 'Locação' THEN 'Aluguel - ' || NEW.titulo
      ELSE 'Comissão Venda - ' || NEW.titulo
    END,
    valor = NEW.valor,
    categoria = CASE WHEN NEW.tipo = 'Locação' THEN 'aluguel' ELSE 'comissao' END,
    imovel_id = NEW.imovel_id,
    corretor_id = NEW.corretor_id,
    canal_origem = NEW.canal_origem,
    recorrencia = CASE WHEN NEW.tipo = 'Locação' THEN 'mensal' ELSE 'nenhuma' END,
    corretor_nome = NEW.corretor_nome,
    parceiro_nome = NEW.parceiro_nome,
    captador_nome = NEW.captador_nome,
    comissao_percentual = NEW.comissao_percentual,
    comissao_valor = NEW.comissao_valor,
    parceiro_comissao_percentual = NEW.parceiro_comissao_percentual,
    parceiro_comissao_valor = NEW.parceiro_comissao_valor,
    captador_comissao_percentual = NEW.captador_comissao_percentual,
    captador_comissao_valor = NEW.captador_comissao_valor,
    numero_unidade = NEW.numero_unidade,
    proprietario_nome = NEW.proprietario,
    proprietario_telefone = NEW.proprietario_telefone,
    proprietario_cpf = NEW.proprietario_cpf,
    imposto_tipo = NEW.imposto_tipo,
    imposto_percentual = NEW.imposto_percentual,
    imposto_valor = NEW.imposto_valor,
    valor_iptu = NEW.valor_iptu,
    valor_condominio = NEW.valor_condominio,
    updated_at = now()
  WHERE imobiliaria_id = NEW.imobiliaria_id
    AND (
      (NEW.tipo = 'Locação' AND descricao LIKE 'Aluguel - %')
      OR (NEW.tipo != 'Locação' AND descricao LIKE 'Comissão Venda - %')
    )
    AND (
      descricao = 'Aluguel - ' || OLD.titulo
      OR descricao = 'Comissão Venda - ' || OLD.titulo
    );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_contrato_updated_sync_transacao
AFTER UPDATE ON public.contratos
FOR EACH ROW
EXECUTE FUNCTION public.on_contrato_updated_sync_transacao();
