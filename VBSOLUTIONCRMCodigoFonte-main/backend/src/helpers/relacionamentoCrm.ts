/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Helpers de Relacionamento — paridade Lovable (clientes_relacionamento + templates).
 */

/** Lovable snake_case → VB camelCase */
export const LOVABLE_TO_VB_FIELD_MAP: Record<string, string> = {
  nome: "nome",
  telefone: "telefone",
  email: "email",
  aniversario: "aniversario",
  data_casamento: "dataCasamento",
  profissao: "profissao",
  data_profissao: "dataProfissao",
  data_mudanca: "dataMudanca",
  data_compra_imovel: "dataCompraImovel",
  filhos: "filhos",
  observacoes: "observacoes",
  ativo: "ativo"
};

export const RELACIONAMENTO_WRITABLE_FIELDS = [
  "nome",
  "telefone",
  "email",
  "aniversario",
  "dataCasamento",
  "profissao",
  "dataProfissao",
  "dataMudanca",
  "dataCompraImovel",
  "filhos",
  "observacoes",
  "ativo"
] as const;

export const TEMPLATE_TIPOS_VALUES = [
  "aniversario",
  "casamento",
  "profissao",
  "filho_aniversario",
  "mudanca",
  "compra_imovel",
  "reativacao"
] as const;

export type TemplateTipo = (typeof TEMPLATE_TIPOS_VALUES)[number];

export const TEMPLATE_TIPOS = [
  {
    value: "aniversario" as const,
    label: "Aniversário",
    defaultMsg: "Feliz Aniversário, {nome}! Desejamos muitas felicidades e realizações!",
    opcoes: [
      "Feliz Aniversário, {nome}! Desejamos muitas felicidades e realizações!",
      "Parabéns, {nome}! Que este novo ciclo traga muita paz, saúde e conquistas!",
      "Hoje é seu dia, {nome}! Que a vida te reserve sempre o melhor. Felicidades!",
      "{nome}, feliz aniversário! Que seus sonhos se realizem neste novo ano de vida!",
      "Muitas felicidades, {nome}! Que seu dia seja tão especial quanto você merece!"
    ]
  },
  {
    value: "casamento" as const,
    label: "Aniversário de Casamento",
    defaultMsg: "Feliz Aniversário de Casamento, {nome}! Que o amor continue florescendo!",
    opcoes: [
      "Feliz Aniversário de Casamento, {nome}! Que o amor continue florescendo!",
      "Parabéns pelo aniversário de casamento, {nome}! Que a cada ano o amor se renove!",
      "{nome}, feliz bodas! Que a união de vocês continue sendo fonte de alegria e companheirismo!",
      "Hoje é dia de celebrar o amor, {nome}! Feliz aniversário de casamento!",
      "{nome}, que o amor que os uniu continue crescendo a cada dia. Parabéns!"
    ]
  },
  {
    value: "profissao" as const,
    label: "Dia da Profissão",
    defaultMsg: "Feliz Dia do(a) {profissao}, {nome}! Parabéns pela dedicação à sua profissão!",
    opcoes: [
      "Feliz Dia do(a) {profissao}, {nome}! Parabéns pela dedicação à sua profissão!",
      "Parabéns, {nome}! Hoje é o dia do(a) {profissao}. Obrigado por fazer a diferença!",
      "{nome}, feliz Dia do(a) {profissao}! Sua dedicação é inspiradora!",
      "Hoje celebramos os profissionais como você, {nome}! Feliz Dia do(a) {profissao}!",
      "{nome}, parabéns pelo Dia do(a) {profissao}! Continue brilhando na sua carreira!"
    ]
  },
  {
    value: "filho_aniversario" as const,
    label: "Aniversário de Filho",
    defaultMsg:
      "Hoje é aniversário de {filho}! Parabéns, {nome}! Desejamos muitas alegrias em família!",
    opcoes: [
      "Hoje é aniversário de {filho}! Parabéns, {nome}! Desejamos muitas alegrias em família!",
      "Parabéns ao(à) {filho}! {nome}, que esse dia seja de muita festa e alegria!",
      "{nome}, hoje {filho} está de parabéns! Desejamos um dia incrível para toda a família!",
      "Feliz aniversário para {filho}! {nome}, aproveitem muito esse dia especial!",
      "{nome}, que o aniversário de {filho} seja repleto de amor e momentos inesquecíveis!"
    ]
  },
  {
    value: "mudanca" as const,
    label: "Aniversário de Mudança",
    defaultMsg:
      "Parabéns, {nome}! Hoje faz mais um ano no seu lar. Que sua casa continue cheia de boas energias!",
    opcoes: [
      "Parabéns, {nome}! Hoje faz mais um ano no seu lar. Que sua casa continue cheia de boas energias!",
      "{nome}, feliz aniversário de mudança! Esperamos que esteja amando cada momento no seu imóvel!",
      "{nome}, já faz um ano! Que seu lar continue sendo sinônimo de conforto e felicidade!",
      "{nome}, parabéns pelo aniversário da sua mudança! Que venham muitos anos de alegria nesse lar!",
      "{nome}, hoje comemoramos mais um ano no seu imóvel. Que bom poder fazer parte dessa história!"
    ]
  },
  {
    value: "compra_imovel" as const,
    label: "Aniversário de Compra",
    defaultMsg:
      "Parabéns, {nome}! Hoje faz mais um ano da conquista do seu imóvel. Uma grande realização!",
    opcoes: [
      "Parabéns, {nome}! Hoje faz mais um ano da conquista do seu imóvel. Uma grande realização!",
      "{nome}, feliz aniversário da compra do seu imóvel! Que essa conquista continue trazendo alegrias!",
      "{nome}, hoje celebramos mais um ano de uma das maiores conquistas da vida. Parabéns!",
      "{nome}, que orgulho! Mais um ano do seu imóvel próprio. Desejamos muitas bênçãos!",
      "{nome}, parabéns por mais um aniversário da aquisição do seu imóvel. Que venham muitos mais!"
    ]
  },
  {
    value: "reativacao" as const,
    label: "Reativação",
    defaultMsg:
      "Oi, {nome}! Faz um tempo que a gente não conversa. Passei aqui só pra saber como você está e lembrar que, se precisar de algo relacionado ao seu imóvel ou a uma nova oportunidade, estou por perto.",
    opcoes: [
      "Oi, {nome}! Faz um tempo que a gente não conversa. Se surgir qualquer necessidade com o seu imóvel ou um novo projeto, é só me chamar!",
      "{nome}, tudo bem? Passando pra reforçar que continuo à disposição — apareceram oportunidades novas por aqui que talvez te interessem.",
      "{nome}, saudades! Se quiser reavaliar seu imóvel ou receber sugestões novas do mercado, é só responder essa mensagem.",
      "Oi, {nome}! Quanto tempo. Bora colocar em dia o que está acontecendo no mercado imobiliário da sua região? Posso te enviar um panorama rápido.",
      "{nome}, tudo certo? Só um oi carinhoso pra você — sempre que precisar de ajuda com locação, venda ou avaliação, conte comigo!"
    ]
  }
];

