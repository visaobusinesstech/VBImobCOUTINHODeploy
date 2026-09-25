// Gerador determinístico de conteúdo programático rico por (cidade, bairro).
// Cada bairro recebe variantes estáveis via seed, evitando conteúdo duplicado
// entre páginas e mantendo relevância semântica para busca orgânica.
import type { Bairro } from "./bairros";

function seedFrom(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
function pick<T>(list: T[], seed: number, salt = 0): T {
  return list[(seed ^ salt) % list.length];
}

const PERFIS = [
  "famílias que buscam qualidade de vida e proximidade de escolas",
  "investidores focados em valorização de médio e longo prazo",
  "jovens profissionais que priorizam mobilidade e serviços a pé",
  "aposentados em busca de tranquilidade, segurança e conveniência",
  "casais recém-formados procurando primeiro imóvel bem localizado",
];
const DIFERENCIAIS = [
  "comércio local consolidado, farmácias, mercados e boa infraestrutura de transporte",
  "áreas verdes, ciclovias, parques urbanos e vida de bairro ativa",
  "gastronomia diversificada, cafés especiais e vida noturna próxima",
  "colégios renomados, academias, clínicas e serviços do dia a dia a poucos minutos",
  "shoppings, faculdades e polos empresariais no entorno imediato",
];
const TIPOS_MIX = [
  "apartamentos de 1 a 4 quartos, coberturas e studios",
  "casas em condomínio fechado, sobrados e apartamentos amplos",
  "coberturas duplex, apartamentos garden e studios modernos",
  "kitnets, lofts e apartamentos compactos ideais para investimento",
  "imóveis de alto padrão, coberturas e casas exclusivas",
];
const FAIXAS_VENDA: [string, string][] = [
  ["R$ 280 mil", "R$ 1,2 milhão"],
  ["R$ 350 mil", "R$ 1,8 milhão"],
  ["R$ 450 mil", "R$ 2,5 milhões"],
  ["R$ 600 mil", "R$ 3,5 milhões"],
  ["R$ 220 mil", "R$ 950 mil"],
];
const FAIXAS_ALUGUEL: [string, string][] = [
  ["R$ 1.400", "R$ 5.500"],
  ["R$ 1.800", "R$ 7.200"],
  ["R$ 2.400", "R$ 9.500"],
  ["R$ 3.200", "R$ 14.000"],
  ["R$ 1.200", "R$ 4.200"],
];
const TRANSPORTES = [
  "linhas de ônibus frequentes, ciclovia contínua e acesso rápido às vias principais",
  "estação de metrô/BRT próxima, corredores expressos e apps de mobilidade sob demanda",
  "acesso direto às principais avenidas, estacionamento facilitado e opções de transporte fretado",
  "múltiplas rotas de ônibus, terminais integrados e conexões para o centro e polos empresariais",
];
const AMENIDADES = [
  "supermercados 24h, padarias artesanais, farmácias, pet shops e academias",
  "colégios bilíngues, cursos livres, clínicas médicas, laboratórios e restaurantes variados",
  "praças arborizadas, parques infantis, quadras esportivas, ciclovia e feiras livres",
  "polos gastronômicos, cafés, coworkings, cinemas e centros culturais",
];

export interface BairroContent {
  perfil: string;
  diferencial: string;
  tipos: string;
  faixaVenda: [string, string];
  faixaAluguel: [string, string];
  transporte: string;
  amenidades: string;
  destaques: string[];
  investimento: string;
}

export function generateContent(b: Bairro): BairroContent {
  const s = seedFrom(`${b.cidadeSlug}::${b.slug}`);
  const perfil = pick(PERFIS, s, 0x1a);
  const diferencial = pick(DIFERENCIAIS, s, 0x2b);
  const tipos = pick(TIPOS_MIX, s, 0x3c);
  const faixaVenda = pick(FAIXAS_VENDA, s, 0x4d);
  const faixaAluguel = pick(FAIXAS_ALUGUEL, s, 0x5e);
  const transporte = pick(TRANSPORTES, s, 0x6f);
  const amenidades = pick(AMENIDADES, s, 0x71);

  const destaques = [
    `Mix de ${tipos} para diferentes perfis e orçamentos`,
    `Faixa de preço de venda entre ${faixaVenda[0]} e ${faixaVenda[1]}`,
    `Aluguéis a partir de ${faixaAluguel[0]}, chegando a ${faixaAluguel[1]} em unidades premium`,
    `Perfil de moradores: ${perfil}`,
    `Infraestrutura: ${amenidades}`,
    `Mobilidade: ${transporte}`,
  ];

  const invSalt = (s ^ 0x9a) % 3;
  const investimento =
    invSalt === 0
      ? `${b.nome} tem apresentado boa liquidez para locação, com ticket médio compatível com o público jovem-profissional de ${b.cidadeNome}. Cap rates observados costumam ficar entre 0,45% e 0,65% ao mês em unidades bem posicionadas.`
      : invSalt === 1
      ? `A valorização acumulada em ${b.nome} nos últimos ciclos tem superado a média de ${b.cidadeNome}, especialmente para imóveis com metragem otimizada e vagas cobertas. Investidores focam em unidades de 1 e 2 quartos para giro rápido.`
      : `Investir em ${b.nome} costuma equilibrar valorização patrimonial e renda de aluguel. Empreendimentos novos entregues nos últimos 24 meses aqueceram a demanda por unidades usadas prontas para morar.`;

  return { perfil, diferencial, tipos, faixaVenda, faixaAluguel, transporte, amenidades, destaques, investimento };
}

export type Modo = "venda" | "aluguel" | "ambos";

export function h1(b: Bairro, modo: Modo): string {
  if (modo === "venda") return `Imóveis à venda em ${b.nome}, ${b.cidadeNome} - ${b.uf}`;
  if (modo === "aluguel") return `Imóveis para alugar em ${b.nome}, ${b.cidadeNome} - ${b.uf}`;
  return `Imóveis à venda e para alugar em ${b.nome}, ${b.cidadeNome} - ${b.uf}`;
}

export function metaDesc(b: Bairro, c: BairroContent, modo: Modo): string {
  const foco = modo === "venda" ? "à venda" : modo === "aluguel" ? "para alugar" : "à venda e para alugar";
  return `Imóveis ${foco} em ${b.nome}, ${b.cidadeNome} - ${b.uf}: ${c.tipos}. Preços a partir de ${
    modo === "aluguel" ? c.faixaAluguel[0] : c.faixaVenda[0]
  }, atendimento por corretor local e agendamento de visita rápido.`.slice(0, 168);
}
