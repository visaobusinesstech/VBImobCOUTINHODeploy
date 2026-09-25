const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type PortalConfig = {
  nome: string;
  searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) => string;
  fallbackQuery?: (cidade: string, tipo: string, operacao: string, estado: string) => string;
  fallbackFirst?: boolean;
  domainFilter?: string[];
};

const PORTAIS: Record<string, PortalConfig> = {
  zapimoveis: {
    nome: 'ZAP Imóveis',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.zapimoveis.com.br/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${tipo.toLowerCase()}/${estado.toLowerCase()}+${cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '-')}/`,
  },
  olx: {
    nome: 'OLX',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.olx.com.br/imoveis/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${tipo.toLowerCase()}/estado-${estado.toLowerCase()}/${cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '-')}/`,
  },
  vivareal: {
    nome: 'VivaReal',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.vivareal.com.br/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${cidade.toLowerCase().replace(/\s/g, '-')}-${estado.toLowerCase()}/${tipo.toLowerCase()}/`,
  },
  imovelweb: {
    nome: 'Imovelweb',
    searchUrl: (cidade: string, tipo: string, operacao: string, _estado: string) =>
      `https://www.imovelweb.com.br/${tipo.toLowerCase()}-${operacao === 'Venda' ? 'venda' : 'aluguel'}-${cidade.toLowerCase().replace(/\s/g, '-')}.html`,
  },
  wimoveis: {
    nome: 'WImóveis',
    searchUrl: (cidade: string, tipo: string, operacao: string, _estado: string) =>
      `https://www.wimoveis.com.br/${tipo.toLowerCase()}-${operacao === 'Venda' ? 'venda' : 'aluguel'}-${cidade.toLowerCase().replace(/\s/g, '-')}.html`,
  },
  chavenaomao: {
    nome: 'Chave na Mão',
    searchUrl: (cidade: string, tipo: string, operacao: string, _estado: string) =>
      `https://www.chavenamo.com.br/${tipo.toLowerCase()}/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${cidade.toLowerCase().replace(/\s/g, '-')}/`,
  },
  defimoveis: {
    nome: 'DFImóveis',
    searchUrl: (_cidade: string, tipo: string, operacao: string, _estado: string) =>
      `https://www.dfimoveis.com.br/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${tipo.toLowerCase()}/`,
  },
  quintoandar: {
    nome: 'QuintoAndar',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.quintoandar.com.br/${operacao === 'Venda' ? 'comprar' : 'alugar'}/${tipo.toLowerCase()}/${cidade.toLowerCase().replace(/\s/g, '-')}-${estado.toLowerCase()}`,
  },
  netimoveis: {
    nome: 'NetImóveis',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.netimoveis.com/${operacao === 'Venda' ? 'venda' : 'locacao'}/${estado.toLowerCase()}/${cidade.toLowerCase().replace(/\s/g, '-')}/${tipo.toLowerCase()}`,
  },
  mercadolivre: {
    nome: 'Mercado Livre',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://imoveis.mercadolivre.com.br/${tipo.toLowerCase()}/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${cidade.toLowerCase().replace(/\s/g, '-')}-${estado.toLowerCase()}/`,
  },
  trovit: {
    nome: 'Trovit Imóveis',
    searchUrl: (cidade: string, tipo: string, operacao: string, _estado: string) =>
      `https://imoveis.trovit.com.br/${operacao === 'Venda' ? 'venda' : 'aluguel'}-${tipo.toLowerCase()}-${cidade.toLowerCase().replace(/\s/g, '-')}`,
  },
  i123: {
    nome: '123i',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.123i.com.br/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${tipo.toLowerCase()}/${estado.toLowerCase()}/${cidade.toLowerCase().replace(/\s/g, '-')}`,
  },
  alude: {
    // Alude é B2B (sem catálogo público). Redirecionamos para OLX com filtro "particular"
    // que retorna anúncios diretos de proprietários — alinhado ao propósito da Alude.
    nome: 'Alude (via OLX Particular)',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.olx.com.br/imoveis/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${tipo.toLowerCase()}/estado-${estado.toLowerCase()}/${cidade.toLowerCase().replace(/\s/g, '-')}?sf=1`,
    fallbackQuery: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `site:olx.com.br ${tipo} ${operacao === 'Venda' ? 'venda' : 'aluguel'} particular proprietário ${cidade} ${estado}`,
    domainFilter: ['olx.com.br'],
  },
  imovel_proprietario: {
    nome: 'Imóvel do Proprietário (Direto com Dono)',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.olx.com.br/imoveis/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${tipo.toLowerCase()}/estado-${estado.toLowerCase()}/${cidade.toLowerCase().replace(/\s/g, '-')}?sf=1`,
    fallbackQuery: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `site:olx.com.br ${tipo} ${operacao === 'Venda' ? 'venda' : 'aluguel'} particular proprietário ${cidade} ${estado}`,
    domainFilter: ['olx.com.br'],
  },
  proprietario_direto: {
    // Captação genérica de proprietário direto
    nome: 'Proprietário Direto',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.olx.com.br/imoveis/${operacao === 'Venda' ? 'venda' : 'aluguel'}/${tipo.toLowerCase()}/estado-${estado.toLowerCase()}/${cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '-')}?sf=1`,
    fallbackQuery: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `site:olx.com.br ${tipo} ${operacao === 'Venda' ? 'venda' : 'aluguel'} particular proprietário ${cidade} ${estado} -imobiliária`,
    domainFilter: ['olx.com.br'],
  },
  captei: {
    // Captei (captei.com.br) — captação de imóveis com proprietários
    nome: 'Captei (Captação)',
    searchUrl: (cidade: string, _tipo: string, _operacao: string, estado: string) =>
      `https://captei.com.br/imoveis?cidade=${encodeURIComponent(cidade)}&estado=${estado.toLowerCase()}`,
    fallbackQuery: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `site:captei.com.br ${tipo} ${operacao === 'Venda' ? 'venda' : 'aluguel'} ${cidade} ${estado}`,
  },
  alugamais: {
    // Aluga Mais — locação direta com proprietários
    nome: 'Aluga Mais (Locação Direta)',
    searchUrl: (cidade: string, tipo: string, _operacao: string, estado: string) =>
      `https://www.alugamais.com.br/imoveis/${tipo.toLowerCase()}/${cidade.toLowerCase().replace(/\s/g, '-')}-${estado.toLowerCase()}`,
    fallbackQuery: (cidade: string, tipo: string, _operacao: string, estado: string) =>
      `site:alugamais.com.br ${tipo} aluguel ${cidade} ${estado} proprietário`,
  },
  imovelp: {
    // imovelp.com.br — Imóvel do Proprietário
    nome: 'Imóvelp.com.br (Direto Proprietário)',
    searchUrl: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `https://www.imovelp.com.br/busca?cidade=${encodeURIComponent(cidade)}&uf=${estado.toLowerCase()}&tipo=${tipo.toLowerCase()}&finalidade=${operacao === 'Venda' ? 'venda' : 'locacao'}`,
    fallbackQuery: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `site:imovelp.com.br ${tipo} ${operacao === 'Venda' ? 'venda' : 'aluguel'} ${cidade} ${estado}`,
  },
  imovelweb_proprietario: {
    // Imovelweb — Aba "Particular" (anúncios diretos)
    nome: 'Imovelweb (Aba Proprietário)',
    searchUrl: (cidade: string, tipo: string, operacao: string, _estado: string) =>
      `https://www.imovelweb.com.br/${tipo.toLowerCase()}-${operacao === 'Venda' ? 'venda' : 'aluguel'}-${cidade.toLowerCase().replace(/\s/g, '-')}-publicado-por-particular.html`,
    fallbackQuery: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `site:imovelweb.com.br particular ${tipo} ${operacao === 'Venda' ? 'venda' : 'aluguel'} ${cidade} ${estado}`,
    domainFilter: ['imovelweb.com.br'],
  },
  wimoveis_proprietario: {
    // WImóveis (DF) — Aba "Particular"
    nome: 'WImóveis (Aba Proprietário - DF)',
    searchUrl: (cidade: string, tipo: string, operacao: string, _estado: string) =>
      `https://www.wimoveis.com.br/${tipo.toLowerCase()}-${operacao === 'Venda' ? 'venda' : 'aluguel'}-${cidade.toLowerCase().replace(/\s/g, '-')}-publicado-por-particular.html`,
    fallbackQuery: (cidade: string, tipo: string, operacao: string, estado: string) =>
      `site:wimoveis.com.br particular ${tipo} ${operacao === 'Venda' ? 'venda' : 'aluguel'} ${cidade} ${estado}`,
    domainFilter: ['wimoveis.com.br'],
  },
};

