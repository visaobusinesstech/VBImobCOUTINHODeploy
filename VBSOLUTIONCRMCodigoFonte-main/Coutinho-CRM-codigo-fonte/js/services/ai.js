/**
 * Coutinho IA
 * Camada local demonstrativa. Nenhuma mensagem externa é enviada sem API oficial configurada.
 */
import { db } from '../state/db.js';
import { toCurrency } from './evaluation.js';

function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  const now = new Date();
  const then = new Date(isoDate);
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function getHotLeads() {
  return db.get('clients').filter(client => ['QUENTE', 'MUITO_QUENTE'].includes(client.temperature) && client.type !== 'PROPRIETARIO');
}

function getStaleLeads(days = 3) {
  return db.get('clients').filter(client => client.type !== 'PROPRIETARIO' && daysSince(client.lastContactAt) >= days);
}

function getReceivables() {
  return db.get('commissions').filter(commission => ['A_RECEBER', 'PREVISTO', 'ATRASADO'].includes(commission.status));
}

function getAvailableProperties() {
  return db.get('properties').filter(property => property.status === 'DISPONIVEL');
}

function getOwnersNeedingReply() {
  return db.get('clients').filter(client => client.type === 'PROPRIETARIO' && daysSince(client.lastContactAt) >= 3);
}

function getWeeklyEvaluations() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return db.get('evaluations').filter(evaluation => new Date(evaluation.createdAt) >= weekAgo);
}

function getBrokerOpportunities() {
  return db.get('users').filter(user => user.role === 'CORRETOR' || user.role === 'ADMINISTRADOR').map(broker => ({
    broker,
    opportunities: db.get('opportunities').filter(opportunity => opportunity.brokerId === broker.id && !['stg_11', 'stg_12'].includes(opportunity.stageId)),
  })).sort((a, b) => b.opportunities.length - a.opportunities.length);
}

