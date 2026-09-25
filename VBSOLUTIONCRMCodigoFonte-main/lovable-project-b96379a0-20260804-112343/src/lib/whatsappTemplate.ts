export interface TemplateVariable {
  key: string;
  label: string;
  exemplo?: string;
}

export const DEFAULT_TEMPLATE_BODY = `{{saudacao}} Sou corretor(a) parceiro(a) e vi o seu anúncio ({{descricao}}).

Link de referência: {{url_anuncio}}

Tenho interesse real em conversar sobre ele. Posso te ligar ou seguimos por aqui mesmo?`;

export const DEFAULT_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "saudacao", label: "Saudação", exemplo: "Olá, João!" },
  { key: "descricao", label: "Descrição do imóvel", exemplo: "Apto 2 quartos · Asa Norte · Brasília" },
  { key: "url_anuncio", label: "Link do anúncio", exemplo: "https://exemplo.com/anuncio/123" },
];

/** Renders a template body replacing {{key}} placeholders with the provided values. */
export function renderTemplate(body: string, values: Record<string, string>): string {
  if (!body) return "";
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = values[key];
    return v == null ? "" : String(v);
  });
}

/** Sanitizes a key so it fits the {{key}} placeholder syntax. */
export function normalizeVariableKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