const BAIRROS_BRASILIA = [
  'Asa Sul', 'Asa Norte', 'Lago Sul', 'Lago Norte', 'Sudoeste', 'Noroeste', 'Octogonal',
  'Cruzeiro', 'Cruzeiro Velho', 'Cruzeiro Novo',
  'Guará', 'Guará I', 'Guará II',
  'Taguatinga', 'Taguatinga Norte', 'Taguatinga Sul', 'Taguatinga Centro',
  'Ceilândia', 'Ceilândia Norte', 'Ceilândia Sul', 'Ceilândia Centro',
  'Samambaia', 'Samambaia Norte', 'Samambaia Sul',
  'Águas Claras', 'Vicente Pires', 'Park Way', 'Jardim Botânico',
  'Sobradinho', 'Sobradinho I', 'Sobradinho II',
  'Planaltina', 'Gama', 'Gama Leste', 'Gama Oeste',
  'Santa Maria', 'Recanto das Emas', 'Riacho Fundo', 'Riacho Fundo I', 'Riacho Fundo II',
  'Núcleo Bandeirante', 'Candangolândia', 'Park Sul',
  'São Sebastião', 'Brazlândia', 'Estrutural', 'SCIA', 'SIA', 'SAAN',
  'Itapoã', 'Paranoá', 'Fercal', 'Varjão', 'Sol Nascente', 'Pôr do Sol',
  'Arniqueira', 'Areal',
  'Setor Hoteleiro', 'Setor Bancário', 'Setor Comercial', 'Setor Hospitalar',
  'Setor de Autarquias', 'Setor de Clubes', 'Setor de Diversões', 'Setor de Embaixadas',
  'Setor de Habitações', 'Setor de Indústrias', 'Setor de Mansões', 'Setor de Oficinas',
  'Setor Militar', 'Setor Policial', 'Setor Sudoeste', 'Setor Noroeste',
  'Setor O', 'Setor P', 'Setor M',
  'Jardim Mangueiral', 'Jardins Mangueiral', 'Jardim Botânico', 'Jardim Santa Inês',
  'Ponte Alta', 'Colorado', 'Grande Colorado', 'Contagem',
  'Residencial Oeste', 'Tororó', 'Mansões Sobradinho',
  'Lago Azul', 'Alto da Boa Vista', 'Altiplano Leste',
  'Vila Planalto', 'Vila Telebrasília',
  'Valparaíso', 'Valparaíso de Goiás', 'Novo Gama', 'Cidade Ocidental',
  'Luziânia', 'Águas Lindas', 'Águas Lindas de Goiás', 'Santo Antônio do Descoberto',
  'Formosa', 'Planaltina de Goiás', 'Alexânia', 'Padre Bernardo',
  'Jardim Ingá', 'Jardim ABC', 'Jardim Céu Azul',
  'Pedregal', 'Cidade Jardins', 'Parque Estrela Dalva',
];

