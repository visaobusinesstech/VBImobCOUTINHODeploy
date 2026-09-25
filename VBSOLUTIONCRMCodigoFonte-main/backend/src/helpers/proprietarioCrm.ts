/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Mapeamento e normalização de payload de Proprietário
 * (paridade com lovable ProprietarioFormDialog).
 */

export const PROPRIETARIO_TIPOS = ["venda", "aluguel", "ambos"] as const;

export const ESTADOS_CIVIS = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União Estável",
  "Separado(a)"
] as const;

export const CANAIS_ORIGEM_PROP = [
  "Indicação",
  "Porteiro",
  "Placa",
  "Internet",
  "Redes Sociais",
  "Portal Imobiliário",
  "Construtora",
  "Síndico",
  "Outro"
] as const;

export const DADOS_IMOVEL_TIPOS = [
  "Apartamento",
  "Casa",
  "Terreno",
  "Comercial",
  "Cobertura"
] as const;

export const FAMILIAR_RELACOES = [
  "filho",
  "filha",
  "pai",
  "mãe",
  "irmão",
  "irmã",
  "neto",
  "neta",
  "outro"
] as const;

/** Lovable snake_case → VBSolution camelCase (e campos legados name/document/notes). */
const ALIAS_MAP: Record<string, string> = {
  nome: "name",
  cpf_cnpj: "document",
  telefone: "phone",
  email: "email",
  endereco: "address",
  cidade: "city",
  estado: "state",
  cep: "zipCode",
  banco: "bank",
  agencia: "agency",
  conta: "account",
  pix: "pix",
  tipo: "tipo",
  observacoes: "notes",
  estado_civil: "estadoCivil",
  canal_origem: "canalOrigem",
  conjuge_nome: "conjugeNome",
  conjuge_cpf: "conjugeCpf",
  conjuge_data_nascimento: "conjugeDataNascimento",
  data_nascimento: "dataNascimento",
  data_casamento: "dataCasamento",
  data_compra_imovel: "dataCompraImovel",
  contrato_administracao: "contratoAdministracao",
  comissao_acordada: "comissaoAcordada",
  exclusividade: "exclusividade",
  exclusividade_inicio: "exclusividadeInicio",
  exclusividade_fim: "exclusividadeFim",
  exclusividade_contrato_url: "exclusividadeContratoUrl",
  saldo_devedor: "saldoDevedor",
  parcela_atraso_financiamento: "parcelaAtrasoFinanciamento",
  parcela_atraso_condominio: "parcelaAtrasoCondominio",
  parcela_atraso_iptu: "parcelaAtrasoIptu",
  quitado: "quitado",
  averbacao: "averbacao",
  dados_imovel_endereco: "dadosImovelEndereco",
  dados_imovel_tipo: "dadosImovelTipo",
  dados_imovel_area: "dadosImovelArea",
  inscricao_iptu: "inscricaoIptu",
  matricula: "matricula",
  certidao_onus_url: "certidaoOnusUrl",
  familiares: "familiares"
};

export const PROPRIETARIO_WRITABLE_FIELDS = [
  "name",
  "phone",
  "email",
  "document",
  "notes",
  "address",
  "city",
  "state",
  "zipCode",
  "bank",
  "agency",
  "account",
  "pix",
  "tipo",
  "estadoCivil",
  "canalOrigem",
  "conjugeNome",
  "conjugeCpf",
  "conjugeDataNascimento",
  "dataNascimento",
  "dataCasamento",
  "dataCompraImovel",
  "contratoAdministracao",
  "comissaoAcordada",
  "exclusividade",
  "exclusividadeInicio",
  "exclusividadeFim",
  "exclusividadeContratoUrl",
  "saldoDevedor",
  "parcelaAtrasoFinanciamento",
  "parcelaAtrasoCondominio",
  "parcelaAtrasoIptu",
  "quitado",
  "averbacao",
  "dadosImovelEndereco",
  "dadosImovelTipo",
  "dadosImovelArea",
  "inscricaoIptu",
  "matricula",
  "certidaoOnusUrl"
] as const;

const BOOLEAN_FIELDS = new Set([
  "contratoAdministracao",
  "exclusividade",
  "saldoDevedor",
  "parcelaAtrasoFinanciamento",
  "parcelaAtrasoCondominio",
  "parcelaAtrasoIptu",
  "quitado",
  "averbacao"
]);

