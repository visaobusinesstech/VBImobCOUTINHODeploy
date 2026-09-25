/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Helpers frontend Relacionamento — paridade Lovable.
 */

export const LOVABLE_TO_VB_FIELD_MAP = {
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
  ativo: "ativo",
};

export const RELACIONAMENTO_FORM_FIELD_KEYS = [
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
];

export const EVENTO_FILTROS = [
  { tipo: "aniversario", label: "Aniversário" },
  { tipo: "casamento", label: "Casamento" },
  { tipo: "profissao", label: "Profissão" },
  { tipo: "mudanca", label: "Mudança" },
  { tipo: "compra", label: "Compra" },
  { tipo: "filhos", label: "Filhos" },
];

export const TEMPLATE_TIPOS = [
  {
    value: "aniversario",
    label: "Aniversário",
    defaultMsg: "Feliz Aniversário, {nome}! Desejamos muitas felicidades e realizações!",
    opcoes: [
      "Feliz Aniversário, {nome}! Desejamos muitas felicidades e realizações!",
      "Parabéns, {nome}! Que este novo ciclo traga muita paz, saúde e conquistas!",
      "Hoje é seu dia, {nome}! Que a vida te reserve sempre o melhor. Felicidades!",
      "{nome}, feliz aniversário! Que seus sonhos se realizem neste novo ano de vida!",
      "Muitas felicidades, {nome}! Que seu dia seja tão especial quanto você merece!",
    ],
  },
  {
    value: "casamento",
    label: "Aniversário de Casamento",
    defaultMsg: "Feliz Aniversário de Casamento, {nome}! Que o amor continue florescendo!",
    opcoes: [
      "Feliz Aniversário de Casamento, {nome}! Que o amor continue florescendo!",
      "Parabéns pelo aniversário de casamento, {nome}! Que a cada ano o amor se renove!",
      "{nome}, feliz bodas! Que a união de vocês continue sendo fonte de alegria e companheirismo!",
      "Hoje é dia de celebrar o amor, {nome}! Feliz aniversário de casamento!",
      "{nome}, que o amor que os uniu continue crescendo a cada dia. Parabéns!",
    ],
  },
  {
    value: "profissao",
    label: "Dia da Profissão",
    defaultMsg: "Feliz Dia do(a) {profissao}, {nome}! Parabéns pela dedicação à sua profissão!",
    opcoes: [
      "Feliz Dia do(a) {profissao}, {nome}! Parabéns pela dedicação à sua profissão!",
      "Parabéns, {nome}! Hoje é o dia do(a) {profissao}. Obrigado por fazer a diferença!",
      "{nome}, feliz Dia do(a) {profissao}! Sua dedicação é inspiradora!",
      "Hoje celebramos os profissionais como você, {nome}! Feliz Dia do(a) {profissao}!",
      "{nome}, parabéns pelo Dia do(a) {profissao}! Continue brilhando na sua carreira!",
    ],
  },
  {
    value: "filho_aniversario",
    label: "Aniversário de Filho",
    defaultMsg:
      "Hoje é aniversário de {filho}! Parabéns, {nome}! Desejamos muitas alegrias em família!",
    opcoes: [
      "Hoje é aniversário de {filho}! Parabéns, {nome}! Desejamos muitas alegrias em família!",
      "Parabéns ao(à) {filho}! {nome}, que esse dia seja de muita festa e alegria!",
      "{nome}, hoje {filho} está de parabéns! Desejamos um dia incrível para toda a família!",
      "Feliz aniversário para {filho}! {nome}, aproveitem muito esse dia especial!",
      "{nome}, que o aniversário de {filho} seja repleto de amor e momentos inesquecíveis!",
    ],
  },
  {
    value: "mudanca",
    label: "Aniversário de Mudança",
    defaultMsg:
      "Parabéns, {nome}! Hoje faz mais um ano no seu lar. Que sua casa continue cheia de boas energias!",
    opcoes: [
      "Parabéns, {nome}! Hoje faz mais um ano no seu lar. Que sua casa continue cheia de boas energias!",
      "{nome}, feliz aniversário de mudança! Esperamos que esteja amando cada momento no seu imóvel!",
      "{nome}, já faz um ano! Que seu lar continue sendo sinônimo de conforto e felicidade!",
      "{nome}, parabéns pelo aniversário da sua mudança! Que venham muitos anos de alegria nesse lar!",
      "{nome}, hoje comemoramos mais um ano no seu imóvel. Que bom poder fazer parte dessa história!",
    ],
  },
  {
    value: "compra_imovel",
    label: "Aniversário de Compra",
    defaultMsg:
      "Parabéns, {nome}! Hoje faz mais um ano da conquista do seu imóvel. Uma grande realização!",
    opcoes: [
      "Parabéns, {nome}! Hoje faz mais um ano da conquista do seu imóvel. Uma grande realização!",
      "{nome}, feliz aniversário da compra do seu imóvel! Que essa conquista continue trazendo alegrias!",
      "{nome}, hoje celebramos mais um ano de uma das maiores conquistas da vida. Parabéns!",
      "{nome}, que orgulho! Mais um ano do seu imóvel próprio. Desejamos muitas bênçãos!",
      "{nome}, parabéns por mais um aniversário da aquisição do seu imóvel. Que venham muitos mais!",
    ],
  },
  {
    value: "reativacao",
    label: "Reativação",
    defaultMsg:
      "Oi, {nome}! Faz um tempo que a gente não conversa. Passei aqui só pra saber como você está e lembrar que, se precisar de algo relacionado ao seu imóvel ou a uma nova oportunidade, estou por perto.",
    opcoes: [
      "Oi, {nome}! Faz um tempo que a gente não conversa. Se surgir qualquer necessidade com o seu imóvel ou um novo projeto, é só me chamar!",
      "{nome}, tudo bem? Passando pra reforçar que continuo à disposição — apareceram oportunidades novas por aqui que talvez te interessem.",
      "{nome}, saudades! Se quiser reavaliar seu imóvel ou receber sugestões novas do mercado, é só responder essa mensagem.",
      "Oi, {nome}! Quanto tempo. Bora colocar em dia o que está acontecendo no mercado imobiliário da sua região? Posso te enviar um panorama rápido.",
      "{nome}, tudo certo? Só um oi carinhoso pra você — sempre que precisar de ajuda com locação, venda ou avaliação, conte comigo!",
    ],
  },
];

