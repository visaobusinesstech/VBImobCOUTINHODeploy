// Bairros curados por cidade para SEO programático.
// Cada combinação (cidade, bairro) gera uma landing page em /imoveis/:cidade/:bairro.
import { SEO_CIDADES, slugify } from "./cidades";

const RAW: Record<string, string[]> = {
  brasilia: [
    "Asa Sul", "Asa Norte", "Sudoeste", "Noroeste", "Lago Sul", "Lago Norte",
    "Cruzeiro", "Octogonal", "Vila Planalto", "Setor Militar Urbano",
    "Setor de Indústrias Gráficas", "Setor Bancário Sul", "Setor Comercial Sul",
    "Setor Hoteleiro Sul", "Setor Hoteleiro Norte",
  ],
  "aguas-claras": [
    "Rua das Pitangueiras", "Rua das Palmeiras", "Rua das Araucárias",
    "Rua das Figueiras", "Rua dos Ipês", "Rua Copaíba", "Arniqueiras", "Areal",
  ],
  taguatinga: [
    "Taguatinga Centro", "Taguatinga Norte", "Taguatinga Sul", "QNL", "QNM",
    "QNJ", "QNG", "QNF", "QNC", "QND", "Colmeia", "Pistão Sul", "Pistão Norte",
  ],
  ceilandia: [
    "Ceilândia Centro", "Ceilândia Norte", "Ceilândia Sul", "P Sul", "P Norte",
    "QNM", "QNN", "QNO", "QNP", "QNQ", "Setor O", "Sol Nascente", "Pôr do Sol",
  ],
  sobradinho: [
    "Sobradinho I", "Sobradinho II", "Grande Colorado", "Nova Colina",
    "Alto da Boa Vista", "Setor de Mansões", "Vila Basevi", "Setor Habitacional Contagem",
  ],
  gama: [
    "Setor Central", "Setor Sul", "Setor Norte", "Setor Leste", "Setor Oeste",
    "Ponte Alta Norte", "Ponte Alta Sul", "DVO",
  ],
  guara: [
    "Guará I", "Guará II", "Park Sul", "Areal", "SIA", "Estrada Parque",
    "QE 1", "QE 5", "QE 15", "QE 25", "QE 40",
  ],
  samambaia: [
    "Samambaia Norte", "Samambaia Sul", "QN 100", "QN 200", "QN 300", "QN 400",
    "QN 500", "QR 100", "QR 300", "QR 500",
  ],
  planaltina: [
    "Setor Tradicional", "Vila Buritis", "Arapoanga", "Jardim Roriz",
    "Vale do Amanhecer", "Estância Mestre D'Armas", "Vila Vicentina",
  ],
  "nucleo-bandeirante": [
    "Núcleo Bandeirante Centro", "Metropolitana", "Divinéia", "Vila Cauhy",
    "Placa das Mercedes",
  ],
  sudoeste: ["CLSW 100", "CLSW 300", "CCSW", "QRSW 1", "QRSW 3", "QRSW 5", "QRSW 6", "QRSW 8"],
  noroeste: ["SQNW 100", "SQNW 300", "SQNW 106", "SQNW 108", "CLNW 5", "CLNW 8"],
  "lago-sul": ["QI 1", "QI 5", "QI 9", "QI 15", "QI 21", "QI 25", "QL 8", "QL 12"],
  "lago-norte": ["QI 3", "QI 5", "QI 9", "QI 13", "QI 17", "QI 21", "QL 4", "QL 8"],
  "asa-sul": ["SQS 102", "SQS 106", "SQS 108", "SQS 202", "SQS 302", "SQS 402", "SCS", "CLS 202"],
  "asa-norte": ["SQN 102", "SQN 106", "SQN 108", "SQN 202", "SQN 302", "SQN 402", "SCN", "CLN 202"],
  "vicente-pires": ["Rua 4", "Rua 8", "Rua 10", "Chácara 100", "Chácara 200", "Chácara 300"],
  "jardim-botanico": ["Etapa 1", "Etapa 2", "Etapa 3", "San Diego", "Villa Verde", "Solar de Brasília"],
  "park-way": ["Quadra 2", "Quadra 4", "Quadra 8", "Quadra 12", "Quadra 22", "Quadra 26"],
  cruzeiro: ["Cruzeiro Velho", "Cruzeiro Novo", "SHCES", "SHCEN"],
  "valparaiso-de-goias": [
    "Parque Rio Branco", "Parque Anhanguera", "Céu Azul", "Cidade Jardins",
    "Jardim Oriente", "Esplanada", "Etapa A", "Etapa B",
  ],
  "aguas-lindas-de-goias": [
    "Jardim Brasília", "Vila Pacífico", "Parque da Barragem", "Copacabana",
    "Setor Fátima", "Mansões Camargo",
  ],
  luziania: ["Centro", "Jardim Ingá", "Parque Estrela Dalva", "Mingone", "Alvorada"],
  goiania: [
    "Setor Bueno", "Setor Marista", "Setor Oeste", "Setor Sul", "Setor Central",
    "Setor Aeroporto", "Jardim Goiás", "Alto da Glória", "Alto do Bueno",
    "Nova Suíça", "Pedro Ludovico", "Park Lozandes",
  ],
  "sao-paulo": [
    "Vila Mariana", "Moema", "Pinheiros", "Vila Madalena", "Itaim Bibi",
    "Jardim Paulista", "Perdizes", "Higienópolis", "Santana", "Tatuapé",
    "Mooca", "Brooklin", "Campo Belo", "Vila Olímpia", "Bela Vista",
  ],
  "rio-de-janeiro": [
    "Copacabana", "Ipanema", "Leblon", "Barra da Tijuca", "Botafogo", "Flamengo",
    "Tijuca", "Recreio dos Bandeirantes", "Jardim Botânico", "Lagoa",
    "Laranjeiras", "Gávea", "Vila Isabel",
  ],
  "belo-horizonte": [
    "Savassi", "Funcionários", "Lourdes", "Buritis", "Belvedere", "Anchieta",
    "Sion", "Serra", "Santo Agostinho", "Cidade Nova", "Ouro Preto", "Castelo",
  ],
  curitiba: [
    "Batel", "Água Verde", "Bigorrilho", "Cabral", "Ecoville", "Juvevê",
    "Portão", "Champagnat", "Centro Cívico", "Mercês", "Cristo Rei", "Alto da XV",
  ],
  "porto-alegre": [
    "Moinhos de Vento", "Bela Vista", "Petrópolis", "Menino Deus", "Auxiliadora",
    "Higienópolis", "Cidade Baixa", "Bom Fim", "Rio Branco", "Mont'Serrat", "Três Figueiras",
  ],
  florianopolis: [
    "Centro", "Trindade", "Córrego Grande", "Itacorubi", "Jurerê Internacional",
    "Ingleses", "Canasvieiras", "Lagoa da Conceição", "Campeche", "Ratones",
  ],
};

export interface Bairro {
  slug: string;
  nome: string;
  cidadeSlug: string;
  cidadeNome: string;
  uf: string;
}

export const SEO_BAIRROS: Bairro[] = SEO_CIDADES.flatMap((c) => {
  const list = RAW[c.slug] ?? [];
  return list.map((nome) => ({
    slug: slugify(nome),
    nome,
    cidadeSlug: c.slug,
    cidadeNome: c.nome,
    uf: c.uf,
  }));
});

export function findBairro(cidadeSlug: string, bairroSlug: string): Bairro | null {
  return (
    SEO_BAIRROS.find((b) => b.cidadeSlug === cidadeSlug && b.slug === bairroSlug) ?? null
  );
}

export function bairrosDaCidade(cidadeSlug: string): Bairro[] {
  return SEO_BAIRROS.filter((b) => b.cidadeSlug === cidadeSlug);
}
