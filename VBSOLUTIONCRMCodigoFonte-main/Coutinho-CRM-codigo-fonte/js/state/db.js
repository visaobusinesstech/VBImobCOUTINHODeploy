/**
 * Banco de Dados Local - Coutinho CRM Imobiliário
 * Estrutura relacional persistida no LocalStorage com auditoria e seed DF
 */

const STORAGE_KEY = 'coutinho_crm_database_v6';

export const INITIAL_DATA = {
  users: [
    {
      id: 'usr_admin',
      name: 'Adilson Coutinho',
      email: 'acoutinhoimoveis@gmail.com',
      role: 'ADMINISTRADOR',
      creci: '18492-DF',
      phone: '(61) 98123-4567',
      whatsapp: '61981234567',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
      status: 'ATIVO',
      specialties: ['Alto Padrão', 'Águas Claras', 'Plano Piloto', 'Avaliações'],
      regions: ['Águas Claras', 'Plano Piloto', 'Sudoeste', 'Noroeste'],
      createdAt: '2025-01-10'
    },
    {
      id: 'usr_corretor_1',
      name: 'Camila Albuquerque',
      email: 'camila.imoveis@coutinho.com.br',
      role: 'CORRETOR',
      creci: '24310-DF',
      phone: '(61) 99876-1122',
      whatsapp: '61998761122',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      status: 'ATIVO',
      specialties: ['Apartamentos 3 e 4 Quartos', 'Noroeste', 'Sudoeste'],
      regions: ['Noroeste', 'Sudoeste', 'Asa Sul'],
      createdAt: '2025-02-01'
    },
    {
      id: 'usr_corretor_2',
      name: 'Rodrigo Mendonça',
      email: 'rodrigo.mendonca@coutinho.com.br',
      role: 'CORRETOR',
      creci: '22198-DF',
      phone: '(61) 98444-5566',
      whatsapp: '61984445566',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      status: 'ATIVO',
      specialties: ['Casas em Condomínio', 'Vicente Pires', 'Park Way'],
      regions: ['Vicente Pires', 'Park Way', 'Taguatinga'],
      createdAt: '2025-02-15'
    }
  ],

  properties: [
    {
      id: 'prop_01',
      code: 'COU-104',
      title: 'Apartamento Alto Padrão 4 Suítes - SQNW 104 Noroeste',
      type: 'APARTAMENTO',
      purpose: 'VENDA',
      address: 'SQNW 104 Bloco G',
      city: 'Brasília',
      state: 'DF',
      cep: '70687-040',
      region: 'Noroeste',
      area: 186,
      bedrooms: 4,
      suites: 4,
      bathrooms: 5,
      parkingSpots: 3,
      floor: 5,
      solarPosition: 'NASCENTE',
      condoFee: 1450,
      iptu: 2800,
      salePrice: 2450000,
      rentPrice: 0,
      features: ['Varanda Gourmet', 'Churrasqueira', 'Piscina no Condomínio', 'Academia', 'Armários Planejados', 'Ar Condicionado'],
      description: 'Espetacular apartamento vazado, vista livre, finíssimo acabamento em porcelanato 120x120, automação de iluminação e som.',
      photos: [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&auto=format&fit=crop&q=80'
      ],
      ownerId: 'cli_prop_01',
      brokerId: 'usr_admin',
      status: 'DISPONIVEL',
      createdAt: '2026-07-01'
    },
    {
      id: 'prop_02',
      code: 'COU-205',
      title: 'Residencial Boulevard - 3 Quartos com Suíte - Águas Claras',
      type: 'APARTAMENTO',
      purpose: 'VENDA',
      address: 'Rua 36 Sul Lote 12',
      city: 'Brasília',
      state: 'DF',
      cep: '71931-180',
      region: 'Águas Claras',
      area: 92,
      bedrooms: 3,
      suites: 1,
      bathrooms: 2,
      parkingSpots: 2,
      floor: 12,
      solarPosition: 'PERPENDICULAR',
      condoFee: 680,
      iptu: 1100,
      salePrice: 790000,
      rentPrice: 0,
      features: ['Lazer Completo', 'Próximo ao Metrô', 'Varanda', 'Piscina Aquecida', 'Quadra Poliesportiva'],
      description: 'Apartamento reformado, andar alto, localização privilegiada a 200m da estação Concessionárias.',
      photos: [
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80'
      ],
      ownerId: 'cli_prop_02',
      brokerId: 'usr_corretor_1',
      status: 'PROPOSTA',
      createdAt: '2026-07-15'
    },
    {
      id: 'prop_03',
      code: 'COU-310',
      title: 'Casa Contemporânea em Condomínio Fechado - Vicente Pires',
      type: 'CASA',
      purpose: 'VENDA',
      address: 'Rua 08 Chácara 15',
      city: 'Brasília',
      state: 'DF',
      cep: '72007-400',
      region: 'Vicente Pires',
      area: 340,
      bedrooms: 4,
      suites: 3,
      bathrooms: 4,
      parkingSpots: 4,
      floor: 1,
      solarPosition: 'NASCENTE',
      condoFee: 250,
      iptu: 1400,
      salePrice: 1650000,
      rentPrice: 0,
      features: ['Piscina com Cascata', 'Espaço Gourmet', 'Pé Direito Duplo', 'Energia Solar', 'Condomínio Fechado'],
      description: 'Casa moderna recém-construída em lote de 400m², acabamento de alto padrão, projeto luminotécnico completo.',
      photos: [
        'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&auto=format&fit=crop&q=80'
      ],
      ownerId: 'cli_prop_03',
      brokerId: 'usr_corretor_2',
      status: 'DISPONIVEL',
      createdAt: '2026-08-01'
    }
  ],

  clients: [
    {
      id: 'cli_01',
      name: 'Eduardo Guimarães',
      type: 'COMPRADOR',
      cpfCnpj: '412.890.341-22',
      phone: '(61) 98111-2233',
      whatsapp: '61981112233',
      email: 'eduardo.guimaraes@gmail.com',
      city: 'Brasília',
      interestRegion: 'Noroeste / Sudoeste',
      propertyType: 'APARTAMENTO',
      purpose: 'VENDA',
      priceRangeMin: 2000000,
      priceRangeMax: 2600000,
      paymentMethod: 'Financiamento + Recursos Próprios',
      downPayment: 800000,
      needsFinancing: true,
      bedroomsNeeded: 4,
      parkingNeeded: 3,
      leadSource: 'PORTAL_DFIMOVEIS',
      brokerId: 'usr_admin',
      temperature: 'MUITO_QUENTE',
      status: 'ATIVO',
      lastContactAt: '2026-08-16T14:30:00Z',
      nextContactAt: '2026-08-18T10:00:00Z',
      notes: 'Cliente aprovou carta de crédito no Banco de Brasília (BRB). Busca imóvel no Noroeste com urgência.',
      createdAt: '2026-08-05'
    },
    {
      id: 'cli_02',
      name: 'Mariana Pimentel',
      type: 'COMPRADOR',
      cpfCnpj: '678.123.456-99',
      phone: '(61) 99222-7788',
      whatsapp: '61992227788',
      email: 'mariana.pimentel@advocacia.df.br',
      city: 'Brasília',
      interestRegion: 'Águas Claras',
      propertyType: 'APARTAMENTO',
      purpose: 'VENDA',
      priceRangeMin: 700000,
      priceRangeMax: 850000,
      paymentMethod: 'À Vista',
      downPayment: 790000,
      needsFinancing: false,
      bedroomsNeeded: 3,
      parkingNeeded: 2,
      leadSource: 'INSTAGRAM_ADS',
      brokerId: 'usr_corretor_1',
      temperature: 'QUENTE',
      status: 'ATIVO',
      lastContactAt: '2026-08-15T16:00:00Z',
      nextContactAt: '2026-08-17T15:30:00Z',
      notes: 'Fez proposta no Residencial Boulevard. Aguardando aceite do proprietário.',
      createdAt: '2026-08-10'
    },
    {
      id: 'cli_03',
      name: 'Gustavo Barreto',
      type: 'INVESTIDOR',
      cpfCnpj: '123.456.789-00',
      phone: '(61) 98765-4321',
      whatsapp: '61987654321',
      email: 'gustavo.barreto@invest.com.br',
      city: 'Brasília',
      interestRegion: 'Vicente Pires / Taguatinga',
      propertyType: 'CASA',
      purpose: 'VENDA',
      priceRangeMin: 1200000,
      priceRangeMax: 1800000,
      paymentMethod: 'À Vista',
      downPayment: 1500000,
      needsFinancing: false,
      bedroomsNeeded: 4,
      parkingNeeded: 4,
      leadSource: 'INDICACAO',
      brokerId: 'usr_corretor_2',
      temperature: 'MORNO',
      status: 'ATIVO',
      lastContactAt: '2026-08-12T11:00:00Z',
      nextContactAt: '2026-08-19T09:00:00Z',
      notes: 'Avalia retorno de locação e valorização em Vicente Pires.',
      createdAt: '2026-07-28'
    },
    {
      id: 'cli_prop_01',
      name: 'Marcos Vinícius Siqueira',
      type: 'PROPRIETARIO',
      cpfCnpj: '234.567.890-11',
      phone: '(61) 99123-9988',
      whatsapp: '61991239988',
      email: 'marcos.siqueira@medicina.unb.br',
      city: 'Brasília',
      interestRegion: 'Noroeste',
      propertyType: 'APARTAMENTO',
      purpose: 'VENDA',
      priceRangeMin: 2400000,
      priceRangeMax: 2500000,
      paymentMethod: 'Não aplicável',
      downPayment: 0,
      needsFinancing: false,
      bedroomsNeeded: 0,
      parkingNeeded: 0,
      leadSource: 'CAPTACAO_DIRETA',
      brokerId: 'usr_admin',
      temperature: 'QUENTE',
      status: 'ATIVO',
      lastContactAt: '2026-08-14T10:00:00Z',
      nextContactAt: '2026-08-18T16:00:00Z',
      notes: 'Proprietário do SQNW 104 Noroeste. Exclusividade acordada.',
      createdAt: '2026-06-20'
    },
    {
      id: 'cli_prop_02',
      name: 'Patrícia Nogueira',
      type: 'PROPRIETARIO',
      cpfCnpj: '345.678.901-22',
      phone: '(61) 98234-5544',
      whatsapp: '61982345544',
      email: 'patricia.nogueira@email.com',
      city: 'Brasília',
      interestRegion: 'Águas Claras',
      propertyType: 'APARTAMENTO',
      purpose: 'VENDA',
      priceRangeMin: 780000,
      priceRangeMax: 820000,
      paymentMethod: 'Não aplicável',
      downPayment: 0,
      needsFinancing: false,
      bedroomsNeeded: 0,
      parkingNeeded: 0,
      leadSource: 'INDICACAO',
      brokerId: 'usr_corretor_1',
      temperature: 'MUITO_QUENTE',
      status: 'ATIVO',
      lastContactAt: '2026-08-16T11:20:00Z',
      nextContactAt: '2026-08-17T17:00:00Z',
      notes: 'Analisando contraproposta de Mariana Pimentel.',
      createdAt: '2026-07-02'
    },
    {
      id: 'cli_prop_03',
      name: 'Dr. Valter Silveira',
      type: 'PROPRIETARIO',
      cpfCnpj: '456.789.012-33',
      phone: '(61) 99345-6677',
      whatsapp: '61993456677',
      email: 'valter.silveira@df.gov.br',
      city: 'Brasília',
      interestRegion: 'Vicente Pires',
      propertyType: 'CASA',
      purpose: 'VENDA',
      priceRangeMin: 1600000,
      priceRangeMax: 1700000,
      paymentMethod: 'Não aplicável',
      downPayment: 0,
      needsFinancing: false,
      bedroomsNeeded: 0,
      parkingNeeded: 0,
      leadSource: 'CAPTACAO_DIRETA',
      brokerId: 'usr_corretor_2',
      temperature: 'MORNO',
      status: 'ATIVO',
      lastContactAt: '2026-08-08T09:00:00Z',
      nextContactAt: '2026-08-18T14:00:00Z',
      notes: 'Solicitou relatório formal de avaliação mercadológica.',
      createdAt: '2026-07-25'
    }
  ],

  funnelStages: [
    { id: 'stg_1', name: 'Lead novo', order: 1, probability: 5, color: '#64748b' },
    { id: 'stg_2', name: 'Primeiro contato', order: 2, probability: 10, color: '#38bdf8' },
    { id: 'stg_3', name: 'Qualificação', order: 3, probability: 20, color: '#0284c7' },
    { id: 'stg_4', name: 'Imóveis apresentados', order: 4, probability: 35, color: '#6366f1' },
    { id: 'stg_5', name: 'Visita agendada', order: 5, probability: 45, color: '#8b5cf6' },
    { id: 'stg_6', name: 'Visita realizada', order: 6, probability: 60, color: '#a855f7' },
    { id: 'stg_7', name: 'Proposta', order: 7, probability: 70, color: '#ec4899' },
    { id: 'stg_8', name: 'Negociação', order: 8, probability: 80, color: '#f59e0b' },
    { id: 'stg_9', name: 'Documentação', order: 9, probability: 85, color: '#f97316' },
    { id: 'stg_10', name: 'Contrato', order: 10, probability: 90, color: '#10b981' },
    { id: 'stg_11', name: 'Fechado', order: 11, probability: 100, color: '#059669' },
    { id: 'stg_13', name: 'Em tratativa (Follow-up)', order: 12, probability: 50, color: '#0ea5e9' },
    { id: 'stg_12', name: 'Perdido', order: 13, probability: 0, color: '#ef4444' },
    { id: 'stg_14', name: 'Desistiu', order: 14, probability: 0, color: '#f43f5e' },
    { id: 'stg_15', name: 'Comprou com outra imobiliária', order: 15, probability: 0, color: '#9333ea' }
  ],

  opportunities: [
    {
      id: 'opp_01',
      title: 'Eduardo Guimarães - SQNW 104 Noroeste',
      clientId: 'cli_01',
      propertyId: 'prop_01',
      brokerId: 'usr_admin',
      stageId: 'stg_5',
      value: 2450000,
      temperature: 'MUITO_QUENTE',
      nextAction: 'Acompanhar visita presencial com a família',
      nextActionDate: '2026-08-18T10:00:00Z',
      lastContactAt: '2026-08-16T14:30:00Z',
      lostReason: null,
      createdAt: '2026-08-05'
    },
    {
      id: 'opp_02',
      title: 'Mariana Pimentel - Residencial Boulevard Águas Claras',
      clientId: 'cli_02',
      propertyId: 'prop_02',
      brokerId: 'usr_corretor_1',
      stageId: 'stg_7',
      value: 790000,
      temperature: 'QUENTE',
      nextAction: 'Colher assinatura na proposta formal',
      nextActionDate: '2026-08-17T15:30:00Z',
      lastContactAt: '2026-08-15T16:00:00Z',
      lostReason: null,
      createdAt: '2026-08-10'
    },
    {
      id: 'opp_03',
      title: 'Gustavo Barreto - Casa Vicente Pires',
      clientId: 'cli_03',
      propertyId: 'prop_03',
      brokerId: 'usr_corretor_2',
      stageId: 'stg_3',
      value: 1650000,
      temperature: 'MORNO',
      nextAction: 'Enviar comparativo de rentabilidade',
      nextActionDate: '2026-08-19T09:00:00Z',
      lastContactAt: '2026-08-12T11:00:00Z',
      lostReason: null,
      createdAt: '2026-07-28'
    },
    {
      id: 'opp_04',
      title: 'Contrato Assinado - SQN 308 Asa Norte',
      clientId: 'cli_01',
      propertyId: 'prop_01',
      brokerId: 'usr_admin',
      stageId: 'stg_11',
      value: 1350000,
      temperature: 'QUENTE',
      nextAction: 'Acompanhar registro em cartório',
      nextActionDate: '2026-08-20T14:00:00Z',
      lastContactAt: '2026-08-10T10:00:00Z',
      lostReason: null,
      createdAt: '2026-06-15'
    }
  ],

  evaluations: [
    {
      id: 'eval_01',
      title: 'Parecer Mercadológico - SQNW 104 Noroeste',
      propertyAddress: 'SQNW 104 Bloco G, Noroeste, Brasília - DF',
      propertyArea: 186,
      bedrooms: 4,
      suites: 4,
      parkingSpots: 3,
      conservationState: 'Excelente / Reformado Alto Padrão',
      brokerId: 'usr_admin',
      clientOwner: 'Marcos Vinícius Siqueira',
      notes: 'Imóvel em quadra consolidada, acabamento premium com diferenciais de automação.',
      comparables: [
        {
          address: 'SQNW 104 Bloco B',
          area: 185,
          bedrooms: 4,
          parking: 3,
          price: 2480000,
          priceM2: 13405.40,
          source: 'DFimóveis',
          date: '2026-08-01',
          url: 'https://dfimoveis.com.br/anuncio/12345'
        },
        {
          address: 'SQNW 105 Bloco E',
          area: 190,
          bedrooms: 4,
          parking: 3,
          price: 2550000,
          priceM2: 13421.05,
          source: 'Wimoveis',
          date: '2026-07-28',
          url: 'https://wimoveis.com.br/anuncio/98765'
        },
        {
          address: 'SQNW 103 Bloco A',
          area: 180,
          bedrooms: 4,
          parking: 3,
          price: 2380000,
          priceM2: 13222.22,
          source: 'OLX Imóveis',
          date: '2026-08-05',
          url: 'https://olx.com.br/anuncio/55443'
        }
      ],
      avgPriceM2: 13349.56,
      medianPriceM2: 13405.40,
      minPrice: 2380000,
      maxPrice: 2550000,
      suggestedPrice: 2483000,
      idealSalePrice: 2450000,
      strategicListingPrice: 2520000,
      status: 'CONCLUIDA',
      createdAt: '2026-08-10'
    }
  ],

  contracts: [
    {
      id: 'ctr_01',
      contractNumber: 'CTR-2026/089',
      type: 'VENDA',
      clientId: 'cli_01',
      ownerId: 'cli_prop_01',
      propertyId: 'prop_01',
      brokerId: 'usr_admin',
      startDate: '2026-08-01',
      endDate: '2026-10-30',
      totalValue: 2450000,
      commissionRate: 5,
      commissionValue: 122500,
      paymentMethod: 'Sinal R$ 490.000 + Financiamento BRB R$ 1.960.000',
      status: 'ATIVO',
      notes: 'Contrato de Promessa de Compra e Venda assinado digitalmente.',
      documents: ['minuta_assinada.pdf', 'certidoes_vendedor.pdf', 'itbi_guia.pdf'],
      createdAt: '2026-08-01'
    }
  ],

  commissions: [
    {
      id: 'comm_01',
      contractId: 'ctr_01',
      clientId: 'cli_01',
      propertyId: 'prop_01',
      brokerId: 'usr_admin',
      category: 'COMISSAO_VENDA',
      grossValue: 2450000,
      rate: 5,
      commissionAmount: 122500,
      dueDate: '2026-09-15',
      receivedDate: null,
      status: 'A_RECEBER',
      createdAt: '2026-08-01'
    },
    {
      id: 'comm_02',
      contractId: 'ctr_antigo',
      clientId: 'cli_02',
      propertyId: 'prop_02',
      brokerId: 'usr_corretor_1',
      category: 'COMISSAO_VENDA',
      grossValue: 680000,
      rate: 5,
      commissionAmount: 34000,
      dueDate: '2026-07-20',
      receivedDate: '2026-07-22',
      status: 'RECEBIDO',
      createdAt: '2026-07-01'
    }
  ],

  interactions: [
    {
      id: 'int_01',
      clientId: 'cli_01',
      brokerId: 'usr_admin',
      channel: 'WHATSAPP',
      type: 'FOLLOW_UP',
      content: 'Enviado book fotográfico da SQNW 104 e confirmação de visita com arquiteta.',
      createdAt: '2026-08-16T14:30:00Z'
    },
    {
      id: 'int_02',
      clientId: 'cli_02',
      brokerId: 'usr_corretor_1',
      channel: 'LIGACAO',
      type: 'PROPOSTA',
      content: 'Alinhada proposta de R$ 790.000 com condições de pagamento à vista.',
      createdAt: '2026-08-15T16:00:00Z'
    }
  ],

  chatChannels: [
    { id: 'chn_whatsapp', name: 'WhatsApp Business Oficial', type: 'WHATSAPP', icon: '💬', status: 'CONECTADO', phone: '(61) 98123-4567', unread: 2 },
    { id: 'chn_dfimoveis', name: 'Leads DFimóveis', type: 'PORTAL_DFIMOVEIS', icon: '🏢', status: 'CONECTADO', phone: 'API Webhook', unread: 1 },
    { id: 'chn_wimoveis', name: 'Leads Wimoveis', type: 'PORTAL_WIMOVEIS', icon: '🌐', status: 'CONECTADO', phone: 'API Webhook', unread: 0 },
    { id: 'chn_olx', name: 'Chat OLX Imóveis', type: 'PORTAL_OLX', icon: '📦', status: 'AGUARDANDO_CHAVE', phone: 'API Oficial', unread: 0 },
    { id: 'chn_meta', name: 'Instagram Direct / Meta', type: 'INSTAGRAM', icon: '📸', status: 'CONECTADO', phone: '@coutinhoimoveis.df', unread: 1 },
    { id: 'chn_email', name: 'E-mail Comercial (Gmail)', type: 'EMAIL', icon: '✉️', status: 'CONECTADO', phone: 'acoutinhoimoveis@gmail.com', unread: 0 }
  ],

  messages: [
    {
      id: 'msg_01',
      clientId: 'cli_01',
      channelId: 'chn_whatsapp',
      sender: 'CLIENT',
      senderName: 'Eduardo Guimarães',
      content: 'Boa tarde, Adilson! Conseguimos agendar a visita no apartamento da SQNW 104 para amanhã às 10h?',
      timestamp: '2026-08-16T14:15:00Z',
      status: 'ENTREGUE'
    },
    {
      id: 'msg_02',
      clientId: 'cli_01',
      channelId: 'chn_whatsapp',
      sender: 'BROKER',
      senderName: 'Adilson Coutinho',
      content: 'Perfeito, Eduardo! Já confirmei com o proprietário. Estarei na portaria às 09h50 te aguardando com o book técnico.',
      timestamp: '2026-08-16T14:22:00Z',
      status: 'LIDO'
    },
    {
      id: 'msg_03',
      clientId: 'cli_01',
      channelId: 'chn_whatsapp',
      sender: 'CLIENT',
      senderName: 'Eduardo Guimarães',
      content: 'Excelente! Minha esposa e o arquiteto vão junto para verificar os pontos de automação.',
      timestamp: '2026-08-16T14:28:00Z',
      status: 'RECEBIDO'
    },
    {
      id: 'msg_04',
      clientId: 'cli_02',
      channelId: 'chn_whatsapp',
      sender: 'CLIENT',
      senderName: 'Mariana Pimentel',
      content: 'Camila, a proposta do Residencial Boulevard é válida até quarta-feira?',
      timestamp: '2026-08-16T17:10:00Z',
      status: 'RECEBIDO'
    },
    {
      id: 'msg_05',
      clientId: 'cli_03',
      channelId: 'chn_dfimoveis',
      sender: 'CLIENT',
      senderName: 'Gustavo Barreto',
      content: 'Olá! Vi o anúncio da casa em Vicente Pires no DFimóveis. Aceita imóvel de menor valor em Águas Claras na negociação?',
      timestamp: '2026-08-15T10:05:00Z',
      status: 'RECEBIDO'
    },
    {
      id: 'msg_06',
      clientId: 'cli_prop_01',
      channelId: 'chn_meta',
      sender: 'CLIENT',
      senderName: 'Marcos Vinícius Siqueira',
      content: 'Adilson, vi a publicação da SQNW 104 no Instagram da Coutinho. Ficou impecável!',
      timestamp: '2026-08-16T19:40:00Z',
      status: 'RECEBIDO'
    }
  ],

  captures: [
    {
      id: 'cap_01',
      ownerName: 'Ricardo Silveira',
      phone: '(61) 98888-7711',
      whatsapp: '61988887711',
      email: 'ricardo.silveira@uol.com.br',
      address: 'Rua das Figueiras Lote 04',
      cep: '71900-100',
      region: 'Águas Claras',
      propertyType: 'APARTAMENTO',
      bedrooms: 3,
      suites: 1,
      bathrooms: 2,
      parkingSpots: 2,
      area: 84,
      desiredValue: 690000,
      purpose: 'VENDA',
      portalSource: 'OLX',
      adLink: 'https://df.olx.com.br/imoveis/anuncio-12399',
      notes: 'Anúncio direto do proprietário no OLX. Agendada visita para captação formal.',
      status: 'PENDENTE_AVALIACAO',
      createdAt: '2026-08-16'
    }
  ],

  radarOpportunities: [
    {
      id: 'radar_01', demo: true, title: 'Casa 3 quartos direto com proprietário', propertyType: 'CASA',
      region: 'Samambaia Sul', address: 'QR 414 (aprox.)', area: 120, bedrooms: 3, suites: 1, parkingSpots: 2,
      askingPrice: 590000, ownerClass: 'PROVAVEL_PROPRIETARIO', ownerConfidence: 82,
      classReason: 'Anúncio com linguagem de particular, sem CRECI e sem identificação de imobiliária.',
      anunciante: 'Anunciante particular (nome divulgado no anúncio)', phonePublic: '',
      sources: [{ portal: 'OLX', url: 'https://olx.com.br/...', date: '2026-08-10' }, { portal: 'Chaves na Mão', url: '', date: '2026-08-12' }],
      daysOnMarket: 87, priceDelta: 5.3, captureScore: 91, status: 'NOVA', createdAt: '2026-08-14'
    },
    {
      id: 'radar_02', demo: true, title: 'Apartamento 2 quartos com vaga', propertyType: 'APARTAMENTO',
      region: 'Taguatinga', address: 'C Norte (aprox.)', area: 62, bedrooms: 2, suites: 0, parkingSpots: 1,
      askingPrice: 340000, ownerClass: 'INCERTO', ownerConfidence: 45,
      classReason: 'Não há evidência suficiente para confirmar se é proprietário ou profissional.',
      anunciante: 'Não confirmado', phonePublic: '',
      sources: [{ portal: 'ZAP Imóveis', url: '', date: '2026-08-15' }],
      daysOnMarket: 21, priceDelta: -3.1, captureScore: 63, status: 'NOVA', createdAt: '2026-08-16'
    },
    {
      id: 'radar_03', demo: true, title: 'Cobertura alto padrão', propertyType: 'COBERTURA',
      region: 'Águas Claras', address: 'Rua das Pitangueiras (aprox.)', area: 180, bedrooms: 3, suites: 3, parkingSpots: 3,
      askingPrice: 1450000, ownerClass: 'PROVAVEL_CORRETOR', ownerConfidence: 70,
      classReason: 'Anúncio apresenta CRECI e padrão profissional de fotos.',
      anunciante: 'Profissional (CRECI informado)', phonePublic: '',
      sources: [{ portal: 'Viva Real', url: '', date: '2026-08-11' }, { portal: 'DFimóveis', url: '', date: '2026-08-11' }, { portal: 'Wimóveis', url: '', date: '2026-08-13' }],
      daysOnMarket: 142, priceDelta: 11.2, captureScore: 48, status: 'NOVA', createdAt: '2026-08-13'
    }
  ],

  reminders: [
    { id: 'rem_01', clientId: 'cli_01', type: 'ANIVERSARIO', title: 'Aniversário de Eduardo Guimarães', date: '2026-09-15', notes: '' },
    { id: 'rem_02', clientId: 'cli_02', type: 'CASAMENTO', title: 'Aniversário de casamento — Mariana e Pedro', date: '2026-10-22', notes: '10 anos de casamento' },
    { id: 'rem_03', clientId: 'cli_01', type: 'ANIVERSARIO_COMPRA', title: 'Aniversário da compra — SQNW 104', date: '2026-08-30', notes: 'Ligar para saber como estão no imóvel' },
    { id: 'rem_04', clientId: null, type: 'PESSOAL', title: 'Reunião mensal da equipe Coutinho', date: '2026-09-05', notes: 'Alinhamento de metas' }
  ],

  radarLeads: [
    { id:'rl-ac-pd-1', city:'Águas Claras', type:'Venda', title:'Apartamento 3 quartos com piscina, Norte', owner:'—', price:'R$ 550.000', cls:'owner', conf:85,
      tags:['Perfil marcado como Proprietário','1 anúncio ativo'], pains:['divulgação fraca'], portal:'Proprietário Direto',
      url:'https://www.proprietariodireto.com.br/comprar-apartamento-aguas-claras-brasilia-direto-com-proprietario/863850711218788135',
      lastSeen:'Visto há mais de 1 semana', firstSeenBySystem:'2026-08-14', lastCheckedBySystem:'2026-08-20' },
    { id:'rl-tg-olx-1', city:'Taguatinga', type:'Aluguel', title:'Aluga-se Kitnet 40m², Sophia Space', owner:'—', price:'R$ 1.000/mês', cls:'owner', conf:88,
      tags:['Tag nativa "Direto com o proprietário"','Ticket de entrada'], pains:['divulgação fraca'], portal:'OLX',
      url:'https://df.olx.com.br/distrito-federal-e-regiao/imoveis/aluga-se-kitnet-40-m-r-1-000-00-sophia-space-1527821786',
      firstSeenBySystem:'2026-08-15', lastCheckedBySystem:'2026-08-20' },
    { id:'rl-ceil-fbg-1', city:'Ceilândia', type:'Venda', title:'Casa 2 quartos direto com dono, CNM Q. 5', owner:'Roberto', price:'R$ 320.000', cls:'owner', conf:78,
      tags:['Post em grupo público de bairro','WhatsApp do dono na descrição'], pains:['corretor insistente'], portal:'Grupos de Facebook por bairro/cidade',
      url:'https://www.facebook.com/groups/ceilandia-imoveis/posts/exemplo123',
      firstSeenBySystem:'2026-08-18', lastCheckedBySystem:'2026-08-20' }
  ],

  radarConfig: {
    activePortals: ['proprietariodireto','olx','facebookgrupos'],
    activeTypes: ['Venda','Aluguel','Permuta','Ágio']
  },

  radarSources: [
    { id: 'src_zap', name: 'ZAP Imóveis', type: 'PORTAL', status: 'AGUARDANDO_API', mode: 'API oficial quando disponível' },
    { id: 'src_vivareal', name: 'Viva Real', type: 'PORTAL', status: 'AGUARDANDO_API', mode: 'API oficial quando disponível' },
    { id: 'src_olx', name: 'OLX', type: 'PORTAL', status: 'AGUARDANDO_API', mode: 'API/parceria oficial' },
    { id: 'src_chaves', name: 'Chaves na Mão', type: 'PORTAL', status: 'AGUARDANDO_API', mode: 'API oficial quando disponível' },
    { id: 'src_dfimoveis', name: 'DFimóveis', type: 'PORTAL', status: 'CONECTADO', mode: 'API oficial' },
    { id: 'src_wimoveis', name: 'Wimóveis', type: 'PORTAL', status: 'CONECTADO', mode: 'API oficial' },
    { id: 'src_google', name: 'Google Search', type: 'BUSCA', status: 'AGUARDANDO_API', mode: 'Indexação respeitando robots.txt e termos' }
  ],

  internalAnnouncements: [
    {
      id: 'ann_01',
      title: 'Meta de Captações no Noroeste e Águas Claras - Agosto 2026',
      content: 'Corretores que atingirem 5 novas captações exclusivas com laudo mercadológico terão bônus de 0.5% na comissão de fechamento.',
      authorId: 'usr_admin',
      category: 'METAS',
      createdAt: '2026-08-01'
    },
    {
      id: 'ann_02',
      title: 'Treinamento: Uso da Coutinho IA e Validação de Leads Quentes',
      content: 'Quinta-feira às 09:00 no auditório interno e online via Google Meet.',
      authorId: 'usr_admin',
      category: 'TREINAMENTO',
      createdAt: '2026-08-10'
    }
  ],

  blogPosts: [
    {
      id: 'blog_01',
      title: 'Por que o Noroeste em Brasília continua sendo o metro quadrado mais valorizado?',
      slug: 'por-que-o-noroeste-em-brasilia-continua-valorizado',
      author: 'Adilson Coutinho',
      category: 'Mercado Imobiliário DF',
      tags: ['Noroeste', 'Brasília', 'Alto Padrão', 'Investimento Imobiliário'],
      seoTitle: 'Preço do m² no Noroeste Brasília: Análise e Valorização 2026',
      metaDescription: 'Descubra por que comprar apartamento no Noroeste em Brasília garante valorização sólida e qualidade de vida incomparável.',
      mainKeyword: 'imóveis à venda Noroeste Brasília',
      secondaryKeywords: ['apartamento 4 quartos Noroeste', 'valor m2 Noroeste DF', 'comprar apartamento Noroeste'],
      content: 'O setor Noroeste consolidou-se como o bairro mais sustentável e moderno de Brasília. Com projetos arquitetônicos de alto padrão...',
      status: 'PUBLICADO',
      views: 1420,
      createdAt: '2026-08-05'
    },
    {
      id: 'blog_02',
      title: 'Guia Completo para Comprar Apartamento em Águas Claras em 2026',
      slug: 'guia-completo-comprar-apartamento-aguas-claras',
      author: 'Camila Albuquerque',
      category: 'Guia de Bairros',
      tags: ['Águas Claras', 'Metrô DF', 'Primeiro Imóvel'],
      seoTitle: 'Apartamentos em Águas Claras DF: Preços, Melhores Quadras e Dicas',
      metaDescription: 'Veja as melhores opções de apartamentos à venda em Águas Claras com proximidade do metrô, lazer completo e segurança.',
      mainKeyword: 'apartamentos à venda em Águas Claras',
      secondaryKeywords: ['imóveis Águas Claras DF', 'apartamento 3 quartos Águas Claras'],
      content: 'Águas Claras é um dos polos mais vibrantes do Distrito Federal. A facilidade de acesso ao metrô e a ampla rede de comércios...',
      status: 'PUBLICADO',
      views: 2890,
      createdAt: '2026-08-11'
    }
  ],

  automations: [
    {
      id: 'auto_01',
      name: 'Boas-vindas para Novo Lead (D0)',
      trigger: 'NOVO_LEAD',
      action: 'ENVIAR_MENSAGEM_E_CRIAR_TAREFA',
      delayDays: 0,
      active: true,
      template: 'Olá, {nome}! Aqui é da Coutinho Imóveis. Vimos seu interesse em imóveis na região {regiao}. Como posso te ajudar hoje?'
    },
    {
      id: 'auto_02',
      name: 'Follow-up Lead Parado (D3)',
      trigger: 'LEAD_PARADO_3_DIAS',
      action: 'NOTIFICAR_CORRETOR_E_SUGERIR_IA',
      delayDays: 3,
      active: true,
      template: 'Coutinho IA: O lead {nome} está há 3 dias sem contato. Segue sugestão de opções similares no perfil desejado.'
    },
    {
      id: 'auto_03',
      name: 'Alerta de Contrato Próximo do Vencimento',
      trigger: 'CONTRATO_VENCENDO_30_DIAS',
      action: 'CRIAR_TAREFA_RENOVACAO',
      delayDays: 30,
      active: true,
      template: 'O contrato {numero_contrato} vence em 30 dias. Iniciar contato com locatário/proprietário para renovação.'
    }
  ],

  settings: {
    companyName: 'Coutinho Imóveis & Consultoria Imobiliária',
    tradingName: 'Coutinho CRM Imobiliário',
    adminEmail: 'acoutinhoimoveis@gmail.com',
    creciJ: '9988-J/DF',
    cnpj: '45.123.789/0001-90',
    phone: '(61) 3345-0099',
    whatsapp: '61981234567',
    address: 'Edifício Brasília Trade Center, Salas 701-704, Asa Norte, Brasília - DF',
    primaryColor: '#0b1d3a', // Azul Marinho Coutinho
    accentColor: '#d4af37',  // Dourado Nobre
    aiName: 'Coutinho IA',
    aiEnabled: true,
    aiModel: 'claude-sonnet-5',
    integrations: {
      whatsapp: { enabled: true, officialApi: true, phoneId: 'wa_coutinho_official', status: 'CONECTADO' },
      dfimoveis: { enabled: true, apiKeyConfigured: true, autoSync: true, status: 'CONECTADO' },
      wimoveis: { enabled: true, apiKeyConfigured: true, autoSync: true, status: 'CONECTADO' },
      olx: { enabled: true, apiKeyConfigured: false, autoSync: false, status: 'AGUARDANDO_CHAVE' },
      googleCalendar: { enabled: true, status: 'CONECTADO' },
      metaAds: { enabled: true, status: 'CONECTADO' }
    }
  },

  financingBanks: [
    { id: 'caixa', name: 'Caixa Econômica Federal', annualRate: 10.49, maxFinancePct: 80, maxTermMonths: 420, fgts: true, mcmv: true, system: 'SAC', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true },
    { id: 'bb', name: 'Banco do Brasil', annualRate: 10.99, maxFinancePct: 80, maxTermMonths: 420, fgts: true, mcmv: true, system: 'SAC', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true },
    { id: 'itau', name: 'Itaú', annualRate: 11.29, maxFinancePct: 82, maxTermMonths: 360, fgts: true, mcmv: false, system: 'PRICE', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true },
    { id: 'bradesco', name: 'Bradesco', annualRate: 11.49, maxFinancePct: 80, maxTermMonths: 360, fgts: true, mcmv: false, system: 'SAC', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true },
    { id: 'santander', name: 'Santander', annualRate: 11.19, maxFinancePct: 80, maxTermMonths: 420, fgts: true, mcmv: false, system: 'PRICE', source: 'A confirmar com a instituição', updatedAt: '2026-08-01', active: true }
  ],

  financingSimulations: [],

  plans: [
    {
      id: 'plan_essencial',
      name: 'Essencial',
      tagline: 'Para o corretor autônomo começar a organizar sua carteira',
      monthly: 97,
      annual: 970,
      seats: 1,
      highlight: false,
      features: [
        'CRM de clientes e leads ilimitados',
        'Funil de vendas Kanban',
        'Cadastro de imóveis e proprietários',
        'Avaliação mercadológica básica',
        'Importação e exportação de leads',
        'Suporte por e-mail'
      ]
    },
    {
      id: 'plan_profissional',
      name: 'Profissional',
      tagline: 'O plano completo para vender mais com inteligência artificial',
      monthly: 197,
      annual: 1970,
      seats: 1,
      highlight: true,
      features: [
        'Tudo do Essencial',
        'Coutinho IA: follow-up automático e lead score',
        'Central de conversas WhatsApp e multicanais',
        'Avaliação premium com laudo PDF',
        'Simulador de financiamento',
        'Blog com SEO gerado por IA',
        'Suporte prioritário'
      ]
    },
    {
      id: 'plan_imobiliaria',
      name: 'Imobiliária',
      tagline: 'Para equipes: gestão de corretores, metas e comissões',
      monthly: 397,
      annual: 3970,
      seats: 10,
      highlight: false,
      features: [
        'Tudo do Profissional',
        'Até 10 corretores com permissões (RBAC)',
        'Gestão de comissões e financeiro',
        'Ranking e metas da equipe',
        'Contratos e alertas de vencimento',
        'Integrações com portais (DFimóveis, Wimoveis, OLX)',
        'Gerente de contas dedicado'
      ]
    }
  ],

  subscriptions: [
    {
      id: 'sub_01', userId: 'usr_admin', planId: 'plan_imobiliaria', cycle: 'ANNUAL',
      status: 'ATIVA', seatsUsed: 3, startDate: '2026-01-10', renewsAt: '2027-01-10',
      amount: 3970, method: 'PIX', createdAt: '2026-01-10'
    },
    {
      id: 'sub_02', userId: 'usr_corretor_1', planId: 'plan_profissional', cycle: 'MONTHLY',
      status: 'ATIVA', seatsUsed: 1, startDate: '2026-02-01', renewsAt: '2026-09-01',
      amount: 197, method: 'CARTAO', createdAt: '2026-02-01'
    },
    {
      id: 'sub_03', userId: 'usr_corretor_2', planId: 'plan_essencial', cycle: 'MONTHLY',
      status: 'INADIMPLENTE', seatsUsed: 1, startDate: '2026-02-15', renewsAt: '2026-08-15',
      amount: 97, method: 'BOLETO', createdAt: '2026-02-15'
    }
  ],

  payments: [
    { id: 'pay_01', subscriptionId: 'sub_01', userId: 'usr_admin', amount: 3970, method: 'PIX', status: 'PAGO', paidAt: '2026-01-10', reference: 'Assinatura anual Imobiliária' },
    { id: 'pay_02', subscriptionId: 'sub_02', userId: 'usr_corretor_1', amount: 197, method: 'CARTAO', status: 'PAGO', paidAt: '2026-08-01', reference: 'Mensalidade Profissional · Ago/2026' },
    { id: 'pay_03', subscriptionId: 'sub_02', userId: 'usr_corretor_1', amount: 197, method: 'CARTAO', status: 'PAGO', paidAt: '2026-07-01', reference: 'Mensalidade Profissional · Jul/2026' },
    { id: 'pay_04', subscriptionId: 'sub_03', userId: 'usr_corretor_2', amount: 97, method: 'BOLETO', status: 'ATRASADO', paidAt: null, reference: 'Mensalidade Essencial · Ago/2026' }
  ],

  auditLogs: [
    {
      id: 'log_01',
      userId: 'usr_admin',
      userName: 'Adilson Coutinho',
      action: 'CRIACAO',
      entity: 'PROPRIEDADE',
      entityId: 'prop_01',
      details: 'Cadastro do imóvel SQNW 104 Noroeste no valor de R$ 2.450.000',
      timestamp: '2026-08-16T10:00:00Z'
    }
  ]
};

