// Parser puro da resposta do Firecrawl v2 /search
// Isolado para permitir testes automatizados sem tocar em rede / Deno.serve.

export type FirecrawlItem = {
  url?: string;
  link?: string;
  title?: string | null;
  description?: string | null;
  snippet?: string | null;
  [k: string]: unknown;
};

export type ParsedFirecrawl = {
  items: FirecrawlItem[];
  shape: string[];
};

/**
 * Normaliza a resposta do Firecrawl v2 aceitando as variações conhecidas:
 *  - v2 esperado:      { data: { web: [...], news?: [...] } }
 *  - v1 legado:        { data: [...] }
 *  - variante topo:    { web: [...] }
 *
 * Sempre retorna a lista mesclada `items` (nunca undefined) e um `shape`
 * descritivo para telemetria.
 */
export function parseFirecrawlSearch(json: unknown): ParsedFirecrawl {
  const j = (json ?? {}) as Record<string, any>;
  const data = j?.data;

  const web: FirecrawlItem[] = Array.isArray(data?.web) ? data.web : [];
  const news: FirecrawlItem[] = Array.isArray(data?.news) ? data.news : [];
  const dataArr: FirecrawlItem[] = Array.isArray(data) ? data : [];
  const webTop: FirecrawlItem[] = Array.isArray(j?.web) ? j.web : [];

  const shape: string[] = [];
  if (web.length || (data && data.web !== undefined)) shape.push(`data.web:${web.length}`);
  if (news.length || (data && data.news !== undefined)) shape.push(`data.news:${news.length}`);
  if (dataArr.length) shape.push(`data[]:${dataArr.length}`);
  if (webTop.length) shape.push(`web[]:${webTop.length}`);
  if (!shape.length) shape.push(`keys:${Object.keys(j).join('|') || 'none'}`);

  return { items: [...web, ...news, ...dataArr, ...webTop], shape };
}

/**
 * Normaliza um convite público do WhatsApp para a forma canônica
 * `https://chat.whatsapp.com/<code>`. Retorna null se não for um convite válido.
 */
export function normalizarInvite(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/chat\.whatsapp\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    return `https://chat.whatsapp.com/${parts[0]}`;
  } catch {
    return null;
  }
}

/**
 * Normaliza o nome de um grupo para deduplicação:
 *  - remove acentos
 *  - lowercase
 *  - troca separadores/pontuação por espaço
 *  - remove tokens ruidosos ("grupo", "whatsapp", "oficial", "wpp", "zap")
 *  - colapsa espaços
 * Retorna null quando o resultado ficar vazio ou muito curto (<3 chars).
 */
export const DEFAULT_TOKENS_RUIDOSOS = [
  'grupo','whatsapp','wpp','zap','oficial','link','convite','entrar','join',
] as const;

export function normalizarNomeGrupo(
  nome: string | null | undefined,
  opts?: { tokens?: readonly string[]; minLength?: number },
): string | null {
  if (!nome) return null;
  const tokens = (opts?.tokens && opts.tokens.length ? opts.tokens : DEFAULT_TOKENS_RUIDOSOS)
    .map((t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ''))
    .filter((t) => t.length > 0);
  const minLength = Math.max(1, Math.min(10, opts?.minLength ?? 3));
  const semAcento = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let base = semAcento.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (tokens.length) {
    const re = new RegExp(`\\b(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
    base = base.replace(re, ' ');
  }
  base = base.replace(/\s+/g, ' ').trim();
  if (base.length < minLength) return null;
  return base;
}

/**
 * Combina parser + normalização e retorna somente os convites válidos únicos,
 * preservando a ordem de aparição.
 */
export function extrairConvites(json: unknown): { invites: string[]; shape: string[]; raw: number } {
  const { items, shape } = parseFirecrawlSearch(json);
  const seen = new Set<string>();
  const invites: string[] = [];
  for (const it of items) {
    const url = it?.url || it?.link;
    if (!url) continue;
    const inv = normalizarInvite(String(url));
    if (!inv) continue;
    if (seen.has(inv)) continue;
    seen.add(inv);
    invites.push(inv);
  }
  return { invites, shape, raw: items.length };
}
