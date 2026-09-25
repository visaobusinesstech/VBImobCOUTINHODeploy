import { supabase } from '@/integrations/supabase/client';

export type ImovelMercado = {
  id?: string;
  portal: string;
  url_anuncio?: string;
  titulo: string;
  tipo?: string;
  operacao?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  preco: number;
  area: number;
  quartos: number;
  banheiros: number;
  vagas: number;
  preco_m2: number;
  dias_anuncio?: number;
  q_score?: number;
  data_scraping?: string;
  fotos?: string[];
  telefone?: string;
  email?: string;
};

export type ScrapeResult = {
  success: boolean;
  data?: ImovelMercado[];
  total?: number;
  portais_consultados?: number;
  errors?: string[];
  error?: string;
};

// Portais onde proprietários anunciam diretamente (sem intermediação obrigatória de imobiliária)
export const PORTAIS_DISPONIVEIS = [
  { key: 'proprietario_direto', label: 'Proprietário Direto 🎯', desc: 'Captação focada em Brasília — anúncios diretos de proprietários' },
  { key: 'captei', label: 'Captei 🎯', desc: 'Plataforma de captação de proprietários (Brasília)' },
  { key: 'alugamais', label: 'Aluga Mais 🔑', desc: 'Locação direta com proprietários' },
  { key: 'imovelp', label: 'Imóvelp.com.br 🏠', desc: 'Imóvel do Proprietário — direto com dono' },
  { key: 'imovelweb_proprietario', label: 'Imovelweb (Aba Proprietário) 🏠', desc: 'Aba "Particular" do Imovelweb' },
  { key: 'wimoveis_proprietario', label: 'WImóveis (Aba Proprietário) 🏠', desc: 'Aba "Particular" do WImóveis (DF)' },
  { key: 'olx', label: 'OLX 🏠', desc: 'Proprietários anunciam direto' },
  { key: 'mercadolivre', label: 'Mercado Livre 🏠', desc: 'Anúncios diretos de proprietários' },
  { key: 'chavenaomao', label: 'Chave na Mão 🏠', desc: 'Permite anúncio de proprietário' },
  { key: 'quintoandar', label: 'QuintoAndar 🏠', desc: 'Proprietários cadastram direto' },
  { key: 'zapimoveis', label: 'ZAP Imóveis 🏠', desc: 'Aceita proprietário direto' },
  { key: 'vivareal', label: 'VivaReal 🏠', desc: 'Aceita proprietário direto' },
  { key: 'i123', label: '123i 🏠', desc: 'Plataforma de proprietário' },
  { key: 'wimoveis', label: 'WImóveis 🏠', desc: 'Aceita proprietário (DF)' },
  { key: 'alude', label: 'Alude 🏠', desc: 'Plataforma Alude — anúncios de proprietários' },
  { key: 'imovel_proprietario', label: 'Imóvel do Proprietário 🏠', desc: 'Busca dedicada por anúncios diretos (sem imobiliária)' },
];

export async function scrapePortais(
  cidade: string,
  tipo: string = 'apartamento',
  operacao: string = 'Venda',
  portais: string[] = ['olx', 'mercadolivre', 'chavenaomao', 'quintoandar', 'zapimoveis', 'vivareal', 'i123', 'wimoveis', 'alude'],
  estado: string = 'DF'
): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-portais-imoveis', {
    body: { cidade, tipo, operacao, portais, estado },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as ScrapeResult;
}

export async function salvarImoveisMercado(
  imobiliaria_id: string,
  imoveis: ImovelMercado[]
): Promise<{ success: boolean; count: number }> {
  const records = imoveis.map(i => ({
    imobiliaria_id,
    portal: i.portal,
    url_anuncio: i.url_anuncio || null,
    titulo: i.titulo,
    tipo: i.tipo || 'Apartamento',
    operacao: i.operacao || 'Venda',
    bairro: i.bairro || null,
    cidade: i.cidade || null,
    estado: i.estado || 'DF',
    preco: i.preco,
    area: i.area,
    quartos: i.quartos,
    banheiros: i.banheiros,
    vagas: i.vagas,
    preco_m2: i.preco_m2,
    dias_anuncio: i.dias_anuncio || 0,
    q_score: i.q_score || null,
    dados_raw: {},
  }));

  const { error } = await supabase.from('imoveis_mercado' as any).insert(records as any);
  if (error) {
    console.error('Erro ao salvar:', error);
    return { success: false, count: 0 };
  }

  return { success: true, count: records.length };
}

export async function getImoveisMercado(imobiliaria_id: string): Promise<ImovelMercado[]> {
  const { data, error } = await supabase
    .from('imoveis_mercado' as any)
    .select('*')
    .eq('imobiliaria_id', imobiliaria_id)
    .order('data_scraping', { ascending: false });

  if (error) {
    console.error('Erro ao buscar:', error);
    return [];
  }

  return (data || []) as unknown as ImovelMercado[];
}

export async function limparImoveisMercado(imobiliaria_id: string): Promise<boolean> {
  const { error } = await supabase
    .from('imoveis_mercado' as any)
    .delete()
    .eq('imobiliaria_id', imobiliaria_id);

  return !error;
}
