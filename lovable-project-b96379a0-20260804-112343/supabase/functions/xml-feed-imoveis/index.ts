import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imobiliariaId = url.searchParams.get('id');
    const portal = url.searchParams.get('portal') || 'vrsync';

    if (!imobiliariaId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imobiliariaId)) {
      return new Response('Parâmetro "id" inválido', { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active properties
    const { data: imoveis, error } = await supabase
      .from('imoveis')
      .select('*')
      .eq('imobiliaria_id', imobiliariaId)
      .eq('status', 'Ativo');

    if (error) {
      console.error('Erro ao buscar imóveis:', error);
      return new Response('Erro interno', { status: 500, headers: corsHeaders });
    }

    if (!imoveis || imoveis.length === 0) {
      return new Response(generateEmptyXml(portal), {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }

    // Fetch imobiliaria config for branding
    const { data: config } = await supabase
      .from('imobiliaria_config')
      .select('*')
      .eq('user_id', imobiliariaId)
      .single();

    let xml: string;
    switch (portal) {
      case 'vrsync':
      case 'zap':
      case 'vivareal':
      case 'dfimoveis':
        xml = generateVRSyncXml(imoveis, config);
        break;
      case 'olx':
        xml = generateOlxXml(imoveis, config);
        break;
      case 'imovelweb':
      case 'wimoveis':
        xml = generateImovelwebXml(imoveis, config);
        break;
      case 'netimoveis':
      case 'chavenaomao':
        xml = generateGenericXml(imoveis, config, portal);
        break;
      default:
        xml = generateVRSyncXml(imoveis, config);
    }

    return new Response(xml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8' },
    });
  } catch (err) {
    console.error('Erro no feed XML:', err);
    return new Response('Erro interno', { status: 500, headers: corsHeaders });
  }
});

function escapeXml(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cdata(str: string | null | undefined): string {
  if (!str) return '';
  return `<![CDATA[${str}]]>`;
}

function mapTipoVRSync(tipo: string): { tipo: string; subtipo: string } {
  const map: Record<string, { tipo: string; subtipo: string }> = {
    'Apartamento': { tipo: 'Residencial', subtipo: 'Apartamento Padrão' },
    'Casa': { tipo: 'Residencial', subtipo: 'Casa Padrão' },
    'Cobertura': { tipo: 'Residencial', subtipo: 'Cobertura' },
    'Kitnet': { tipo: 'Residencial', subtipo: 'Kitchenette/Conjugados' },
    'Terreno': { tipo: 'Residencial', subtipo: 'Terreno Padrão' },
    'Comercial': { tipo: 'Comercial/Industrial', subtipo: 'Conjunto Comercial/Sala' },
  };
  return map[tipo] || { tipo: 'Residencial', subtipo: 'Apartamento Padrão' };
}

function mapTipoOlx(tipo: string, operacao: string): { category: string; subcategory: string } {
  const isRent = operacao === 'Locação';
  const map: Record<string, { category: string; subcategory: string }> = {
    'Apartamento': { category: isRent ? '1040' : '1020', subcategory: isRent ? '1041' : '1021' },
    'Casa': { category: isRent ? '1040' : '1020', subcategory: isRent ? '1043' : '1023' },
    'Terreno': { category: isRent ? '1040' : '1020', subcategory: isRent ? '1044' : '1024' },
    'Comercial': { category: isRent ? '1060' : '1060', subcategory: isRent ? '1065' : '1061' },
    'Cobertura': { category: isRent ? '1040' : '1020', subcategory: isRent ? '1041' : '1021' },
    'Kitnet': { category: isRent ? '1040' : '1020', subcategory: isRent ? '1041' : '1021' },
  };
  return map[tipo] || { category: '1020', subcategory: '1021' };
}

// ============ VRSync Format (ZAP/VivaReal - Grupo OLX) ============
function generateVRSyncXml(imoveis: any[], config: any): string {
  const listings = imoveis.map(im => {
    const { tipo, subtipo } = mapTipoVRSync(im.tipo);
    const fotos = (im.fotos || []).filter((f: string) => f).slice(0, 30);
    const isRent = im.operacao === 'Locação';

    return `
    <Listing>
      <ListingID>${escapeXml(im.id)}</ListingID>
      <Title>${cdata(im.titulo)}</Title>
      <TransactionType>${isRent ? 'For Rent' : 'For Sale'}</TransactionType>
      <Featured>${im.destaque ? 'true' : 'false'}</Featured>
      <ListDate>${new Date(im.created_at).toISOString().split('T')[0]}</ListDate>
      <LastUpdateDate>${new Date(im.updated_at).toISOString().split('T')[0]}</LastUpdateDate>
      <DetailViewUrl>${cdata(`https://www.radarimobtech.shop/imovel/${im.id}`)}</DetailViewUrl>
      <Location>
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="${escapeXml(im.estado || 'DF')}">${escapeXml(im.estado || 'DF')}</State>
        <City>${cdata(im.cidade || '')}</City>
        <Neighborhood>${cdata(im.bairro || '')}</Neighborhood>
        <Address>${cdata(im.endereco || '')}</Address>
        <PostalCode>${escapeXml(im.cep || '')}</PostalCode>
      </Location>
      <Details>
        <PropertyType>${escapeXml(tipo)}</PropertyType>
        <Description>${cdata(im.descricao || im.titulo)}</Description>
        <ListPrice currency="BRL">${im.preco || 0}</ListPrice>
        ${isRent ? `<RentalPrice currency="BRL">${im.preco || 0}</RentalPrice>` : ''}
        ${im.valor_condominio ? `<PropertyAdministrationFee currency="BRL">${im.valor_condominio}</PropertyAdministrationFee>` : ''}
        ${im.valor_iptu ? `<YearlyTax currency="BRL">${im.valor_iptu}</YearlyTax>` : ''}
        <LivingArea unit="square metres">${im.area || 0}</LivingArea>
        <Bedrooms>${im.quartos || 0}</Bedrooms>
        <Bathrooms>${im.banheiros || 0}</Bathrooms>
        <Suites>${im.suites || 0}</Suites>
        <Garage type="Parking Spaces">${im.vagas || 0}</Garage>
        ${im.andar ? `<Floor>${escapeXml(im.andar)}</Floor>` : ''}
      </Details>
      <Media>
        ${fotos.map((f: string, i: number) => `
        <Item medium="image" caption="Foto ${i + 1}">
          <Url>${cdata(f)}</Url>
        </Item>`).join('')}
        ${(im.videos || []).map((v: string) => `
        <Item medium="video">
          <Url>${cdata(v)}</Url>
        </Item>`).join('')}
      </Media>
      <ContactInfo>
        <Name>${cdata(config?.nome_empresa || 'Imobiliária')}</Name>
        <Email>${escapeXml(config?.email || '')}</Email>
        <Telephone>${escapeXml(config?.telefone || '')}</Telephone>
      </ContactInfo>
    </Listing>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <Provider>${escapeXml(config?.nome_empresa || 'radarimobtech')}</Provider>
    <Email>${escapeXml(config?.email || '')}</Email>
    <ContactName>${escapeXml(config?.nome_empresa || '')}</ContactName>
    <Telephone>${escapeXml(config?.telefone || '')}</Telephone>
    <Logo>${escapeXml(config?.logo_url || '')}</Logo>
  </Header>
  <Listings>${listings}
  </Listings>
</ListingDataFeed>`;
}

// ============ OLX Format ============
function generateOlxXml(imoveis: any[], config: any): string {
  const ads = imoveis.map(im => {
    const { category, subcategory } = mapTipoOlx(im.tipo, im.operacao);
    const fotos = (im.fotos || []).filter((f: string) => f).slice(0, 20);
    const isRent = im.operacao === 'Locação';

    return `
    <ad>
      <id>${escapeXml(im.id)}</id>
      <title>${cdata(im.titulo.substring(0, 90))}</title>
      <category>${category}</category>
      <subcategory>${subcategory}</subcategory>
      <zipcode>${escapeXml(im.cep || '')}</zipcode>
      <body>${cdata((im.descricao || im.titulo).substring(0, 6000))}</body>
      ${isRent ? `<rent>${Math.round(im.preco || 0)}</rent>` : `<price>${Math.round(im.preco || 0)}</price>`}
      ${im.valor_condominio ? `<condominium>${Math.round(im.valor_condominio)}</condominium>` : ''}
      ${im.valor_iptu ? `<iptu>${Math.round(im.valor_iptu)}</iptu>` : ''}
      <rooms>${im.quartos || 0}</rooms>
      <bathrooms>${im.banheiros || 0}</bathrooms>
      <garage_spaces>${im.vagas || 0}</garage_spaces>
      <size>${im.area || 0}</size>
      <images>
        ${fotos.map((f: string, i: number) => `<image url="${escapeXml(f)}"${i === 0 ? ' main="1"' : ''} />`).join('\n        ')}
      </images>
      ${(im.videos || []).length > 0 ? `<videos><video url="${escapeXml(im.videos[0])}" /></videos>` : ''}
    </ad>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<olx_ads>
  <header>
    <name>${escapeXml(config?.nome_empresa || 'Imobiliária')}</name>
    <email>${escapeXml(config?.email || '')}</email>
    <phone>${escapeXml(config?.telefone || '')}</phone>
  </header>
  <ads>${ads}
  </ads>
</olx_ads>`;
}

// ============ Imovelweb/WImóveis Format ============
function generateImovelwebXml(imoveis: any[], config: any): string {
  const properties = imoveis.map(im => {
    const fotos = (im.fotos || []).filter((f: string) => f).slice(0, 30);
    const isRent = im.operacao === 'Locação';

    return `
    <property>
      <id>${escapeXml(im.id)}</id>
      <title>${cdata(im.titulo)}</title>
      <type>${escapeXml(im.tipo)}</type>
      <transaction>${isRent ? 'rent' : 'sale'}</transaction>
      <description>${cdata(im.descricao || im.titulo)}</description>
      <price>${im.preco || 0}</price>
      <currency>BRL</currency>
      ${im.valor_condominio ? `<maintenance_fee>${im.valor_condominio}</maintenance_fee>` : ''}
      ${im.valor_iptu ? `<yearly_tax>${im.valor_iptu}</yearly_tax>` : ''}
      <address>
        <street>${cdata(im.endereco || '')}</street>
        <neighborhood>${cdata(im.bairro || '')}</neighborhood>
        <city>${cdata(im.cidade || '')}</city>
        <state>${escapeXml(im.estado || 'DF')}</state>
        <zipcode>${escapeXml(im.cep || '')}</zipcode>
        <country>BR</country>
      </address>
      <details>
        <area>${im.area || 0}</area>
        <bedrooms>${im.quartos || 0}</bedrooms>
        <suites>${im.suites || 0}</suites>
        <bathrooms>${im.banheiros || 0}</bathrooms>
        <parking>${im.vagas || 0}</parking>
        ${im.andar ? `<floor>${escapeXml(im.andar)}</floor>` : ''}
      </details>
      <images>
        ${fotos.map((f: string, i: number) => `<image order="${i + 1}">${cdata(f)}</image>`).join('\n        ')}
      </images>
      <url>${cdata(`https://www.radarimobtech.shop/imovel/${im.id}`)}</url>
      <contact>
        <name>${cdata(config?.nome_empresa || 'Imobiliária')}</name>
        <email>${escapeXml(config?.email || '')}</email>
        <phone>${escapeXml(config?.telefone || '')}</phone>
      </contact>
    </property>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<properties>
  <header>
    <company>${escapeXml(config?.nome_empresa || 'Imobiliária')}</company>
    <email>${escapeXml(config?.email || '')}</email>
    <phone>${escapeXml(config?.telefone || '')}</phone>
  </header>${properties}
</properties>`;
}

// ============ Generic Format (NetImóveis, DFImóveis, Chave na Mão) ============
function generateGenericXml(imoveis: any[], config: any, portal: string): string {
  const properties = imoveis.map(im => {
    const fotos = (im.fotos || []).filter((f: string) => f).slice(0, 20);
    const isRent = im.operacao === 'Locação';

    return `
    <imovel>
      <CodigoImovel>${escapeXml(im.id)}</CodigoImovel>
      <TituloImovel>${cdata(im.titulo)}</TituloImovel>
      <TipoImovel>${escapeXml(im.tipo)}</TipoImovel>
      <TipoOferta>${isRent ? 'Locação' : 'Venda'}</TipoOferta>
      <Observacao>${cdata(im.descricao || im.titulo)}</Observacao>
      <PrecoVenda>${isRent ? '' : (im.preco || 0)}</PrecoVenda>
      <PrecoLocacao>${isRent ? (im.preco || 0) : ''}</PrecoLocacao>
      ${im.valor_condominio ? `<PrecoCondominio>${im.valor_condominio}</PrecoCondominio>` : ''}
      ${im.valor_iptu ? `<ValorIPTU>${im.valor_iptu}</ValorIPTU>` : ''}
      <AreaUtil>${im.area || 0}</AreaUtil>
      <QtdDormitorios>${im.quartos || 0}</QtdDormitorios>
      <QtdSuites>${im.suites || 0}</QtdSuites>
      <QtdBanheiros>${im.banheiros || 0}</QtdBanheiros>
      <QtdVagas>${im.vagas || 0}</QtdVagas>
      <Endereco>${cdata(im.endereco || '')}</Endereco>
      <Bairro>${cdata(im.bairro || '')}</Bairro>
      <Cidade>${cdata(im.cidade || '')}</Cidade>
      <UF>${escapeXml(im.estado || 'DF')}</UF>
      <CEP>${escapeXml(im.cep || '')}</CEP>
      <Fotos>
        ${fotos.map((f: string) => `<Foto><URLArquivo>${cdata(f)}</URLArquivo></Foto>`).join('\n        ')}
      </Fotos>
    </imovel>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Carga>
  <Imoveis>${properties}
  </Imoveis>
</Carga>`;
}

function generateEmptyXml(portal: string): string {
  switch (portal) {
    case 'olx':
      return `<?xml version="1.0" encoding="UTF-8"?><olx_ads><ads></ads></olx_ads>`;
    case 'vrsync':
    case 'zap':
    case 'vivareal':
      return `<?xml version="1.0" encoding="UTF-8"?><ListingDataFeed><Listings></Listings></ListingDataFeed>`;
    default:
      return `<?xml version="1.0" encoding="UTF-8"?><Carga><Imoveis></Imoveis></Carga>`;
  }
}