export const aiService = {
  getGreeting() {
    const stale = getStaleLeads();
    const hot = getHotLeads();
    return `Bom dia. Monitorei sua operação: ${hot.length} leads quentes exigem atenção e ${stale.length} leads estão sem contato há mais de três dias. Por onde começamos?`;
  },

  query(question) {
    const text = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    if (text.includes('sem contato') || text.includes('sem follow') || text.includes('parado')) {
      const stale = getStaleLeads();
      if (!stale.length) return { title: 'Todos os leads estão acompanhados', answer: 'Não identifiquei leads sem contato há mais de três dias.', type: 'success', items: [] };
      return {
        title: `${stale.length} leads precisam de follow-up`,
        answer: `Priorize estes clientes. Preparei ações compatíveis com cada perfil e respectiva última interação.`,
        type: 'warning',
        items: stale.map(client => ({
          title: client.name,
          subtitle: `${client.interestRegion} · ${client.propertyType} · último contato há ${daysSince(client.lastContactAt)} dias`,
          tag: client.temperature,
          action: `Sugerir mensagem de retomada`
        }))
      };
    }

    if (text.includes('quente') || text.includes('probabilidade') || text.includes('fechamento')) {
      const hot = getHotLeads();
      return {
        title: `${hot.length} leads com alta intenção`,
        answer: `Leads classificados como Quente ou Muito quente, ordenados pela urgência da próxima ação.`,
        type: 'hot',
        items: hot.map(client => ({
          title: client.name,
          subtitle: `${client.interestRegion} · até ${toCurrency(client.priceRangeMax)} · próximo contato: ${new Date(client.nextContactAt).toLocaleDateString('pt-BR')}`,
          tag: client.temperature,
          action: 'Abrir oportunidade'
        }))
      };
    }

    if (text.includes('receber') || text.includes('comissao') || text.includes('financeiro')) {
      const receivables = getReceivables();
      const total = receivables.reduce((acc, commission) => acc + commission.commissionAmount, 0);
      return {
        title: `${toCurrency(total)} a receber`,
        answer: `${receivables.length} comissão(ões) em aberto. O maior recebível está associado à venda da SQNW 104.`,
        type: 'financial',
        items: receivables.map(commission => {
          const property = db.getById('properties', commission.propertyId);
          const broker = db.getById('users', commission.brokerId);
          return {
            title: property ? property.title : 'Imóvel não identificado',
            subtitle: `${broker ? broker.name : 'Corretor'} · vencimento: ${new Date(commission.dueDate).toLocaleDateString('pt-BR')}`,
            tag: toCurrency(commission.commissionAmount),
            action: 'Abrir comissão'
          };
        })
      };
    }

    if (text.includes('imovel') && (text.includes('parado') || text.includes('disponivel'))) {
      const properties = getAvailableProperties();
      return {
        title: `${properties.length} imóveis disponíveis`,
        answer: 'Estes imóveis exigem ação comercial: nova divulgação, atualização de preço ou matching com leads ativos.',
        type: 'property',
        items: properties.map(property => ({
          title: property.title,
          subtitle: `${property.region} · ${property.bedrooms} quartos · ${toCurrency(property.salePrice || property.rentPrice)}`,
          tag: property.code,
          action: 'Ver imóvel'
        }))
      };
    }

    if (text.includes('proprietario') && (text.includes('retorno') || text.includes('resposta'))) {
      const owners = getOwnersNeedingReply();
      return {
        title: `${owners.length} proprietários aguardam retorno`,
        answer: 'Organizei proprietários sem atividade recente. Uma atualização objetiva de mercado preserva a confiança na captação.',
        type: 'warning',
        items: owners.map(owner => ({
          title: owner.name,
          subtitle: `${owner.interestRegion} · último contato há ${daysSince(owner.lastContactAt)} dias`,
          tag: 'PROPRIETÁRIO',
          action: 'Criar retorno'
        }))
      };
    }

    if (text.includes('avaliac') && text.includes('semana')) {
      const evaluations = getWeeklyEvaluations();
      return {
        title: `${evaluations.length} avaliações nesta semana`,
        answer: evaluations.length ? 'Avaliações recentes concluídas e prontas para apresentação ao proprietário.' : 'Não há avaliações registradas nos últimos sete dias.',
        type: 'property',
        items: evaluations.map(evaluation => ({
          title: evaluation.title,
          subtitle: `${evaluation.clientOwner} · valor recomendado: ${toCurrency(evaluation.idealSalePrice)}`,
          tag: evaluation.status,
          action: 'Abrir avaliação'
        }))
      };
    }

    if ((text.includes('probabilidade') || text.includes('maior chance') || text.includes('top') || (text.includes('leads') && text.includes('fechar')))) {
      const top = this.getTopLeads(10);
      return {
        title: 'Leads com maior probabilidade de fechar',
        answer: 'Ranking calculado pelo Lead Score comportamental (respostas, perfil financeiro, visitas e propostas).',
        type: 'hot',
        items: top.map(({ client, score }) => ({
          title: `${client.name} — ${score}/100`,
          subtitle: `${client.interestRegion || 'DF'} · ${client.propertyType} · até ${toCurrency(client.priceRangeMax)}`,
          tag: `${score} pts`,
          action: 'Abrir lead'
        }))
      };
    }

    if (text.includes('corretor') && (text.includes('oportunidade') || text.includes('mais'))) {
      const brokers = getBrokerOpportunities();
      return {
        title: 'Oportunidades por corretor',
        answer: brokers.length ? `${brokers[0].broker.name} possui maior carteira ativa no momento.` : 'Ainda não há oportunidades em andamento.',
        type: 'team',
        items: brokers.map(({ broker, opportunities }) => ({
          title: broker.name,
          subtitle: `${opportunities.length} oportunidade(s) ativa(s) · potencial: ${toCurrency(opportunities.reduce((sum, item) => sum + item.value, 0))}`,
          tag: broker.role,
          action: 'Ver carteira'
        }))
      };
    }

    return {
      title: 'Como posso ajudar?',
      answer: 'Consigo consultar leads sem follow-up, clientes quentes, valores a receber, imóveis disponíveis, proprietários aguardando retorno, avaliações recentes e oportunidades por corretor.',
      type: 'info',
      items: []
    };
  },

  suggestFollowUp(client) {
    const property = db.get('properties').find(item => item.region.toLowerCase().includes(client.interestRegion.split('/')[0].trim().toLowerCase()));
    const firstName = client.name.split(' ')[0];
    return `Olá, ${firstName}! Separei algumas atualizações alinhadas ao seu interesse em ${client.interestRegion}. ${property ? `O ${property.title} segue disponível e pode ser uma excelente alternativa dentro do perfil que conversamos.` : 'Posso refinar a busca conforme suas prioridades.'} Posso te apresentar as opções hoje?`;
  },

  scoreLead(client) {
    let score = 0;
    const breakdown = [];
    const add = (points, label) => { score += points; breakdown.push({ points, label }); };

    const interactions = db.get('interactions').filter(i => i.clientId === client.id);
    const channels = new Set(interactions.map(i => i.channel));
    const types = new Set(interactions.map(i => i.type));
    const opps = db.get('opportunities').filter(o => o.clientId === client.id);
    const stageIds = new Set(opps.map(o => o.stageId));

    if (channels.has('WHATSAPP') || db.get('messages').some(m => m.clientId === client.id && m.sender === 'CLIENT')) add(10, 'Respondeu WhatsApp');
    if (client.needsFinancing !== undefined) add(10, 'Informou renda/perfil financeiro');
    if (client.downPayment > 0) add(15, 'Informou entrada disponível');
    if (client.needsFinancing === true) add(15, 'Solicitou financiamento');
    if (stageIds.has('stg_4') || types.has('IMOVEIS_ENVIADOS')) add(5, 'Visualizou imóveis enviados');
    if (['stg_5', 'stg_6'].some(s => stageIds.has(s)) || types.has('VISITA')) add(25, 'Solicitou/realizou visita');
    if (['stg_7', 'stg_8', 'stg_9', 'stg_10'].some(s => stageIds.has(s)) || types.has('PROPOSTA')) add(30, 'Fez proposta');

    // Base mínima por temperatura para leads recém-cadastrados sem histórico
    if (breakdown.length === 0) {
      if (client.temperature === 'MUITO_QUENTE') add(40, 'Temperatura muito quente');
      else if (client.temperature === 'QUENTE') add(30, 'Temperatura quente');
      else if (client.temperature === 'MORNO') add(15, 'Temperatura morna');
    }

    return Math.min(100, score);
  },

  scoreLeadDetailed(client) {
    let score = 0;
    const breakdown = [];
    const add = (points, label, done) => { if (done) score += points; breakdown.push({ points, label, done }); };

    const interactions = db.get('interactions').filter(i => i.clientId === client.id);
    const channels = new Set(interactions.map(i => i.channel));
    const types = new Set(interactions.map(i => i.type));
    const opps = db.get('opportunities').filter(o => o.clientId === client.id);
    const stageIds = new Set(opps.map(o => o.stageId));
    const respondedWhats = channels.has('WHATSAPP') || db.get('messages').some(m => m.clientId === client.id && m.sender === 'CLIENT');

    add(10, 'Respondeu WhatsApp', respondedWhats);
    add(10, 'Informou renda', client.familyIncome > 0 || client.needsFinancing !== undefined);
    add(15, 'Informou entrada', client.downPayment > 0);
    add(15, 'Pediu financiamento', client.needsFinancing === true);
    add(5, 'Visualizou imóveis', stageIds.has('stg_4') || types.has('IMOVEIS_ENVIADOS'));
    add(25, 'Pediu visita', ['stg_5', 'stg_6'].some(s => stageIds.has(s)) || types.has('VISITA'));
    add(30, 'Fez proposta', ['stg_7', 'stg_8', 'stg_9', 'stg_10'].some(s => stageIds.has(s)) || types.has('PROPOSTA'));

    return { score: Math.min(100, score), breakdown };
  },

  getTopLeads(limit = 10) {
    return db.get('clients')
      .filter(c => c.type !== 'PROPRIETARIO')
      .map(c => ({ client: c, score: this.scoreLead(c) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  suggestOwnerOutreach(capture) {
    const first = (capture.ownerName || 'Proprietário').split(' ')[0];
    const tipo = (capture.propertyType || 'imóvel').toLowerCase();
    const regiao = capture.region || 'sua região';
    return `Olá, ${first}! Tudo bem? Vi seu anúncio do ${tipo} em ${regiao} no ${capture.portalSource || 'portal'}. Sou da Coutinho Imóveis e tenho clientes ativos buscando exatamente esse perfil na região. Posso preparar uma avaliação mercadológica gratuita e sem compromisso para posicionar seu imóvel no melhor preço de venda. Podemos conversar hoje?`;
  },

  scoreCapture(capture) {
    let score = 40;
    if (capture.adLink) score += 15;
    if (capture.phone) score += 20;
    if (capture.desiredValue > 0) score += 10;
    if (['DFimóveis', 'Wimoveis'].includes(capture.portalSource)) score += 10;
    if (capture.area > 0) score += 5;
    return Math.min(100, score);
  },

  slugify(text) {
    return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70);
  },

  generateBlogArticle({ keyword, region, propertyType }) {
    const kw = (keyword || 'imóveis à venda no DF').trim();
    const reg = region || 'Distrito Federal';
    const tipo = propertyType || 'imóveis';
    const title = `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} em ${reg}: guia completo de ${new Date().getFullYear()} para comprar bem`;

    const secondary = [
      `${kw} preço`, `${tipo} ${reg} financiamento`, `melhores quadras ${reg}`, `${kw} 2026`
    ];

    const faq = [
      { q: `Quanto custa um ${tipo.replace(/s$/, '')} em ${reg}?`, a: `O valor varia conforme quadra, metragem e padrão. Uma avaliação mercadológica gratuita da Coutinho Imóveis indica a faixa real de preço para ${reg}.` },
      { q: `Vale a pena investir em ${reg}?`, a: `${reg} combina valorização consistente, infraestrutura consolidada e boa liquidez, o que favorece tanto moradia quanto investimento.` },
      { q: `Posso usar FGTS e financiamento para comprar em ${reg}?`, a: `Sim, na maioria dos casos. Use nosso Simulador de Financiamento para estimar seu poder de compra e a parcela ideal.` }
    ];

    const content = [
      `# ${title}`,
      ``,
      `Procurando ${kw}? Este guia reúne o que realmente importa para quem quer comprar em ${reg} sem pagar caro nem perder a melhor oportunidade.`,
      ``,
      `## Por que ${reg} é uma das regiões mais procuradas do DF`,
      `${reg} se destaca pela infraestrutura, mobilidade e qualidade de vida. A demanda constante por ${tipo} sustenta a valorização e garante boa liquidez na hora de revender.`,
      ``,
      `## Quanto custa comprar ${tipo} em ${reg}`,
      `O preço do metro quadrado depende da quadra, do andar, do estado de conservação e dos diferenciais. Antes de fechar negócio, solicite uma avaliação mercadológica para comparar com imóveis semelhantes anunciados na região.`,
      ``,
      `## Como financiar seu imóvel`,
      `Com renda comprovada, entrada e FGTS, é possível financiar boa parte do valor. Simule seu poder de compra e descubra a parcela que cabe no seu orçamento antes de visitar.`,
      ``,
      `## Perguntas frequentes`,
      ...faq.flatMap(f => [`**${f.q}**`, f.a, ``]),
      `## Fale com a Coutinho Imóveis`,
      `Nossa equipe conhece ${reg} em detalhes e acompanha você da simulação à assinatura do contrato. Solicite uma seleção de ${tipo} compatíveis com seu perfil.`
    ].join('\n');

    return {
      title,
      slug: this.slugify(`${tipo}-${reg}-guia`),
      category: 'Guia de Bairros',
      mainKeyword: kw,
      secondaryKeywords: secondary,
      seoTitle: `${title.slice(0, 55)} | Coutinho Imóveis`,
      metaDescription: `Guia completo de ${kw} em ${reg}: preços, financiamento, melhores quadras e dicas para comprar com segurança. Fale com a Coutinho Imóveis.`.slice(0, 158),
      content,
      faq,
      schema: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
      }
    };
  },

  // Descoberta de temas virais do mercado imobiliário, com fonte de referência.
  // Curadoria baseada em pautas recorrentes dos grandes portais/veículos do setor.
  discoverViralTopics() {
    const year = new Date().getFullYear();
    return [
      {
        title: `Taxa Selic e financiamento imobiliário: o que muda para quem vai comprar em ${year}`,
        angle: 'Notícia econômica ligada à decisão de compra — alto volume de busca sempre que a Selic é anunciada.',
        format: 'Artigo explicativo + carrossel resumo',
        potential: 'Muito alto',
        source: 'Banco Central do Brasil (bcb.gov.br) e portais de economia (InfoMoney, Valor)',
        keywords: ['selic financiamento imóvel', 'juros financiamento casa 2026']
      },
      {
        title: `Minha Casa Minha Vida ${year}: novas faixas de renda e teto de imóvel`,
        angle: 'Programa habitacional é uma das buscas mais constantes; captura leads de primeira compra.',
        format: 'Guia + FAQ + CTA de simulação',
        potential: 'Muito alto',
        source: 'Ministério das Cidades e Caixa Econômica Federal (caixa.gov.br)',
        keywords: ['minha casa minha vida 2026', 'faixa de renda MCMV']
      },
      {
        title: 'Comprar ou alugar em 2026? A conta que todo mundo faz errado',
        angle: 'Pauta polarizadora e altamente compartilhável — funciona bem em Reels e carrossel.',
        format: 'Reels + carrossel comparativo',
        potential: 'Alto',
        source: 'FipeZAP (fipezap.com.br) para índices de aluguel e venda',
        keywords: ['comprar ou alugar', 'vale a pena financiar imóvel']
      },
      {
        title: 'Os bairros do DF que mais valorizaram no último ano',
        angle: 'Ranking local com dado concreto — gera autoridade e é replicável a cada trimestre.',
        format: 'Artigo com tabela + carrossel de ranking',
        potential: 'Alto',
        source: 'FipeZAP / Secovi-DF (índices de preço regionais)',
        keywords: ['bairros que mais valorizam DF', 'valorização imóveis Brasília']
      },
      {
        title: 'Erros que fazem você perder dinheiro ao vender seu imóvel',
        angle: 'Dor clássica do proprietário — ótimo para captação de quem quer vender.',
        format: 'Reels + post educativo',
        potential: 'Alto',
        source: 'Conteúdo autoral com base em CRECI/COFECI (boas práticas)',
        keywords: ['como vender meu imóvel', 'erros ao vender imóvel']
      }
    ];
  },

  // Análise de SEO de um artigo, com nota 0-100 e recomendações acionáveis.
  analyzeSEO(post) {
    const checks = [];
    const title = post.title || '';
    const meta = post.metaDescription || '';
    const kw = (post.mainKeyword || '').toLowerCase();
    const content = post.content || '';
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    const add = (ok, points, label, tip) => checks.push({ ok, points, label, tip });

    add(title.length >= 40 && title.length <= 65, 15, `Título com ${title.length} caracteres (ideal 40-65)`, 'Ajuste o título para caber na SERP sem cortar.');
    add(kw && title.toLowerCase().includes(kw), 15, 'Palavra-chave no título', 'Inclua a palavra-chave principal no título.');
    add(meta.length >= 120 && meta.length <= 158, 12, `Meta description com ${meta.length} caracteres (ideal 120-158)`, 'Reescreva a meta para 120-158 caracteres com CTA.');
    add(kw && meta.toLowerCase().includes(kw), 10, 'Palavra-chave na meta description', 'Inclua a palavra-chave na meta description.');
    add(wordCount >= 600, 15, `Conteúdo com ${wordCount} palavras (ideal 600+)`, 'Amplie o conteúdo para 600+ palavras com subtópicos.');
    add((content.match(/^##\s/gm) || []).length >= 3, 10, 'Uso de subtítulos (H2)', 'Use ao menos 3 subtítulos H2 para escaneabilidade.');
    add(Array.isArray(post.faq) && post.faq.length >= 3, 8, 'Bloco de FAQ (rich snippet)', 'Adicione 3+ perguntas frequentes para ganhar rich snippets.');
    add(!!post.schema, 5, 'Schema markup (dados estruturados)', 'Gere schema FAQPage/Article.');
    add(kw && (content.toLowerCase().split(kw).length - 1) >= 3, 5, 'Densidade da palavra-chave no texto', 'Cite a palavra-chave naturalmente ao longo do texto.');
    add(/\[.*\]\(.*\)|https?:\/\//.test(content) || /simulador|avalia/i.test(content), 5, 'Link/CTA interno', 'Inclua links internos (simulador, avaliação, imóveis).');

    const score = checks.reduce((acc, c) => acc + (c.ok ? c.points : 0), 0);
    let grade = 'Fraco';
    if (score >= 85) grade = 'Excelente';
    else if (score >= 65) grade = 'Bom';
    else if (score >= 45) grade = 'Regular';

    return { score, grade, wordCount, checks, recommendations: checks.filter(c => !c.ok).map(c => c.tip) };
  },

  // Cria conteúdo para Instagram (Reels/Carrossel/Post) com guardrails de políticas.
  generateInstagramPost({ topic, format, region }) {
    const t = (topic || 'mercado imobiliário no DF').trim();
    const fmt = format || 'CARROSSEL';
    const reg = region || 'Brasília';

    const hooks = {
      REELS: [`Ninguém te conta isso sobre ${t}...`, `Pare de rolar se você quer ${t}`, `O erro nº 1 em ${t}`],
      CARROSSEL: [`${t}: o guia que você precisa`, `5 coisas sobre ${t}`, `Antes de decidir sobre ${t}, veja isto`],
      POST: [`${t} em ${reg}`, `A verdade sobre ${t}`]
    }[fmt] || [`${t}`];

    const hook = hooks[Math.floor(Math.random() * hooks.length)];

    const slides = fmt === 'CARROSSEL' ? [
      { n: 1, text: hook, note: 'Capa — texto grande, alto contraste' },
      { n: 2, text: `Por que isso importa para quem mora ou investe em ${reg}.`, note: 'Contexto' },
      { n: 3, text: 'O ponto que a maioria ignora e custa caro.', note: 'Dor/erro comum' },
      { n: 4, text: 'Como fazer do jeito certo, passo a passo.', note: 'Solução' },
      { n: 5, text: 'Salve este post e chame a Coutinho Imóveis para uma consultoria gratuita.', note: 'CTA' }
    ] : null;

    const caption = [
      hook,
      ``,
      `Se você pensa em ${t} em ${reg}, esse conteúdo é pra você. Deslize e salve para não esquecer.`,
      ``,
      `Quer ajuda personalizada? Chama a Coutinho Imóveis no direct. 🏡`,
      ``,
      `#imoveis #${this.slugify(reg).replace(/-/g, '')} #mercadoimobiliario #brasilia #imovel #corretordeimoveis #${this.slugify(t).replace(/-/g, '').slice(0, 20)}`
    ].join('\n');

    return {
      format: fmt,
      hook,
      slides,
      caption,
      hashtags: ['#imoveis', '#brasilia', '#mercadoimobiliario', '#corretordeimoveis', '#imovel'],
      bestTime: 'Terça a quinta, 12h ou 19h-21h (maior engajamento local)',
      policy: [
        'Não use hashtags banidas ou repetidas em excesso (limite ~10-15 relevantes).',
        'Evite marcação em massa e comentários automatizados idênticos (risco de bloqueio).',
        'Publique via API oficial (Instagram Graph API) com conta Business conectada.',
        'Respeite direitos de imagem: use fotos próprias ou com licença.',
        'Não prometa rentabilidade garantida nem faça afirmações enganosas.'
      ]
    };
  },

  // Geração de anúncio de imóvel com IA: título e descrições prontas para portais e redes.
  generateListingAd(property) {
    const p = property || {};
    const tipo = (p.type || 'IMÓVEL').toString().toLowerCase().replace('_', ' ');
    const regiao = p.region || 'Brasília';
    const quartos = p.bedrooms ? `${p.bedrooms} quarto${p.bedrooms > 1 ? 's' : ''}` : '';
    const suites = p.suites ? `${p.suites} suíte${p.suites > 1 ? 's' : ''}` : '';
    const vagas = p.parkingSpots ? `${p.parkingSpots} vaga${p.parkingSpots > 1 ? 's' : ''}` : '';
    const area = p.area ? `${p.area}m²` : '';
    const preco = p.salePrice || p.price || p.rentPrice || 0;
    const precoFmt = preco ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(preco) : 'Consulte';
    const carac = Array.isArray(p.features) ? p.features : (Array.isArray(p.differentials) ? p.differentials : []);

    const specParts = [quartos, suites, vagas, area].filter(Boolean).join(' · ');

    // Título curto e forte (limite de portais ~100 caracteres)
    const titles = [
      `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} ${quartos ? 'de ' + quartos + ' ' : ''}em ${regiao}${area ? ' — ' + area : ''}`,
      `${regiao}: ${tipo} pronto para morar${suites ? ' com ' + suites : ''}`,
      `Oportunidade em ${regiao} — ${tipo} ${specParts}`
    ].map(t => t.slice(0, 100));

    // Descrição para portais (DFimóveis, ZAP, Viva Real)
    const portalDescription = [
      `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} à venda em ${regiao}${specParts ? ', ' + specParts : ''}.`,
      p.description ? p.description : `Imóvel bem localizado, com fácil acesso a comércio, transporte e serviços da região.`,
      carac.length ? `Diferenciais: ${carac.slice(0, 8).join(', ')}.` : '',
      `Valor: ${precoFmt}. Agende sua visita e conheça pessoalmente.`,
      `Atendimento Coutinho Imóveis — CRECI-DF. Fotos meramente ilustrativas; valores e condições sujeitos a alteração sem aviso prévio.`
    ].filter(Boolean).join('\n\n');

    // Texto curto para WhatsApp
    const whatsappText = `🏡 *${tipo.charAt(0).toUpperCase() + tipo.slice(1)} em ${regiao}*\n${specParts}\n💰 ${precoFmt}\n${carac.length ? '✨ ' + carac.slice(0, 4).join(' · ') + '\n' : ''}Quer agendar uma visita? Me chama aqui!`;

    // Legenda para Instagram/Facebook
    const socialCaption = [
      `✨ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} em ${regiao}`,
      specParts ? `📐 ${specParts}` : '',
      `💰 ${precoFmt}`,
      carac.length ? `🔑 ${carac.slice(0, 5).join(' · ')}` : '',
      ``,
      `Agende sua visita pelo direct! 📲`,
      ``,
      `#imoveis #${this.slugify(regiao).replace(/-/g, '')} #${this.slugify(tipo).replace(/-/g, '')} #brasilia #imovelavenda #corretordeimoveis`
    ].filter(Boolean).join('\n');

    return { titles, portalDescription, whatsappText, socialCaption, price: precoFmt };
  }
};