const NUMBER_FIELDS = new Set(["comissaoAcordada", "dadosImovelArea"]);

const DATE_FIELDS = new Set([
  "conjugeDataNascimento",
  "dataNascimento",
  "dataCasamento",
  "dataCompraImovel",
  "exclusividadeInicio",
  "exclusividadeFim"
]);

function emptyToNull(value: unknown) {
  if (value === "" || value === undefined) return null;
  return value;
}

function toBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === "" || value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveKey(rawKey: string): string {
  if (ALIAS_MAP[rawKey]) return ALIAS_MAP[rawKey];
  return rawKey;
}

export type FamiliarInput = {
  id?: number | string | null;
  nome?: string | null;
  dataNascimento?: string | null;
  data_nascimento?: string | null;
  relacao?: string | null;
};

/**
 * Aceita payload camelCase (VB) ou snake_case (Lovable) e devolve campos canônicos.
 */
export function normalizeProprietarioPayload(
  body: Record<string, any> = {}
): { data: Record<string, unknown>; familiares: FamiliarInput[] } {
  const flattened: Record<string, any> = {};
  for (const [rawKey, value] of Object.entries(body || {})) {
    if (rawKey === "familiares") continue;
    const key = resolveKey(rawKey);
    if (flattened[key] === undefined) flattened[key] = value;
  }

  const data: Record<string, unknown> = {};
  for (const key of PROPRIETARIO_WRITABLE_FIELDS) {
    if (flattened[key] === undefined) continue;
    let value: unknown = flattened[key];
    if (BOOLEAN_FIELDS.has(key)) {
      value = toBool(value);
    } else if (NUMBER_FIELDS.has(key)) {
      value = toNumber(value, 0);
      if (key === "comissaoAcordada") {
        value = Math.max(0, Math.min(100, value as number));
      }
    } else if (DATE_FIELDS.has(key) || typeof value === "string") {
      value = emptyToNull(value);
    }
    if (key === "tipo") {
      const t = String(value || "ambos").toLowerCase();
      value = (PROPRIETARIO_TIPOS as readonly string[]).includes(t) ? t : "ambos";
    }
    data[key] = value;
  }

  const rawFamiliares = Array.isArray(body?.familiares) ? body.familiares : [];
  const familiares: FamiliarInput[] = rawFamiliares
    .map((f: any) => ({
      id: f?.id ?? null,
      nome: String(f?.nome || "").trim(),
      dataNascimento: emptyToNull(f?.dataNascimento ?? f?.data_nascimento) as string | null,
      relacao: String(f?.relacao || "filho").trim() || "filho"
    }))
    .filter((f: FamiliarInput) => !!f.nome);

  return { data, familiares };
}

/**
 * Mapa 1:1 Lovable (snake_case) → VBSolution (camelCase / legado name|document|notes).
 * Usado para garantir paridade de inputs e testes.
 */
export const LOVABLE_TO_VB_FIELD_MAP: Record<string, string> = { ...ALIAS_MAP };

/** Lista canônica de labels de inputs do formulário (paridade Lovable ProprietarioFormDialog). */
export const PROPRIETARIO_FORM_LABELS = [
  "Nome *",
  "CPF/CNPJ",
  "Tipo",
  "Estado Civil",
  "Canal de Origem",
  "Nome", // cônjuge
  "CPF", // cônjuge
  "Data de Nascimento do Cônjuge",
  "Data de Nascimento",
  "Data de Casamento",
  "Aniversário da Compra do Imóvel",
  "Familiares (filhos, parentes)",
  "Telefone",
  "E-mail",
  "Endereço",
  "CEP",
  "Cidade",
  "Estado",
  "Banco",
  "Agência",
  "Conta",
  "Chave PIX",
  "Contrato de Administração",
  "Exclusividade",
  "Comissão Acordada (%)",
  "Início Exclusividade",
  "Fim Exclusividade",
  "Anexar Contrato de Exclusividade",
  "Endereço do Imóvel",
  "Tipo", // imóvel
  "Área (m²)",
  "Inscrição IPTU",
  "Matrícula",
  "Certidão de Ônus Reais",
  "Tem Saldo Devedor",
  "Quitado",
  "Fez Averbação",
  "Parcela em Atraso (Financiamento)",
  "Parcela em Atraso (Condomínio)",
  "Parcela em Atraso (IPTU)",
  "Observações"
] as const;

