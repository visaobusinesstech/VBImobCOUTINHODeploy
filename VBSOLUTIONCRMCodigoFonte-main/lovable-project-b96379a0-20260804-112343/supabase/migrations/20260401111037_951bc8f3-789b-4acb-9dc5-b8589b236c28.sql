
CREATE OR REPLACE FUNCTION public.on_contrato_auto_create_proprietario_captacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_proprietario_id uuid;
  prop_tipo text;
  captacao_tipo text;
  captacao_operacao text;
BEGIN
  -- Only auto-create if proprietario name is filled and no existing proprietario_id is linked
  IF NEW.proprietario IS NOT NULL AND TRIM(NEW.proprietario) <> '' AND (NEW.proprietario_id IS NULL OR NEW.proprietario_id::text = '') THEN
    
    -- Check if proprietario already exists by CPF or name for this imobiliaria
    IF NEW.proprietario_cpf IS NOT NULL AND TRIM(NEW.proprietario_cpf) <> '' THEN
      SELECT id INTO new_proprietario_id
      FROM public.proprietarios
      WHERE imobiliaria_id = NEW.imobiliaria_id
        AND cpf_cnpj = NEW.proprietario_cpf
      LIMIT 1;
    END IF;

    IF new_proprietario_id IS NULL THEN
      SELECT id INTO new_proprietario_id
      FROM public.proprietarios
      WHERE imobiliaria_id = NEW.imobiliaria_id
        AND LOWER(TRIM(nome)) = LOWER(TRIM(NEW.proprietario))
      LIMIT 1;
    END IF;

    -- Determine tipo based on contract type
    IF NEW.tipo = 'Locação' THEN
      prop_tipo := 'locacao';
      captacao_operacao := 'Locação';
    ELSE
      prop_tipo := 'venda';
      captacao_operacao := 'Venda';
    END IF;

    -- Create proprietario if not found
    IF new_proprietario_id IS NULL THEN
      INSERT INTO public.proprietarios (
        imobiliaria_id, nome, cpf_cnpj, telefone,
        tipo, canal_origem,
        conjuge_nome, conjuge_cpf,
        matricula, inscricao_iptu,
        comissao_acordada
      ) VALUES (
        NEW.imobiliaria_id,
        TRIM(NEW.proprietario),
        NULLIF(TRIM(COALESCE(NEW.proprietario_cpf, '')), ''),
        NULLIF(TRIM(COALESCE(NEW.proprietario_telefone, '')), ''),
        prop_tipo,
        NEW.canal_origem,
        NULLIF(TRIM(COALESCE(NEW.conjuge_proprietario, '')), ''),
        NULLIF(TRIM(COALESCE(NEW.conjuge_cpf, '')), ''),
        NEW.matricula,
        NEW.inscricao_iptu,
        COALESCE(NEW.comissao_percentual, 0)
      )
      RETURNING id INTO new_proprietario_id;
    END IF;

    -- Link proprietario to the contract
    IF new_proprietario_id IS NOT NULL THEN
      NEW.proprietario_id := new_proprietario_id;
    END IF;
  END IF;

  -- Auto-create captação record for the property
  IF NEW.titulo IS NOT NULL AND TRIM(NEW.titulo) <> '' THEN
    IF NEW.tipo = 'Locação' THEN
      captacao_tipo := 'proprietario';
      captacao_operacao := 'Locação';
    ELSE
      captacao_tipo := 'proprietario';
      captacao_operacao := 'Venda';
    END IF;

    INSERT INTO public.captacoes (
      imobiliaria_id, nome_contato, telefone_contato,
      tipo, operacao, status,
      endereco_imovel, observacoes
    ) VALUES (
      NEW.imobiliaria_id,
      COALESCE(NULLIF(TRIM(COALESCE(NEW.proprietario, '')), ''), NEW.cliente),
      NULLIF(TRIM(COALESCE(NEW.proprietario_telefone, '')), ''),
      captacao_tipo,
      captacao_operacao,
      'concluida',
      NEW.titulo,
      'Captação automática via contrato: ' || NEW.titulo || ' (' || NEW.tipo || ')'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger BEFORE INSERT to allow modifying NEW.proprietario_id
CREATE TRIGGER trg_contrato_auto_proprietario_captacao
  BEFORE INSERT ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.on_contrato_auto_create_proprietario_captacao();