export type EventoTipo =
  | "aniversario"
  | "casamento"
  | "profissao"
  | "mudanca"
  | "compra"
  | "filhos";

export const EVENTO_FILTROS: { tipo: EventoTipo; label: string }[] = [
  { tipo: "aniversario", label: "Aniversário" },
  { tipo: "casamento", label: "Casamento" },
  { tipo: "profissao", label: "Profissão" },
  { tipo: "mudanca", label: "Mudança" },
  { tipo: "compra", label: "Compra" },
  { tipo: "filhos", label: "Filhos" }
];

export interface FilhoRelacionamento {
  nome: string;
  dataNascimento: string;
}

export interface ClienteRelacionamentoLike {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  aniversario?: string | null;
  dataCasamento?: string | null;
  profissao?: string | null;
  dataProfissao?: string | null;
  dataMudanca?: string | null;
  dataCompraImovel?: string | null;
  filhos?: FilhoRelacionamento[] | any[];
  observacoes?: string | null;
  ativo?: boolean | null;
}

function emptyToNull(v: any): any {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

function normalizeDateOnly(v: any): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function normalizeFilhos(raw: any): FilhoRelacionamento[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((f: any) => ({
    nome: String(f?.nome ?? "").trim(),
    dataNascimento: normalizeDateOnly(f?.dataNascimento ?? f?.data_nascimento) || ""
  }));
}

/** Aceita body camelCase ou snake_case Lovable. */
export function normalizeClienteRelacionamentoPayload(
  body: Record<string, any>,
  { partial = false }: { partial?: boolean } = {}
): Record<string, any> {
  const src = { ...(body || {}) };
  for (const [snake, camel] of Object.entries(LOVABLE_TO_VB_FIELD_MAP)) {
    if (src[camel] === undefined && src[snake] !== undefined) {
      src[camel] = src[snake];
    }
  }

  const out: Record<string, any> = {};

  if (!partial || src.nome !== undefined) {
    out.nome = String(src.nome || "").trim();
  }
  if (!partial || src.telefone !== undefined) {
    out.telefone = emptyToNull(src.telefone != null ? String(src.telefone).trim() : src.telefone);
  }
  if (!partial || src.email !== undefined) {
    out.email = emptyToNull(
      src.email != null ? String(src.email).trim().toLowerCase() : src.email
    );
  }
  if (!partial || src.aniversario !== undefined) {
    out.aniversario = normalizeDateOnly(src.aniversario);
  }
  if (!partial || src.dataCasamento !== undefined) {
    out.dataCasamento = normalizeDateOnly(src.dataCasamento);
  }
  if (!partial || src.profissao !== undefined) {
    out.profissao = emptyToNull(src.profissao != null ? String(src.profissao).trim() : src.profissao);
  }
  if (!partial || src.dataProfissao !== undefined) {
    out.dataProfissao = normalizeDateOnly(src.dataProfissao);
  }
  if (!partial || src.dataMudanca !== undefined) {
    out.dataMudanca = normalizeDateOnly(src.dataMudanca);
  }
  if (!partial || src.dataCompraImovel !== undefined) {
    out.dataCompraImovel = normalizeDateOnly(src.dataCompraImovel);
  }
  if (!partial || src.filhos !== undefined) {
    out.filhos = normalizeFilhos(src.filhos);
  }
  if (!partial || src.observacoes !== undefined) {
    out.observacoes = emptyToNull(
      src.observacoes != null ? String(src.observacoes).trim() : src.observacoes
    );
  }
  if (src.ativo !== undefined) {
    out.ativo =
      src.ativo === true || src.ativo === "true" || src.ativo === 1 || src.ativo === "1";
  } else if (!partial) {
    out.ativo = true;
  }

  return out;
}

export function digitsOnly(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

export function clienteTemEvento(c: ClienteRelacionamentoLike, tipo: EventoTipo): boolean {
  switch (tipo) {
    case "aniversario":
      return !!c.aniversario;
    case "casamento":
      return !!c.dataCasamento;
    case "profissao":
      return !!c.dataProfissao;
    case "mudanca":
      return !!c.dataMudanca;
    case "compra":
      return !!c.dataCompraImovel;
    case "filhos":
      return Array.isArray(c.filhos) && c.filhos.length > 0;
    default:
      return false;
  }
}

function parseDateParts(dateStr: string | null | undefined): { month: number; day: number } | null {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { month: Number(m[2]) - 1, day: Number(m[3]) };
}

function daysUntilNextAnniversary(dateStr: string | null | undefined, hoje = new Date()): number | null {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;
  const proximo = new Date(hoje.getFullYear(), parts.month, parts.day);
  // zera horas para diferença estável
  const start = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (proximo < start) proximo.setFullYear(proximo.getFullYear() + 1);
  return Math.round((proximo.getTime() - start.getTime()) / 86400000);
}

export function proximoEventoLabel(cliente: ClienteRelacionamentoLike, hoje = new Date()): string {
  const eventos: { label: string; dias: number }[] = [];
  const push = (dateStr: string | null | undefined, label: string) => {
    const dias = daysUntilNextAnniversary(dateStr, hoje);
    if (dias == null) return;
    eventos.push({ label, dias });
  };

  push(cliente.aniversario ?? null, "Aniversário");
  push(cliente.dataCasamento ?? null, "Aniversário de casamento");
  push(
    cliente.dataProfissao ?? null,
    `Dia do(a) ${cliente.profissao || "profissional"}`
  );
  push(cliente.dataMudanca ?? null, "Aniversário de mudança");
  push(cliente.dataCompraImovel ?? null, "Aniversário de compra do imóvel");
  (cliente.filhos || []).forEach((f: any) => {
    push(f.dataNascimento || f.data_nascimento, `Aniversário de ${f.nome || "filho"}`);
  });

  if (eventos.length === 0) return "Sem eventos próximos";
  eventos.sort((a, b) => a.dias - b.dias);
  const e = eventos[0];
  return e.dias === 0 ? `${e.label} é HOJE!` : `${e.label} em ${e.dias} dias`;
}

export function clientesComEventoProximo(
  clientes: ClienteRelacionamentoLike[],
  dias: number,
  hoje = new Date()
): number {
  return clientes.filter(c => {
    if (c.ativo === false) return false;
    const check = (dateStr: string | null | undefined) => {
      const d = daysUntilNextAnniversary(dateStr, hoje);
      return d != null && d >= 0 && d <= dias;
    };
    return (
      check(c.aniversario) ||
      check(c.dataCasamento) ||
      check(c.dataProfissao) ||
      check(c.dataMudanca) ||
      check(c.dataCompraImovel) ||
      (c.filhos || []).some((f: any) => check(f.dataNascimento || f.data_nascimento))
    );
  }).length;
}

export function searchClientesRelacionamentoMatch(
  c: ClienteRelacionamentoLike,
  query: string
): boolean {
  const q = String(query || "")
    .toLowerCase()
    .trim();
  if (!q) return true;
  return (
    String(c.nome || "")
      .toLowerCase()
      .includes(q) ||
    String(c.telefone || "").includes(q) ||
    String(c.email || "")
      .toLowerCase()
      .includes(q) ||
    String(c.profissao || "")
      .toLowerCase()
      .includes(q)
  );
}

export function filterClientesByEventos(
  clientes: ClienteRelacionamentoLike[],
  tipos: EventoTipo[]
): ClienteRelacionamentoLike[] {
  if (!tipos || tipos.length === 0) return clientes;
  return clientes.filter(c => tipos.some(t => clienteTemEvento(c, t)));
}

export function applyTemplateVars(template: string, vars: Record<string, string>): string {
  let result = template || "";
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

export function getDefaultTemplate(tipo: string): string {
  return TEMPLATE_TIPOS.find(t => t.value === tipo)?.defaultMsg || "";
}

export function isValidTemplateTipo(tipo: string): tipo is TemplateTipo {
  return (TEMPLATE_TIPOS_VALUES as readonly string[]).includes(tipo);
}

export function getWhatsAppLink(telefone: string, msg: string): string {
  const num = digitsOnly(telefone);
  return `https://wa.me/55${num}?text=${encodeURIComponent(msg)}`;
}
