// Utilitário compartilhado: validação de schema de `dados_extraidos_raw`
// e inferência (fallback) do tipo do imóvel quando o campo está ausente
// ou incompleto na calibração/filtragem por IA.

export type TipoImovelCanonico =
  | "apartamento"
  | "casa"
  | "cobertura"
  | "kitnet"
  | "studio"
  | "sobrado"
  | "flat"
  | "loft"
  | "sala_comercial"
  | "loja"
  | "galpao"
  | "terreno"
  | "chacara"
  | "sitio"
  | "fazenda"
  | "imovel";

const CANONICAL_ALIASES: Record<string, TipoImovelCanonico> = {
  apartamento: "apartamento",
  ap: "apartamento",
  apto: "apartamento",
  apt: "apartamento",
  casa: "casa",
  cobertura: "cobertura",
  duplex: "cobertura",
  triplex: "cobertura",
  kitnet: "kitnet",
  kit: "kitnet",
  quitinete: "kitnet",
  studio: "studio",
  "studio/loft": "studio",
  sobrado: "sobrado",
  flat: "flat",
  loft: "loft",
  sala: "sala_comercial",
  "sala comercial": "sala_comercial",
  conjunto: "sala_comercial",
  escritorio: "sala_comercial",
  loja: "loja",
  galpao: "galpao",
  "galpão": "galpao",
  deposito: "galpao",
  terreno: "terreno",
  lote: "terreno",
  chacara: "chacara",
  "chácara": "chacara",
  sitio: "sitio",
  "sítio": "sitio",
  fazenda: "fazenda",
};

const KEYWORD_PATTERNS: [RegExp, TipoImovelCanonico][] = [
  [/\b(cobertura|duplex|triplex)\b/i, "cobertura"],
  [/\b(kitnet|kitinete|quitinete|kit)\b/i, "kitnet"],
  [/\b(studio|st[uú]dio)\b/i, "studio"],
  [/\b(sobrado)\b/i, "sobrado"],
  [/\b(flat)\b/i, "flat"],
  [/\b(loft)\b/i, "loft"],
  [/\b(sala\s+comercial|conjunto\s+comercial|escrit[oó]rio)\b/i, "sala_comercial"],
  [/\b(loja)\b/i, "loja"],
  [/\b(galp[aã]o|dep[oó]sito)\b/i, "galpao"],
  [/\b(terreno|lote)\b/i, "terreno"],
  [/\b(ch[aá]cara)\b/i, "chacara"],
  [/\b(s[ií]tio)\b/i, "sitio"],
  [/\b(fazenda)\b/i, "fazenda"],
  [/\b(apartamento|apto\.?|apt\.?|ap\b)/i, "apartamento"],
  [/\b(casa)\b/i, "casa"],
];

function normalize(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalizeTipo(raw: unknown): TipoImovelCanonico | null {
  const n = normalize(raw);
  if (!n) return null;
  if (CANONICAL_ALIASES[n]) return CANONICAL_ALIASES[n];
  for (const [re, tipo] of KEYWORD_PATTERNS) {
    if (re.test(n)) return tipo;
  }
  return null;
}

/**
 * Valida (defensivamente) o objeto `dados_extraidos_raw` retornado pelo scraper.
 * Sempre devolve um objeto seguro — nunca lança — e reporta quais campos foram
 * saneados. Garante que valores esperados como números venham de fato como número.
 */
export function validateRawSchema(raw: unknown): {
  data: Record<string, any>;
  ok: boolean;
  fields_missing: string[];
  sanitized: string[];
} {
  const sanitized: string[] = [];
  const missing: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      data: {},
      ok: false,
      fields_missing: ["dados_extraidos_raw"],
      sanitized: ["dados_extraidos_raw:non_object"],
    };
  }

  const src = raw as Record<string, any>;
  const out: Record<string, any> = {};

  const numFields = ["area", "quartos", "suites", "vagas", "condominio", "iptu", "preco"];
  for (const f of numFields) {
    const v = src[f];
    if (v === undefined || v === null || v === "") {
      missing.push(f);
      continue;
    }
    const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
    if (Number.isFinite(n)) out[f] = n;
    else sanitized.push(`${f}:invalid_number`);
  }

  const strFields = ["tipo_imovel", "tipo", "endereco", "descricao"];
  for (const f of strFields) {
    const v = src[f];
    if (v === undefined || v === null || v === "") {
      missing.push(f);
      continue;
    }
    if (typeof v !== "string") {
      sanitized.push(`${f}:coerced_to_string`);
      out[f] = String(v).slice(0, 500);
    } else {
      out[f] = v.slice(0, 500);
    }
  }

  return {
    data: out,
    ok: !!(out.tipo_imovel || out.tipo),
    fields_missing: missing,
    sanitized,
  };
}

/**
 * Deriva o tipo do imóvel a partir de múltiplas fontes, em ordem de confiança:
 *   1. `dados_extraidos_raw.tipo_imovel` / `tipo` (após validação de schema)
 *   2. Coluna canônica `tipo_imovel` do registro
 *   3. Palavras-chave no `titulo_imovel`
 *   4. Palavras-chave em `observacoes` / `descricao`
 *   5. Slug/host da `url_anuncio`
 *   6. Default: `"imovel"`
 */
export function inferTipoImovel(row: {
  dados_extraidos_raw?: unknown;
  tipo_imovel?: string | null;
  titulo_imovel?: string | null;
  observacoes?: string | null;
  descricao?: string | null;
  url_anuncio?: string | null;
}): { tipo: TipoImovelCanonico; source: string; fallback: boolean } {
  const validated = validateRawSchema(row.dados_extraidos_raw);
  const rawTipo =
    canonicalizeTipo(validated.data.tipo_imovel) ??
    canonicalizeTipo(validated.data.tipo);
  if (rawTipo) return { tipo: rawTipo, source: "dados_extraidos_raw", fallback: false };

  const colTipo = canonicalizeTipo((row as any).tipo_imovel);
  if (colTipo) return { tipo: colTipo, source: "coluna_tipo_imovel", fallback: true };

  const fromTitulo = canonicalizeTipo(row.titulo_imovel);
  if (fromTitulo) return { tipo: fromTitulo, source: "titulo_imovel", fallback: true };

  const fromObs =
    canonicalizeTipo(row.observacoes) ?? canonicalizeTipo(row.descricao);
  if (fromObs) return { tipo: fromObs, source: "observacoes", fallback: true };

  if (row.url_anuncio) {
    try {
      const url = new URL(row.url_anuncio);
      const slug = decodeURIComponent(url.pathname).replace(/[-_/]+/g, " ");
      const fromUrl = canonicalizeTipo(slug);
      if (fromUrl) return { tipo: fromUrl, source: "url_anuncio", fallback: true };
    } catch {
      // ignore invalid urls
    }
  }

  return { tipo: "imovel", source: "default", fallback: true };
}
