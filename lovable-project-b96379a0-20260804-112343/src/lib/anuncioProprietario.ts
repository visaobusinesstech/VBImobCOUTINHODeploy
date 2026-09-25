/**
 * Heurísticas para identificar se um anúncio é de PROPRIETÁRIO DIRETO
 * e extrair o contato público divulgado no próprio anúncio.
 */

const TEXTO_PROPRIETARIO = [
  "proprietario",
  "proprietária",
  "direto com o dono",
  "direto com dono",
  "sem intermediarios",
  "sem intermediários",
  "sem corretor",
  "sem imobiliaria",
  "sem imobiliária",
  "particular",
  "dono vende",
  "vendo direto",
  "aluga direto",
];

const TEXTO_IMOBILIARIA = [
  "creci",
  "imobiliaria",
  "imobiliária",
  "corretor",
  "corretora",
  "consultor de imoveis",
  "consultor de imóveis",
  "equipe de vendas",
  "plantao de vendas",
  "plantão de vendas",
  "construtora",
  "incorporadora",
];

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type ClassificacaoAnunciante = {
  tipo: "proprietario" | "imobiliaria" | "indefinido";
  proprietarioDireto: boolean;
  motivo: string;
};

export function classificarAnunciante(dados: {
  titulo?: string | null;
  descricao?: string | null;
  anunciante?: string | null;
  url?: string | null;
}): ClassificacaoAnunciante {
  const base = normalizar(
    [dados.titulo, dados.descricao, dados.anunciante, dados.url].filter(Boolean).join(" \n "),
  );

  const marcasProprietario = TEXTO_PROPRIETARIO.filter((t) => base.includes(normalizar(t)));
  const marcasImobiliaria = TEXTO_IMOBILIARIA.filter((t) => base.includes(normalizar(t)));

  if (marcasImobiliaria.length > 0 && marcasProprietario.length === 0) {
    return {
      tipo: "imobiliaria",
      proprietarioDireto: false,
      motivo: `Indícios de intermediação: ${marcasImobiliaria.slice(0, 3).join(", ")}`,
    };
  }

  if (marcasProprietario.length > 0) {
    return {
      tipo: "proprietario",
      proprietarioDireto: true,
      motivo: `Anúncio direto identificado: ${marcasProprietario.slice(0, 3).join(", ")}`,
    };
  }

  return {
    tipo: "indefinido",
    proprietarioDireto: false,
    motivo: "Não foi possível confirmar que o anúncio é de proprietário direto",
  };
}

/** Extrai telefone público (formato BR) do texto do anúncio. */
export function extrairTelefonePublico(texto?: string | null): string | null {
  if (!texto) return null;
  const match = texto.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]*)?9?\d{4}[\s.-]?\d{4}/g);
  if (!match) return null;
  for (const bruto of match) {
    const digitos = bruto.replace(/\D/g, "");
    if (digitos.length >= 10 && digitos.length <= 13) return digitos;
  }
  return null;
}

/** Extrai e-mail público do texto do anúncio. */
export function extrairEmailPublico(texto?: string | null): string | null {
  if (!texto) return null;
  const match = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

/** Varre recursivamente qualquer objeto/valor coletando texto para busca de contatos. */
function coletarTexto(valor: unknown, profundidade = 0): string {
  if (profundidade > 4 || valor == null) return "";
  if (typeof valor === "string" || typeof valor === "number") return String(valor);
  if (Array.isArray(valor)) return valor.map((v) => coletarTexto(v, profundidade + 1)).join(" \n ");
  if (typeof valor === "object") {
    return Object.values(valor as Record<string, unknown>)
      .map((v) => coletarTexto(v, profundidade + 1))
      .join(" \n ");
  }
  return "";
}

/**
 * Coleta telefone/e-mail públicos a partir de todo o payload extraído do anúncio
 * (título, descrição, campos de contato, anunciante, html bruto etc.).
 */
export function coletarContatosPublicos(dados: unknown): { telefone: string | null; email: string | null } {
  const texto = coletarTexto(dados);
  return {
    telefone: extrairTelefonePublico(texto),
    email: extrairEmailPublico(texto),
  };
}

/** Regra de captação: guardamos apenas anúncios que NÃO são de intermediários. */
export function deveCaptarAnuncio(classificacao: ClassificacaoAnunciante): boolean {
  return classificacao.tipo !== "imobiliaria";
}