function isImageUrl(u: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)(\?.*)?$/i.test(u) ||
    u.includes('/thumbs') || u.includes('img.olx') || u.includes('/images/') ||
    u.includes('cdn.olx') || u.includes('imgzap');
}

function extractBairro(text: string, cidade: string): string | null {
  const sorted = [...BAIRROS_BRASILIA].sort((a, b) => b.length - a.length);
  for (const bairro of sorted) {
    const escaped = bairro.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
      return bairro;
    }
  }

  const setorMatch = text.match(/\b(Setor\s+[A-ZÀ-ÚÇ][a-zà-úç]+(?:\s+[A-ZÀ-ÚÇ][a-zà-úç]+)*)\b/i);
  if (setorMatch) return setorMatch[1].trim();

  const patterns = [
    /(?:bairro|localiza[çc][ãa]o|regi[ãa]o)\s*[:|-]?\s*([A-ZÀ-ÚÇ][a-zà-úç]+(?:\s+(?:de|da|do|dos|das|e|Norte|Sul|Leste|Oeste|I{1,3}|IV|V)?\s*[A-ZÀ-ÚÇ][a-zà-úç]*)*)/i,
    new RegExp(`(?:em|no|na|,)\\s+([A-ZÀ-ÚÇ][a-zà-úç]+(?:\\s+(?:de|da|do|dos|das)\\s+)?[A-ZÀ-ÚÇ]?[a-zà-úç]*)\\s*[,|-]\\s*(?:Brasília|Brasilia|DF)`, 'i'),
    /([A-ZÀ-ÚÇ][a-zà-úç]+(?:\s+[A-ZÀ-ÚÇ][a-zà-úç]+)*)\s*[,|-]\s*(?:Brasília|Brasilia|DF)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let bairro = match[1].trim();
      bairro = bairro.replace(/^(?:no|na|em|do|da|dos|das|de)\s+/i, '');
      const falsoPositivo = ['Imóvel', 'Imóveis', 'Apartamento', 'Casa', 'Venda', 'Aluguel', 'Preço', 'Quartos', 'Comprar', 'Alugar', 'Anúncio', 'Anúncios', 'Resultado', 'Resultados', 'Filtro', 'Filtros', 'Buscar', 'Pesquisar', 'Dormitório', 'Dormitórios', 'Banheiro', 'Banheiros', 'Suite', 'Suíte', 'Garagem', 'Condomínio', 'Área', 'Tipo', 'Mais', 'Ver', 'Todos', 'Todas', 'Novo', 'Nova', 'Página', 'Mapa', 'Foto', 'Fotos', 'Detalhes', 'Características', 'Descrição', 'Sobre', 'Contato'];
      if (bairro.length >= 3 && bairro.length <= 60 && !falsoPositivo.some(fp => fp.toLowerCase() === bairro.toLowerCase())) {
        return bairro;
      }
    }
  }
  return null;
}