/**
 * Detecta possíveis duplicados (mesma regra do Lovable useProprietarios.create).
 * Retorna mensagens; se length > 0 o create deve ser bloqueado.
 */
export function buildDuplicateWarnings(input: {
  document?: unknown;
  phone?: unknown;
  email?: unknown;
  matches: {
    byDocument?: { name?: string | null } | null;
    byPhone?: { name?: string | null } | null;
    byEmail?: { name?: string | null } | null;
  };
}): string[] {
  const warnings: string[] = [];
  const docDigits = String(input.document || "").replace(/\D/g, "");
  const phoneDigits = String(input.phone || "").replace(/\D/g, "");
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (docDigits.length >= 11 && input.matches.byDocument) {
    warnings.push(
      `Já existe "${input.matches.byDocument.name || "outro cadastro"}" com CPF/CNPJ semelhante.`
    );
  }
  if (phoneDigits.length >= 8 && input.matches.byPhone) {
    warnings.push(
      `Já existe "${input.matches.byPhone.name || "outro cadastro"}" com telefone semelhante.`
    );
  }
  if (email && input.matches.byEmail) {
    warnings.push(
      `Já existe "${input.matches.byEmail.name || "outro cadastro"}" com o mesmo e-mail.`
    );
  }
  return warnings;
}

/** Query de diligência do proprietário (paridade Lovable open-owner-research). */
export function buildOwnerDiligenceQuery(owner: {
  name?: string | null;
  city?: string | null;
}): string {
  return `${owner.name || ""} ${owner.city || ""} consulta jurídica processos notícias`.trim();
}

export function buildOwnerDiligenceSources(query: string): Array<{ title: string; url: string }> {
  const q = encodeURIComponent(query || "");
  return [
    { title: "Google — consulta geral", url: `https://www.google.com/search?q=${q}` },
    {
      title: "Google — processos / juridico",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} processo judicial`)}`
    },
    {
      title: "Jusbrasil",
      url: `https://www.jusbrasil.com.br/busca?q=${q}`
    },
    {
      title: "Google Notícias",
      url: `https://news.google.com/search?q=${q}&hl=pt-BR`
    }
  ];
}

export function isCasadoOuUniao(estadoCivil?: string | null): boolean {
  return estadoCivil === "Casado(a)" || estadoCivil === "União Estável";
}

export function filterProprietariosByTipo<T extends { tipo?: string | null }>(
  items: T[],
  tab: "todos" | "venda" | "aluguel"
): T[] {
  if (tab === "todos") return items;
  return items.filter(p => p.tipo === tab || p.tipo === "ambos");
}

export function rankCaptacaoByCanal<T extends { tipo?: string | null; canalOrigem?: string | null }>(
  items: T[],
  tipo: "venda" | "aluguel"
): Array<{ canal: string; count: number }> {
  const map = new Map<string, number>();
  items
    .filter(p => p.tipo === tipo || p.tipo === "ambos")
    .forEach(p => {
      const canal = p.canalOrigem || "Não informado";
      map.set(canal, (map.get(canal) || 0) + 1);
    });
  return Array.from(map.entries())
    .map(([canal, count]) => ({ canal, count }))
    .sort((a, b) => b.count - a.count);
}

export function searchProprietariosMatch(
  p: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    document?: string | null;
    canalOrigem?: string | null;
    dadosImovelEndereco?: string | null;
  },
  query: string
): boolean {
  if (!query.trim()) return true;
  const q = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const norm = (s?: string | null) =>
    s
      ? s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      : "";
  const digitsQ = query.replace(/\D/g, "");
  return (
    norm(p.name).includes(q) ||
    (digitsQ.length > 0 &&
      !!(p.phone && p.phone.replace(/\D/g, "").includes(digitsQ))) ||
    norm(p.email).includes(q) ||
    norm(p.document).includes(q) ||
    norm(p.canalOrigem).includes(q) ||
    norm(p.dadosImovelEndereco).includes(q)
  );
}