class Database {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Garante que coleções novas existam em bancos já salvos
        ['chatChannels', 'messages', 'plans', 'subscriptions', 'payments', 'financingBanks', 'financingSimulations', 'radarOpportunities', 'radarSources', 'radarLeads', 'radarConfig', 'reminders'].forEach(col => {
          if (!parsed[col]) parsed[col] = JSON.parse(JSON.stringify(INITIAL_DATA[col] || []));
        });
        return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar banco do LocalStorage. Utilizando dados iniciais.', e);
    }
    this.save(INITIAL_DATA);
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  save(dataToSave) {
    try {
      this.data = dataToSave || this.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Falha ao salvar no LocalStorage', e);
    }
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.save(this.data);
    return this.data;
  }

  get(collection) {
    return this.data[collection] || [];
  }

  getById(collection, id) {
    const list = this.get(collection);
    return list.find(item => item.id === id);
  }

  insert(collection, record, currentUser = null) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    if (!record.id) {
      record.id = `${collection.slice(0, 3)}_${Date.now()}`;
    }
    if (!record.createdAt) {
      record.createdAt = new Date().toISOString();
    }
    this.data[collection].push(record);

    this.logAudit({
      userId: currentUser ? currentUser.id : 'usr_admin',
      userName: currentUser ? currentUser.name : 'Sistema',
      action: 'INSERCAO',
      entity: collection.toUpperCase(),
      entityId: record.id,
      details: `Novo registro em ${collection}: ${record.title || record.name || record.id}`
    });

    this.save();
    return record;
  }

  update(collection, id, updates, currentUser = null) {
    const list = this.get(collection);
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;

    const oldRecord = { ...list[index] };
    const newRecord = { ...oldRecord, ...updates, updatedAt: new Date().toISOString() };
    this.data[collection][index] = newRecord;

    this.logAudit({
      userId: currentUser ? currentUser.id : 'usr_admin',
      userName: currentUser ? currentUser.name : 'Sistema',
      action: 'EDICAO',
      entity: collection.toUpperCase(),
      entityId: id,
      details: `Atualização em ${collection} (${id}): ${Object.keys(updates).join(', ')}`
    });

    this.save();
    return newRecord;
  }

  delete(collection, id, currentUser = null) {
    const list = this.get(collection);
    const filtered = list.filter(item => item.id !== id);
    this.data[collection] = filtered;

    this.logAudit({
      userId: currentUser ? currentUser.id : 'usr_admin',
      userName: currentUser ? currentUser.name : 'Sistema',
      action: 'EXCLUSAO',
      entity: collection.toUpperCase(),
      entityId: id,
      details: `Exclusão do registro ${id} em ${collection}`
    });

    this.save();
    return true;
  }

  logAudit(entry) {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    const log = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.data.auditLogs.unshift(log);
    // Limita tamanho do log a 500 entradas
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
  }
}

export const db = new Database();
