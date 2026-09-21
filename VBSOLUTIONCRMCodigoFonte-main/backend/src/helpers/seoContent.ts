/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

export type SeoCheckStatus = "ok" | "alerta" | "critico";

export function computeSeoChecks(input: {
  titulo?: string;
  slug?: string;
  meta?: string;
  corpo?: string;
  keyword?: string;
}) {
  const titulo = String(input.titulo || "");
  const meta = String(input.meta || "");
  const corpo = String(input.corpo || "");
  const kw = String(input.keyword || "").toLowerCase();
  const hasKw = (s: string) => kw && s.toLowerCase().includes(kw);
  const items = [
    {
      id: "title-len",
      titulo: "Título 50–60 caracteres",
      status: (titulo.length >= 50 && titulo.length <= 60 ? "ok" : titulo.length >= 40 ? "alerta" : "critico") as SeoCheckStatus,
      detalhe: `${titulo.length} caracteres`
    },
    {
      id: "title-kw",
      titulo: "Keyword no título",
      status: (!kw ? "alerta" : hasKw(titulo) ? "ok" : "critico") as SeoCheckStatus,
      detalhe: kw || "sem keyword"
    },
    {
      id: "meta-len",
      titulo: "Meta 120–160 caracteres",
      status: (meta.length >= 120 && meta.length <= 160 ? "ok" : meta.length >= 80 ? "alerta" : "critico") as SeoCheckStatus,
      detalhe: `${meta.length} caracteres`
    },
    {
      id: "body-len",
      titulo: "Corpo com 300+ palavras",
      status: (corpo.split(/\s+/).filter(Boolean).length >= 300 ? "ok" : "alerta") as SeoCheckStatus,
      detalhe: `${corpo.split(/\s+/).filter(Boolean).length} palavras`
    }
  ];
  const score = Math.round(
    (items.filter(i => i.status === "ok").length / items.length) * 100
  );
  return { score, items };
}

export function generateSeoContent(imovel: {
  title?: string;
  type?: string;
  city?: string;
  neighborhood?: string;
  bedrooms?: number;
  price?: number;
}) {
  const tipo = imovel.type || "Imóvel";
  const bairro = imovel.neighborhood || "região";
  const cidade = imovel.city || "sua cidade";
  const quartos = imovel.bedrooms ? `${imovel.bedrooms} quartos` : "excelente planta";
  const keyword = `${tipo} ${bairro} ${cidade}`.trim();
  const titulo = `${tipo} ${quartos} em ${bairro} | ${cidade}`.slice(0, 60);
  const meta = `Confira ${tipo.toLowerCase()} com ${quartos} em ${bairro}, ${cidade}. Atendimento pelo CRM, visita agendada e proposta rápida para o imóvel ${imovel.title || ""}.`.slice(0, 160);
  const slug = `${String(tipo).toLowerCase()}-${String(bairro).toLowerCase()}-${String(cidade).toLowerCase()}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const corpo = [
    `${imovel.title || tipo} está localizado em ${bairro}, ${cidade}.`,
    `O imóvel oferece ${quartos} e é uma opção para quem busca morar ou investir na região.`,
    `Agende uma visita com nossa equipe e receba uma análise de mercado comparativa da região.`,
    `Palavra-chave: ${keyword}.`
  ].join("\n\n");
  const checks = computeSeoChecks({ titulo, slug, meta, corpo, keyword });
  return { titulo, slug, meta, corpo, keyword, ...checks };
}
