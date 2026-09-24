/**
 * Dados estratégicos inicial (Radar + Coutinho) para realty_modulos.
 */

export type DemoModulo = {
  kind: string;
  title: string;
  status?: string;
  value?: number;
  notes?: string;
  payload?: Record<string, unknown>;
};

export const REALTY_DEMO_ROWS: DemoModulo[] = [
  {
    kind: "leads_landing",
    title: "Maria Silva",
    status: "novo",
    notes: "Quer apartamento 2–3 qts",
    payload: {
      email: "maria.silva@email.com",
      telefone: "11999887766",
      mensagem: "Vi a LP e quero visitação no fim de semana.",
      lido: "false",
      source_url: "/captacao-avaliacao",
      origem: "site",
      interesse: "compra",
      cidade: "São Paulo",
      bairro: "Pinheiros"
    }
  },
  {
    kind: "leads_landing",
    title: "João Pereira",
    status: "novo",
    payload: {
      email: "joao.p@email.com",
      telefone: "11988776655",
      mensagem: "Interesse em aluguel comercial.",
      lido: "false",
      source_url: "/venda-crm",
      origem: "google",
      interesse: "aluguel",
      cidade: "São Paulo",
      bairro: "Moema"
    }
  },
  {
    kind: "leads_landing",
    title: "Ana Costa",
    status: "lido",
    payload: {
      email: "ana.costa@email.com",
      telefone: "11977665544",
      mensagem: "Avaliação do meu apto.",
      lido: "true",
      source_url: "/captacao-avaliacao",
      origem: "instagram",
      interesse: "avaliacao",
      cidade: "São Paulo",
      bairro: "Vila Mariana"
    }
  },
  {
    kind: "pipeline_captacao",
    title: "Apto 3qts — Vila Mariana",
    status: "aberto",
    value: 890000,
    payload: {
      estagio: "Interessado",
      origem: "indicacao",
      telefone: "11966554433",
      email: "proprietario@email.com",
      imovel_endereco: "Rua Domingos de Morais, 1200",
      imovel_cidade: "São Paulo",
      imovel_bairro: "Vila Mariana",
      imovel_tipo: "apartamento",
      operacao: "venda",
      valor_estimado: 890000
    }
  },
  {
    kind: "pipeline_captacao",
    title: "Casa sobrado — Moema",
    status: "aberto",
    value: 1450000,
    payload: {
      estagio: "Avaliacao Enviada",
      origem: "radarzap",
      telefone: "11955443322",
      imovel_cidade: "São Paulo",
      imovel_bairro: "Moema",
      imovel_tipo: "casa",
      operacao: "venda",
      valor_estimado: 1450000
    }
  },
  {
    kind: "corretor",
    title: "Carlos Mendes",
    status: "ativo",
    payload: {
      email: "carlos@imobiliaria.com",
      telefone: "11944332211",
      creci: "123456-F",
      statusCorretor: "ativo",
      limite: 25,
      especialidades: "Pinheiros, Vila Madalena, compra residencial"
    }
  },
  {
    kind: "corretor",
    title: "Fernanda Lima",
    status: "ativo",
    payload: {
      email: "fernanda@imobiliaria.com",
      telefone: "11933221100",
      creci: "654321-F",
      statusCorretor: "ativo",
      limite: 20,
      especialidades: "Moema, Brooklin, alto padrão"
    }
  },
  {
    kind: "condominio",
    title: "Residencial Parque Verde",
    status: "ativo",
    payload: { sindico: "Roberto Alves", telefone: "1133334444", unidades: 120, taxa: 850 }
  },
  {
    kind: "relacionamento",
    title: "Cliente VIP — Família Souza",
    status: "ativo",
    payload: {
      tipo: "cliente",
      telefone: "11922110099",
      temperatura: "quente",
      proximoPasso: "Agendar visita comparativo"
    }
  },
  {
    kind: "automacao",
    title: "Boas-vindas lead LP",
    status: "ativo",
    payload: {
      trigger_desc: "lead_criado",
      acao: "Enviar template WhatsApp boas-vindas",
      tipo: "whatsapp",
      categoria: "comunicacao",
      ativo: "true"
    }
  },
  {
    kind: "wa_templates_captacao",
    title: "Template — 1º contato LP",
    status: "ativo",
    payload: {
      canal: "whatsapp",
      template:
        "Olá {nome}! Recebemos seu interesse pelo site. Posso te mostrar 3 opções em {bairro}?",
      variaveis: "{nome}, {bairro}"
    }
  },
  {
    kind: "radar_oportunidades",
    title: "Pinheiros — alta demanda 2qts",
    status: "aberto",
    value: 650000,
    payload: { regiao: "Pinheiros", tipo: "apartamento", score: 86, precoMedio: 650000 }
  },
  {
    kind: "config_imobiliaria",
    title: "Configuração padrão",
    status: "ativo",
    payload: {
      marca: "VB Imob Coutinho",
      cidadePadrao: "São Paulo",
      creciEmpresa: "00000-J",
      telefone: "1130000000"
    }
  },
  {
    kind: "inadimplencia",
    title: "Contrato #104 — atraso aluguel",
    status: "aberto",
    value: 4200,
    payload: { contratoRef: "104", diasAtraso: 12, valorDevido: 4200, acao: "cobranca" }
  },
  {
    kind: "feed",
    title: "Tour virtual — lançamento Moema",
    status: "publicado",
    payload: { canal: "instagram", link: "https://instagram.com/", engajamento: "1.2k views" }
  },
  {
    kind: "lgpd",
    title: "Pedido acesso — titular João",
    status: "aberto",
    payload: { tipoPedido: "acesso", titular: "João Pereira", prazo: "aberto" }
  },
  {
    kind: "monitoramento",
    title: "Alerta Zap — queda de preço Moema",
    status: "aberto",
    payload: { fonte: "portal", regiao: "Moema", alerta: "Preço médio -8%", severidade: "media" }
  },
  {
    kind: "curadoria",
    title: "Reel — before/after reforma",
    status: "aberto",
    payload: { formato: "reel", tema: "Reforma valoriza", cta: "Agende visita" }
  },
  {
    kind: "consentimento",
    title: "Opt-in marketing — Maria Silva",
    status: "ativo",
    payload: { titular: "Maria Silva", finalidade: "ofertas imóveis", concedido: "true" }
  },
  {
    kind: "pagamento_publico",
    title: "Sinal proposta #12",
    status: "aberto",
    value: 15000,
    payload: {
      cliente: "João Pereira",
      link: "https://pay.example/sinal-12",
      valorPagamento: 15000,
      statusPagamento: "pendente"
    }
  }
];

export const DEMO_BY_KIND: Record<string, DemoModulo[]> = REALTY_DEMO_ROWS.reduce(
  (acc, row) => {
    if (!acc[row.kind]) acc[row.kind] = [];
    acc[row.kind].push(row);
    return acc;
  },
  {} as Record<string, DemoModulo[]>
);