export const emptyClienteForm = () => ({
  nome: "",
  telefone: "",
  email: "",
  aniversario: "",
  dataCasamento: "",
  profissao: "",
  dataProfissao: "",
  dataMudanca: "",
  dataCompraImovel: "",
  filhos: [],
  observacoes: "",
});

export const clienteFromApi = (c) => ({
  ...emptyClienteForm(),
  nome: c?.nome || "",
  telefone: c?.telefone || "",
  email: c?.email || "",
  aniversario: c?.aniversario ? String(c.aniversario).slice(0, 10) : "",
  dataCasamento: c?.dataCasamento ? String(c.dataCasamento).slice(0, 10) : "",
  profissao: c?.profissao || "",
  dataProfissao: c?.dataProfissao ? String(c.dataProfissao).slice(0, 10) : "",
  dataMudanca: c?.dataMudanca ? String(c.dataMudanca).slice(0, 10) : "",
  dataCompraImovel: c?.dataCompraImovel ? String(c.dataCompraImovel).slice(0, 10) : "",
  filhos: Array.isArray(c?.filhos)
    ? c.filhos.map((f) => ({
        nome: f?.nome || "",
        dataNascimento: String(f?.dataNascimento || f?.data_nascimento || "").slice(0, 10),
      }))
    : [],
  observacoes: c?.observacoes || "",
  ativo: c?.ativo !== false,
  id: c?.id,
});

export const buildClientePayload = (form) => ({
  nome: String(form.nome || "").trim(),
  telefone: form.telefone || null,
  email: form.email || null,
  aniversario: form.aniversario || null,
  dataCasamento: form.dataCasamento || null,
  profissao: form.profissao || null,
  dataProfissao: form.dataProfissao || null,
  dataMudanca: form.dataMudanca || null,
  dataCompraImovel: form.dataCompraImovel || null,
  filhos: Array.isArray(form.filhos)
    ? form.filhos.map((f) => ({
        nome: f?.nome || "",
        dataNascimento: f?.dataNascimento || "",
      }))
    : [],
  observacoes: form.observacoes || null,
});

export const clienteTemEvento = (c, tipo) => {
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
};

const daysUntil = (dateStr, hoje = new Date()) => {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const start = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const proximo = new Date(hoje.getFullYear(), Number(m[2]) - 1, Number(m[3]));
  if (proximo < start) proximo.setFullYear(proximo.getFullYear() + 1);
  return Math.round((proximo.getTime() - start.getTime()) / 86400000);
};

export const proximoEvento = (cliente, hoje = new Date()) => {
  const eventos = [];
  const push = (dateStr, label) => {
    const dias = daysUntil(dateStr, hoje);
    if (dias == null) return;
    eventos.push({ label, dias });
  };
  push(cliente.aniversario, "Aniversário");
  push(cliente.dataCasamento, "Aniversário de casamento");
  push(cliente.dataProfissao, `Dia do(a) ${cliente.profissao || "profissional"}`);
  push(cliente.dataMudanca, "Aniversário de mudança");
  push(cliente.dataCompraImovel, "Aniversário de compra do imóvel");
  (cliente.filhos || []).forEach((f) =>
    push(f.dataNascimento || f.data_nascimento, `Aniversário de ${f.nome || "filho"}`)
  );
  if (!eventos.length) return "Sem eventos próximos";
  eventos.sort((a, b) => a.dias - b.dias);
  const e = eventos[0];
  return e.dias === 0 ? `${e.label} é HOJE!` : `${e.label} em ${e.dias} dias`;
};

export const clientesComEventoProximo = (clientes, dias, hoje = new Date()) =>
  clientes.filter((c) => {
    if (c.ativo === false) return false;
    const check = (dateStr) => {
      const d = daysUntil(dateStr, hoje);
      return d != null && d >= 0 && d <= dias;
    };
    return (
      check(c.aniversario) ||
      check(c.dataCasamento) ||
      check(c.dataProfissao) ||
      check(c.dataMudanca) ||
      check(c.dataCompraImovel) ||
      (c.filhos || []).some((f) => check(f.dataNascimento || f.data_nascimento))
    );
  }).length;

export const searchClientesMatch = (c, query) => {
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
};

export const filterByEventos = (clientes, tipos) => {
  if (!tipos || !tipos.length) return clientes;
  return clientes.filter((c) => tipos.some((t) => clienteTemEvento(c, t)));
};

export const applyTemplateVars = (template, vars) => {
  let result = template || "";
  Object.entries(vars || {}).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  });
  return result;
};

export const getDefaultTemplate = (tipo) =>
  TEMPLATE_TIPOS.find((t) => t.value === tipo)?.defaultMsg || "";

export const getWhatsAppLink = (telefone, msg) => {
  const num = String(telefone || "").replace(/\D/g, "");
  return `https://wa.me/55${num}?text=${encodeURIComponent(msg || "")}`;
};

export const formatFilhoDate = (dateStr) => {
  if (!dateStr) return "";
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
};

export const initials = (nome) =>
  String(nome || "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
