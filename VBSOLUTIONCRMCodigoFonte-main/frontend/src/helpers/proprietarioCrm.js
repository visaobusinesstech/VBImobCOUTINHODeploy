/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Constantes e helpers da página de Proprietários (paridade Lovable).
 */

/** Mapa Lovable snake_case → VB camelCase (paridade de inputs). */
export const LOVABLE_TO_VB_FIELD_MAP = {
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
};

export const ESTADOS_CIVIS = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União Estável",
  "Separado(a)",
];

export const CANAIS_ORIGEM_PROP = [
  "Indicação",
  "Porteiro",
  "Placa",
  "Internet",
  "Redes Sociais",
  "Portal Imobiliário",
  "Construtora",
  "Síndico",
  "Outro",
];

export const DADOS_IMOVEL_TIPOS = [
  "Apartamento",
  "Casa",
  "Terreno",
  "Comercial",
  "Cobertura",
];

export const FAMILIAR_RELACOES = [
  "filho",
  "filha",
  "pai",
  "mãe",
  "irmão",
  "irmã",
  "neto",
  "neta",
  "outro",
];

export const PROPRIETARIO_TIPO_LABEL = {
  venda: "Venda",
  aluguel: "Aluguel",
  ambos: "Ambos",
};

export const emptyProprietarioForm = () => ({
  name: "",
  document: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "DF",
  zipCode: "",
  bank: "",
  agency: "",
  account: "",
  pix: "",
  tipo: "ambos",
  notes: "",
  estadoCivil: "",
  canalOrigem: "",
  conjugeNome: "",
  conjugeCpf: "",
  conjugeDataNascimento: "",
  dataNascimento: "",
  dataCasamento: "",
  dataCompraImovel: "",
  contratoAdministracao: false,
  comissaoAcordada: 0,
  exclusividade: false,
  exclusividadeInicio: "",
  exclusividadeFim: "",
  exclusividadeContratoUrl: "",
  saldoDevedor: false,
  parcelaAtrasoFinanciamento: false,
  parcelaAtrasoCondominio: false,
  parcelaAtrasoIptu: false,
  quitado: false,
  averbacao: false,
  dadosImovelEndereco: "",
  dadosImovelTipo: "",
  dadosImovelArea: 0,
  inscricaoIptu: "",
  matricula: "",
  certidaoOnusUrl: "",
});

/** Campos do formulário vazio = todos os inputs persistidos (exceto familiares dinâmicos). */
export const PROPRIETARIO_FORM_FIELD_KEYS = Object.keys(emptyProprietarioForm());

export function isCasadoOuUniao(estadoCivil) {
  return estadoCivil === "Casado(a)" || estadoCivil === "União Estável";
}

export function filterProprietariosByTipo(items, tab) {
  if (tab === "todos") return items || [];
  return (items || []).filter((p) => p.tipo === tab || p.tipo === "ambos");
}

export function rankCaptacaoByCanal(items, tipo) {
  const map = new Map();
  (items || [])
    .filter((p) => p.tipo === tipo || p.tipo === "ambos")
    .forEach((p) => {
      const canal = p.canalOrigem || "Não informado";
      map.set(canal, (map.get(canal) || 0) + 1);
    });
  return Array.from(map.entries())
    .map(([canal, count]) => ({ canal, count }))
    .sort((a, b) => b.count - a.count);
}

export function searchProprietariosMatch(p, query) {
  if (!query || !String(query).trim()) return true;
  const q = String(query)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const norm = (s) =>
    s
      ? String(s)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      : "";
  const digitsQ = String(query).replace(/\D/g, "");
  return (
    norm(p.name).includes(q) ||
    (digitsQ.length > 0 &&
      !!(p.phone && String(p.phone).replace(/\D/g, "").includes(digitsQ))) ||
    norm(p.email).includes(q) ||
    norm(p.document).includes(q) ||
    norm(p.canalOrigem).includes(q) ||
    norm(p.dadosImovelEndereco).includes(q)
  );
}

export function buildOwnerDiligenceQuery(owner) {
  return `${owner?.name || ""} ${owner?.city || ""} consulta jurídica processos notícias`.trim();
}