function extractUrls(markdown: string, _baseUrl: string): string[] {
  const urls: string[] = [];
  const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let m;
  while ((m = linkRegex.exec(markdown)) !== null) {
    const u = m[2];
    if (!isImageUrl(u)) {
      if (u.includes('/imovel/') || u.includes('/detalhe') || u.includes('/id-') ||
          u.match(/\/\d{5,}/) || u.includes('/ficha/') || u.includes('/anuncio/') ||
          u.includes('/item/') || u.includes('/ad/') || u.includes('/property/') ||
          u.includes('/listing/')) {
        urls.push(u);
      }
    }
  }

  const portalDomains = 'zapimoveis|olx|vivareal|imovelweb|wimoveis|chavenamo|dfimoveis|quintoandar|netimoveis|mercadolivre|trovit|123i|alude';
  const plainUrlRegex = new RegExp(`(?:^|\\s)(https?:\\/\\/(?:www\\.)?(?:${portalDomains})\\.[^\\s)]+)`, 'gm');
  while ((m = plainUrlRegex.exec(markdown)) !== null) {
    const u = m[1].trim();
    if (!isImageUrl(u)) {
      urls.push(u);
    }
  }
  return [...new Set(urls)];
}

function extractTitle(section: string, portal: string, bairro: string | null, area: number, quartos: number): string {
  const lines = section.trim().split('\n');
  for (const line of lines) {
    const clean = line.replace(/[#*\[\]()]/g, '').replace(/https?:\/\/\S+/g, '').trim();
    if (clean.length > 15 && clean.length < 150 &&
        !clean.match(/^R?\$/) && !clean.match(/^\d+[\s.,]*\d*$/) &&
        !clean.match(/^(img|http|www\.|cdn)/i) && !isImageUrl(clean)) {
      return clean.substring(0, 120);
    }
  }
  const parts = [portal];
  if (bairro) parts.push(bairro);
  if (quartos > 0) parts.push(`${quartos} quartos`);
  if (area > 0) parts.push(`${area}m²`);
  return parts.join(' - ');
}

function extractImagesFromHtml(html: string): string[] {
  const images: string[] = [];
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgTagRegex.exec(html)) !== null) {
    const u = m[1];
    if (/\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(u) &&
        !u.includes('favicon') && !u.includes('logo') && !u.includes('icon') &&
        !u.includes('placeholder') && !u.includes('avatar') &&
        (u.includes('thumb') || u.includes('img') || u.includes('photo') || u.includes('cdn') || u.match(/\/\d+\./))) {
      images.push(u);
    }
  }
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRegex.exec(html)) !== null) {
    const urls = m[1].split(',').map(s => s.trim().split(/\s+/)[0]);
    for (const u of urls) {
      if (/\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(u) && !u.includes('favicon') && !u.includes('logo')) {
        images.push(u);
      }
    }
  }
  return images;
}

