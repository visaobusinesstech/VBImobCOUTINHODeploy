// Registry das rotas públicas com SEO gerenciado via <Seo />.
// Fonte da verdade para o painel /seo-auditoria.

export interface SeoRouteEntry {
  path: string;
  title: string;
  description: string;
  noindex?: boolean;
  hasJsonLd?: boolean;
  hasImage?: boolean;
  dynamic?: boolean; // rota parametrizada (título/description gerados em runtime)
  notes?: string;
  category: "público" | "auth" | "SEO programático" | "portal" | "app";
}

const BASE = "https://radarimobtech.shop";

export const SEO_ROUTES: SeoRouteEntry[] = [
  {
    path: "/",
    title: "radarimobtech — CRM imobiliário com IA e captação proativa",
    description:
      "Plataforma completa para imobiliárias e corretores: CRM, avaliação por IA (SAS), captação de proprietários e automações de WhatsApp.",
    hasJsonLd: true,
    hasImage: true,
    category: "público",
  },
  {
    path: "/landing",
    title: "radarimobtech — CRM imobiliário com IA e captação proativa",
    description:
      "Plataforma completa para imobiliárias e corretores: CRM, avaliação por IA (SAS), captação de proprietários e automações de WhatsApp.",
    hasJsonLd: true,
    category: "público",
  },
  {
    path: "/auth",
    title: "Entrar ou criar conta — radarimobtech",
    description:
      "Acesse sua conta radarimobtech ou crie uma nova para gerenciar seu CRM imobiliário, avaliações por IA e captação de proprietários.",
    noindex: true,
    category: "auth",
  },
  {
    path: "/reset-password",
    title: "Redefinir senha — radarimobtech",
    description: "Defina uma nova senha para acessar sua conta radarimobtech.",
    noindex: true,
    category: "auth",
  },
  {
    path: "/portal",
    title: "Portal de imóveis — venda e aluguel | radarimobtech",
    description:
      "Encontre apartamentos, casas e imóveis à venda e para alugar. Busque por cidade, bairro, tipo, preço e quartos no portal público radarimobtech.",
    category: "portal",
  },
  {
    path: "/imovel/:id",
    title: "(dinâmico) título + preço + local do imóvel",
    description:
      "(dinâmico) preço · quartos · área · local · descrição do anúncio",
    dynamic: true,
    hasJsonLd: true,
    hasImage: true,
    notes: "JSON-LD Product/Offer com endereço; og:image = foto de capa.",
    category: "portal",
  },
  {
    path: "/comparativo",
    title: "Comparativo de imóveis — radarimobtech",
    description:
      "Compare até 4 imóveis lado a lado: preço, área, quartos, condomínio, IPTU e score de oportunidade.",
    noindex: true,
    category: "app",
  },
  {
    path: "/lgpd/meus-dados",
    title: "Portal LGPD — Direitos do titular | radarimobtech",
    description:
      "Exerça seus direitos LGPD sobre dados pessoais tratados pela radarimobtech: acesso, correção, exclusão, portabilidade e revogação de consentimento.",
    category: "público",
  },
  {
    path: "/solucoes/seo-imobiliario",
    title: "SEO Imobiliário: Ferramenta que Gera Leads | radarimobtech",
    description:
      "Software de marketing para imobiliárias com SEO automatizado, geração de leads para corretores e aumento real de vendas de imóveis. Teste grátis.",
    hasJsonLd: true,
    category: "público",
    notes: "Landing comercial: Product + FAQPage + BreadcrumbList schemas.",
  },
  {
    path: "/anunciar-imovel",
    title: "Anunciar imóvel grátis — 30 cidades | radarimobtech",
    description:
      "Anuncie seu imóvel direto do proprietário em 30 cidades do Brasil. Sem comissão, sem intermediários, com avaliação por IA gratuita.",
    hasJsonLd: true,
    category: "SEO programático",
  },
  {
    path: "/anunciar-imovel/:cidade",
    title: "(dinâmico) Anunciar imóvel em {cidade} — radarimobtech",
    description:
      "(dinâmico) KPIs do mercado local + CTA para anunciar direto pelo proprietário.",
    dynamic: true,
    hasJsonLd: true,
    notes: "35+ cidades servidas via SEO programático.",
    category: "SEO programático",
  },
  {
    path: "/imoveis/:cidade/:bairro",
    title: "(dinâmico) Imóveis à venda e para alugar em {bairro}, {cidade} - {UF} | radarimobtech",
    description:
      "(dinâmico) Landing programática por cidade+bairro com conteúdo único, JSON-LD (RealEstateAgent, Product, FAQ, Breadcrumb) e formulário de captação.",
    dynamic: true,
    hasJsonLd: true,
    notes: "Centenas de páginas geradas a partir de SEO_BAIRROS × SEO_CIDADES.",
    category: "SEO programático",
  },
];

export function toAbsoluteUrl(path: string) {
  return `${BASE}${path}`;
}

export function classifyTitle(t: string) {
  const len = t.length;
  if (len < 20) return { level: "warn" as const, msg: `${len} chars — curto demais (<20)` };
  if (len > 70) return { level: "warn" as const, msg: `${len} chars — longo (>70)` };
  return { level: "ok" as const, msg: `${len} chars` };
}

export function classifyDescription(d: string) {
  const len = d.length;
  if (len < 80) return { level: "warn" as const, msg: `${len} chars — curto (<80)` };
  if (len > 170) return { level: "warn" as const, msg: `${len} chars — longo (>170)` };
  return { level: "ok" as const, msg: `${len} chars` };
}