export function buildOwnerDiligenceSources(query) {
  const q = encodeURIComponent(query || "");
  return [
    { title: "Google — consulta geral", url: `https://www.google.com/search?q=${q}` },
    {
      title: "Google — processos / jurídico",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} processo judicial`)}`,
    },
    { title: "Jusbrasil", url: `https://www.jusbrasil.com.br/busca?q=${q}` },
    {
      title: "Google Notícias",
      url: `https://news.google.com/search?q=${q}&hl=pt-BR`,
    },
  ];
}

export function proprietarioFromApi(item) {
  const base = emptyProprietarioForm();
  if (!item) return { ...base, familiares: [] };
  return {
    ...base,
    name: item.name || "",
    document: item.document || "",
    phone: item.phone || "",
    email: item.email || "",
    address: item.address || "",
    city: item.city || "",
    state: item.state || "DF",
    zipCode: item.zipCode || "",
    bank: item.bank || "",
    agency: item.agency || "",
    account: item.account || "",
    pix: item.pix || "",
    tipo: item.tipo || "ambos",
    notes: item.notes || "",
    estadoCivil: item.estadoCivil || "",
    canalOrigem: item.canalOrigem || "",
    conjugeNome: item.conjugeNome || "",
    conjugeCpf: item.conjugeCpf || "",
    conjugeDataNascimento: item.conjugeDataNascimento || "",
    dataNascimento: item.dataNascimento || "",
    dataCasamento: item.dataCasamento || "",
    dataCompraImovel: item.dataCompraImovel || "",
    contratoAdministracao: !!item.contratoAdministracao,
    comissaoAcordada: Number(item.comissaoAcordada) || 0,
    exclusividade: !!item.exclusividade,
    exclusividadeInicio: item.exclusividadeInicio || "",
    exclusividadeFim: item.exclusividadeFim || "",
    exclusividadeContratoUrl: item.exclusividadeContratoUrl || "",
    saldoDevedor: !!item.saldoDevedor,
    parcelaAtrasoFinanciamento: !!item.parcelaAtrasoFinanciamento,
    parcelaAtrasoCondominio: !!item.parcelaAtrasoCondominio,
    parcelaAtrasoIptu: !!item.parcelaAtrasoIptu,
    quitado: !!item.quitado,
    averbacao: !!item.averbacao,
    dadosImovelEndereco: item.dadosImovelEndereco || "",
    dadosImovelTipo: item.dadosImovelTipo || "",
    dadosImovelArea: Number(item.dadosImovelArea) || 0,
    inscricaoIptu: item.inscricaoIptu || "",
    matricula: item.matricula || "",
    certidaoOnusUrl: item.certidaoOnusUrl || "",
    familiares: (item.familiares || []).map((f) => ({
      id: f.id,
      nome: f.nome || "",
      dataNascimento: f.dataNascimento || "",
      relacao: f.relacao || "filho",
    })),
  };
}

/** Monta payload de save: strings vazias → null; familiares só com nome. */
export function buildProprietarioPayload(form, familiares) {
  const payload = { ...form };
  delete payload.familiares;
  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") payload[key] = null;
  });
  payload.name = form.name;
  payload.tipo = form.tipo || "ambos";
  payload.contratoAdministracao = !!form.contratoAdministracao;
  payload.exclusividade = !!form.exclusividade;
  payload.saldoDevedor = !!form.saldoDevedor;
  payload.parcelaAtrasoFinanciamento = !!form.parcelaAtrasoFinanciamento;
  payload.parcelaAtrasoCondominio = !!form.parcelaAtrasoCondominio;
  payload.parcelaAtrasoIptu = !!form.parcelaAtrasoIptu;
  payload.quitado = !!form.quitado;
  payload.averbacao = !!form.averbacao;
  payload.comissaoAcordada = Number(form.comissaoAcordada) || 0;
  payload.dadosImovelArea = Number(form.dadosImovelArea) || 0;
  payload.familiares = (familiares || [])
    .filter((f) => f.nome && String(f.nome).trim())
    .map((f) => ({
      id: f.id || undefined,
      nome: String(f.nome).trim(),
      dataNascimento: f.dataNascimento || null,
      relacao: f.relacao || "filho",
    }));
  return payload;
}