function extractImages(section: string, allHtmlImages: string[]): string[] {
  const images: string[] = [];
  const imgRegex = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
  let m;
  while ((m = imgRegex.exec(section)) !== null) {
    const u = m[1];
    if (/\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(u) && !u.includes('favicon') && !u.includes('logo') && !u.includes('icon')) {
      images.push(u);
    }
  }
  const plainImgRegex = /(https?:\/\/[^\s)"]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s)"]*)?)/gi;
  while ((m = plainImgRegex.exec(section)) !== null) {
    const u = m[1];
    if (!u.includes('favicon') && !u.includes('logo') && !u.includes('icon') && !images.includes(u)) {
      images.push(u);
    }
  }
  if (images.length === 0 && allHtmlImages.length > 0) {
    for (const img of allHtmlImages) {
      if (images.length >= 3) break;
      if (img.includes('thumbs') || img.includes('thumb') || img.includes('700x500') || img.includes('600x') || img.includes('400x')) {
        images.push(img);
      }
    }
  }
  return [...new Set(images)].slice(0, 6);
}

function extractContact(text: string): { telefone: string; email: string } {
  // Brazilian phone: (61) 99999-9999, +55 61 99999-9999, 61999999999
  const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let telefone = '';
  let email = '';
  const phoneMatches = text.match(phoneRegex);
  if (phoneMatches) {
    for (const p of phoneMatches) {
      const digits = p.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 13) {
        telefone = p.trim();
        break;
      }
    }
  }
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    const filtered = emailMatch.find(e => !/(noreply|no-reply|contato@|suporte@|atendimento@|info@).*?(zap|olx|viva|imovelweb|wimoveis|quintoandar|firecrawl|google|facebook)/i.test(e));
    email = filtered || emailMatch[0];
  }
  return { telefone, email };
}

function extractListings(markdown: string, portal: string, url: string, cidade: string, html?: string): any[] {
  const listings: any[] = [];
  const allHtmlImages = html ? extractImagesFromHtml(html) : [];

  const detailUrls = extractUrls(markdown, url);
  let urlIndex = 0;

  const priceRegex = /R\$\s*([\d.,]+)/g;
  const areaRegex = /(\d+)\s*m²/g;
  const quartoRegex = /(\d+)\s*(?:quarto|dorm|suite)/gi;
  const banheiroRegex = /(\d+)\s*(?:banheiro|wc|sanitário)/gi;
  const vagaRegex = /(\d+)\s*(?:vaga|garagem)/gi;

  const sections = markdown.split(/(?:---|___|\n#{1,3}\s|\n\*\*\*)/);

  for (const section of sections) {
    if (section.trim().length < 30) continue;

    const prices: number[] = [];
    let match;
    const priceR = new RegExp(priceRegex.source, 'g');
    while ((match = priceR.exec(section)) !== null) {
      const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      if (val > 1000) prices.push(val);
    }

    const areaR = new RegExp(areaRegex.source, 'g');
    const areas: number[] = [];
    while ((match = areaR.exec(section)) !== null) {
      areas.push(parseInt(match[1]));
    }

    const quartoR = new RegExp(quartoRegex.source, 'gi');
    const quartos: number[] = [];
    while ((match = quartoR.exec(section)) !== null) {
      quartos.push(parseInt(match[1]));
    }

    const banheiroR = new RegExp(banheiroRegex.source, 'gi');
    const banheiros: number[] = [];
    while ((match = banheiroR.exec(section)) !== null) {
      banheiros.push(parseInt(match[1]));
    }

    const vagaR = new RegExp(vagaRegex.source, 'gi');
    const vagas: number[] = [];
    while ((match = vagaR.exec(section)) !== null) {
      vagas.push(parseInt(match[1]));
    }

    if (prices.length > 0) {
      const preco = prices[0];
      const area = areas.length > 0 ? areas[0] : 0;
      const qts = quartos.length > 0 ? quartos[0] : 0;
      const bairro = extractBairro(section, cidade);
      const titulo = extractTitle(section, portal, bairro, area, qts);
      const fotos = extractImages(section, allHtmlImages);

      const sectionUrls = extractUrls(section, url);
      let listingUrl = sectionUrls.length > 0 ? sectionUrls[0] : (urlIndex < detailUrls.length ? detailUrls[urlIndex++] : url);

      if (isImageUrl(listingUrl)) {
        listingUrl = url;
      }

      const { telefone, email } = extractContact(section);

      listings.push({
        portal,
        url_anuncio: listingUrl,
        titulo,
        preco,
        area,
        quartos: qts,
        banheiros: banheiros.length > 0 ? banheiros[0] : 0,
        vagas: vagas.length > 0 ? vagas[0] : 0,
        preco_m2: area > 0 ? Math.round(preco / area) : 0,
        bairro,
        fotos,
        telefone,
        email,
      });
    }
  }

  return listings;
}

function normalizeSearchResponse(data: any): any[] {
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.web)) return data.web;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.results?.web)) return data.results.web;
  return [];
}

