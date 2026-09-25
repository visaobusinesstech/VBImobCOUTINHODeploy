/** Validação e normalização de links de anúncios usados como referência no laudo. */

export interface ResultadoLinkReferencia {
  ok: boolean;
  url?: string;
  /** Chave canônica para detecção de duplicidade (host + caminho + query relevante). */
  chave?: string;
  erro?: string;
}

const PARAMS_RASTREIO = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "gclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "igshid", "ref", "referrer",
  "origem", "origin", "source", "campaign", "_ga", "_gl", "s_cid",
];

const HOSTS_BLOQUEADOS = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

/** Normaliza um link colado: adiciona https, remove rastreio, normaliza host e barra final. */
export function normalizarLinkReferencia(entrada: string): ResultadoLinkReferencia {
  const bruto = (entrada || "").trim().replace(/\s+/g, "");
  if (!bruto) return { ok: false, erro: "Cole o link do anúncio." };
  if (bruto.length > 2048) return { ok: false, erro: "Link muito longo (máximo de 2048 caracteres)." };

  const comProtocolo = /^https?:\/\//i.test(bruto)
    ? bruto
    : /^[a-z][a-z0-9+.-]*:/i.test(bruto)
      ? bruto
      : `https://${bruto}`;

  let u: URL;
  try {
    u = new URL(comProtocolo);
  } catch {
    return { ok: false, erro: "Link inválido. Use um endereço completo, como https://site.com/anuncio." };
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, erro: "Somente links http ou https são aceitos." };
  }

  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || HOSTS_BLOQUEADOS.includes(host)) {
    return { ok: false, erro: "Informe o link público do anúncio (domínio inválido)." };
  }

  u.protocol = "https:";
  u.hostname = host.replace(/^www\./, "");
  u.hash = "";
  u.port = "";
  PARAMS_RASTREIO.forEach((p) => u.searchParams.delete(p));
  u.searchParams.sort();
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");

  const url = u.toString();
  const chave = `${u.hostname}${u.pathname.toLowerCase()}${u.search}`;
  return { ok: true, url, chave };
}

/** Chave canônica de um link já salvo, para comparação de duplicidade. */
export function chaveLinkReferencia(url?: string | null): string | null {
  if (!url) return null;
  const r = normalizarLinkReferencia(url);
  return r.ok ? r.chave! : null;
}

/** Valida um link novo contra os links já adicionados. */
export function validarLinkReferencia(
  entrada: string,
  existentes: (string | null | undefined)[],
): ResultadoLinkReferencia {
  const r = normalizarLinkReferencia(entrada);
  if (!r.ok) return r;
  const chaves = new Set(existentes.map(chaveLinkReferencia).filter(Boolean) as string[]);
  if (chaves.has(r.chave!)) {
    return { ok: false, erro: "Este anúncio já foi adicionado como referência." };
  }
  return r;
}

export interface LoteLinksResultado {
  validos: string[];
  invalidos: { entrada: string; erro: string }[];
}

/** Processa um texto com vários links (um por linha), validando e removendo duplicados. */
export function processarLoteLinksReferencia(
  texto: string,
  existentes: (string | null | undefined)[] = [],
): LoteLinksResultado {
  const linhas = (texto || "")
    .split(/[\r\n,;\s]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const validos: string[] = [];
  const invalidos: { entrada: string; erro: string }[] = [];
  const vistos = new Set(
    (existentes.map(chaveLinkReferencia).filter(Boolean) as string[]),
  );

  linhas.forEach((linha) => {
    const r = normalizarLinkReferencia(linha);
    if (!r.ok) {
      invalidos.push({ entrada: linha, erro: r.erro || "Link inválido." });
      return;
    }
    if (vistos.has(r.chave!)) {
      invalidos.push({ entrada: linha, erro: "Link duplicado (já adicionado ou repetido na lista)." });
      return;
    }
    vistos.add(r.chave!);
    validos.push(r.url!);
  });

  return { validos, invalidos };
}