function createListingFromSearchResult(item: any, portal: string, cidade: string): any | null {
  const title = item?.title || item?.metadata?.title || 'Anúncio';
  const url = item?.url || item?.metadata?.sourceURL || item?.metadata?.url || '';
  const description = item?.description || item?.snippet || item?.summary || '';
  const markdown = item?.markdown || item?.data?.markdown || '';
  const html = item?.html || item?.data?.html || '';
  const combinedText = [title, description, markdown].filter(Boolean).join('\n');

  const extracted = extractListings(combinedText, portal, url, cidade, html);
  if (extracted.length > 0) return extracted[0];

  const priceMatch = combinedText.match(/R\$\s*([\d.,]+)/i);
  const areaMatch = combinedText.match(/(\d+)\s*m²/i);
  const quartosMatch = combinedText.match(/(\d+)\s*(?:quarto|dorm|suite)/i);
  const banheirosMatch = combinedText.match(/(\d+)\s*(?:banheiro|wc|sanitário)/i);
  const vagasMatch = combinedText.match(/(\d+)\s*(?:vaga|garagem)/i);
  const preco = priceMatch ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
  const area = areaMatch ? parseInt(areaMatch[1]) : 0;
  const quartos = quartosMatch ? parseInt(quartosMatch[1]) : 0;
  const banheiros = banheirosMatch ? parseInt(banheirosMatch[1]) : 0;
  const vagas = vagasMatch ? parseInt(vagasMatch[1]) : 0;
  const bairro = extractBairro(combinedText, cidade);

  if (!title && !url) return null;
  if (preco <= 0 && area <= 0 && !bairro && !description) return null;

  const { telefone, email } = extractContact(combinedText);

  return {
    portal,
    url_anuncio: url,
    titulo: title,
    preco,
    area,
    quartos,
    banheiros,
    vagas,
    preco_m2: preco > 0 && area > 0 ? Math.round(preco / area) : 0,
    bairro,
    fotos: [],
    telefone,
    email,
  };
}

async function searchListingsFallback({
  apiKey,
  query,
  portal,
  cidade,
  domainFilter,
}: {
  apiKey: string;
  query: string;
  portal: string;
  cidade: string;
  domainFilter?: string[];
}) {
  const response = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit: 8,
      scrapeOptions: {
        formats: ['markdown', 'html'],
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Falha ao consultar busca inteligente (${response.status})`);
  }

  const rawResults = normalizeSearchResponse(data);
  const filteredResults = domainFilter?.length
    ? rawResults.filter((item: any) => {
        const url = String(item?.url || item?.metadata?.sourceURL || item?.metadata?.url || '').toLowerCase();
        return domainFilter.some((domain) => url.includes(domain.toLowerCase()));
      })
    : rawResults;

  return filteredResults
    .map((item: any) => createListingFromSearchResult(item, portal, cidade))
    .filter((l: any) => l && (l.preco > 0 || l.titulo !== 'Anúncio'));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cidade, tipo, operacao, portais, estado } = await req.json();

    if (!cidade) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cidade é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl não configurado. Conecte o Firecrawl nas configurações.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tipoImovel = tipo || 'apartamento';
    const operacaoImovel = operacao || 'Venda';
    const estadoImovel = estado || 'DF';
    const portaisSelecionados: string[] = portais || ['zapimoveis', 'olx', 'vivareal'];

    const allListings: any[] = [];
    const errors: string[] = [];

    // Portais que devem retornar TODOS os anúncios (paginação ampla)
    const PORTAIS_FULL_LIST = new Set(['alude', 'imovel_proprietario']);

    for (const portalKey of portaisSelecionados) {
      const portal = PORTAIS[portalKey];
      if (!portal) continue;

      const searchUrl = portal.searchUrl(cidade, tipoImovel, operacaoImovel, estadoImovel);
      console.log(`Scraping ${portal.nome}: ${searchUrl}`);

      try {
        let listings: any[] = [];
        let scrapeErrorMessage: string | null = null;

        if (!portal.fallbackFirst) {
          // Para Alude / Imóvel do Proprietário: paginar OLX (até 10 páginas) para trazer todos os anúncios
          const pagesToFetch = PORTAIS_FULL_LIST.has(portalKey) ? 10 : 1;
          const pageUrls: string[] = [];
          for (let p = 1; p <= pagesToFetch; p++) {
            if (p === 1) pageUrls.push(searchUrl);
            else pageUrls.push(searchUrl.includes('?') ? `${searchUrl}&o=${p}` : `${searchUrl}?o=${p}`);
          }

          const pageResults = await Promise.all(pageUrls.map(async (pageUrl) => {
            try {
              const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: pageUrl,
                  formats: ['markdown', 'html'],
                  onlyMainContent: true,
                  waitFor: 3000,
                }),
              });
              const data = await response.json();
              if (response.ok && data.success) {
                const markdown = data.data?.markdown || data.markdown || '';
                const html = data.data?.html || data.html || '';
                return { listings: extractListings(markdown, portal.nome, pageUrl, cidade, html), error: null as string | null };
              }
              return { listings: [] as any[], error: (data?.error || 'falha no scraping') as string };
            } catch (err) {
              return { listings: [] as any[], error: err instanceof Error ? err.message : 'erro' };
            }
          }));

          for (const r of pageResults) {
            listings.push(...r.listings);
            if (r.error && !scrapeErrorMessage) scrapeErrorMessage = r.error;
          }
          console.log(`${portal.nome}: ${listings.length} anúncios via scrape direto (${pagesToFetch} pág.)`);
        }

        if (listings.length === 0 && portal.fallbackQuery) {
          const fallbackQuery = portal.fallbackQuery(cidade, tipoImovel, operacaoImovel, estadoImovel);
          console.log(`Fallback ${portal.nome}: ${fallbackQuery}`);
          listings = await searchListingsFallback({
            apiKey,
            query: fallbackQuery,
            portal: portal.nome,
            cidade,
            domainFilter: portal.domainFilter,
          });
          console.log(`${portal.nome}: ${listings.length} anúncios via fallback search`);
        }

        if (listings.length > 0) {
          allListings.push(...listings.map((l) => ({
            ...l,
            tipo: tipoImovel,
            operacao: operacaoImovel,
            cidade,
            bairro: l.bairro || null,
            estado: estadoImovel,
            dados_raw: { source_url: searchUrl },
          })));
        } else {
          errors.push(`${portal.nome}: ${scrapeErrorMessage || 'Nenhum anúncio encontrado'}`);
        }
      } catch (e) {
        console.error(`Erro ${portal.nome}:`, e);
        errors.push(`${portal.nome}: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
      }
    }

    const dedupedListings = Array.from(
      new Map(
        allListings.map((listing) => [
          `${listing.portal}::${listing.url_anuncio || ''}::${listing.titulo || ''}`.toLowerCase(),
          listing,
        ])
      ).values()
    );
    const listingsComLocalizacao = dedupedListings.filter((listing) => (listing.bairro && listing.bairro.trim()) || (listing.cidade && listing.cidade.trim()));
    const responseListings = listingsComLocalizacao.length > 0 ? listingsComLocalizacao : dedupedListings;
    const responseSuccess = responseListings.length > 0;
    const responseError = responseSuccess ? undefined : (errors[0] || 'Nenhum anúncio encontrado nos portais consultados.');

    console.log(`Total: ${allListings.length} anúncios (${dedupedListings.length} únicos, ${listingsComLocalizacao.length} com localização) de ${portaisSelecionados.length} portais`);

    return new Response(
      JSON.stringify({
        success: responseSuccess,
        data: responseListings,
        total: responseListings.length,
        portais_consultados: portaisSelecionados.length,
        errors: errors.length > 0 ? errors : undefined,
        error: responseError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});