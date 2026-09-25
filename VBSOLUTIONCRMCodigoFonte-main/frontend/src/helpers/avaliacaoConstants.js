/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Constantes / estado vazio — paridade Lovable Avaliacao.tsx + SasAvaliacaoForm
 */

export const TIPOS_MANUAL = [
  "Apartamento",
  "Casa",
  "Terreno",
  "Comercial",
  "Cobertura",
  "Kitnet",
  "Sala",
  "Loja",
  "Galpão",
  "Prédio",
];

export const TIPOS_LINK = [...TIPOS_MANUAL, "Sobrado"];

export const TIPOS_SAS = [
  "Casa",
  "Apartamento",
  "Cobertura",
  "Terreno",
  "Loja",
  "Sala Comercial",
  "Galpão",
  "Fazenda",
];

export const TIPOS_WIZARD = [
  "Apartamento",
  "Casa",
  "Cobertura",
  "Studio",
  "Kitnet",
  "Terreno",
  "Sala Comercial",
  "Loja",
  "Galpão",
  "Fazenda",
];

export const OPERACOES_MANUAL = ["Venda", "Aluguel"];
export const OPERACOES_SAS = ["Venda", "Locação", "Venda e Locação"];
export const FINALIDADES_WIZARD = [
  "Venda",
  "Locação",
  "Avaliação Judicial",
  "Garantia Bancária",
  "Inventário",
  "Reavaliação",
];
export const CONSERVACOES = ["Novo", "Excelente", "Bom", "Regular", "Necessita reforma"];
export const PADROES = ["Alto Luxo", "Alto", "Médio Alto", "Médio", "Médio Baixo", "Simples"];
export const POSICAO_SOLAR_SAS = ["Nascente", "Poente", "Norte", "Sul"];

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
export const PHOTO_MAX_BYTES = 20 * 1024 * 1024;

export const createEmptyManualState = () => ({
  titulo: "",
  tipo: "Apartamento",
  operacao: "Venda",
  area: "",
  quartos: "",
  suites: "",
  banheiros: "",
  vagas: "",
  bairro: "",
  cidade: "",
  estado: "DF",
  cep: "",
  endereco: "",
  proprietario: "",
  data_avaliacao: "",
  latitude: "",
  longitude: "",
  lavabos: "",
  ano_construcao: "",
  estado_conservacao: "",
  valor_taxa_extra: "",
  taxa_extra_descricao: "",
  elevador: false,
  vista_livre: false,
  vista_permanente: false,
  mobiliado: false,
  reformado: false,
  preco: "",
  valor_condominio: "",
  valor_iptu: "",
  andar: "",
  posicao_solar: "",
  exclusivo: false,
  aceita_permuta: false,
  aceita_financiamento: false,
  tem_escritura: false,
  corretor_nome: "",
  corretor_creci: "",
  link_imovel: "",
  fotos_url: "",
  descricao: "",
});

export const createEmptySasState = () => ({
  codigo: "",
  proprietario: "",
  corretor_nome: "",
  corretor_creci: "",
  data_avaliacao: new Date().toISOString().slice(0, 10),
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "DF",
  latitude: "",
  longitude: "",
  tipo: "Apartamento",
  operacao: "Venda",
  area_privativa: "",
  area_comum: "",
  area_construida: "",
  area_util: "",
  area_total: "",
  area_terreno: "",
  quartos: "",
  suites: "",
  banheiros: "",
  lavabos: "",
  vagas: "",
  andar: "",
  elevador: false,
  posicao_solar: "",
  vista_livre: false,
  vista_permanente: false,
  mobiliado: false,
  reformado: false,
  ano_construcao: "",
  estado_conservacao: "Bom",
  preco: "",
  valor_condominio: "",
  valor_taxa_extra: "",
  taxa_extra_descricao: "",
  valor_iptu: "",
  descricao: "",
});

export const createEmptyWizardState = () => ({
  imovel: {
    tipo: "Apartamento",
    finalidade: "Venda",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "DF",
    cep: "",
    latitude: "",
    longitude: "",
    area_terreno: "",
    area_construida: "",
    idade: "",
    estado_conservacao: "Bom",
    padrao_construtivo: "Médio",
    quartos: "",
    suites: "",
    banheiros: "",
    garagens: "",
    area_lazer: "",
    caracteristicas: "",
  },
  comparaveis: [],
  fatores: {},
});

export const FATORES_DEFAULT = {
  localizacao: 1,
  area: 1,
  conservacao: 1,
  padrao: 1,
  idade: 1,
  garagem: 1,
  infraestrutura: 1,
  vista: 1,
  liquidez: 1,
  outros: 1,
};

export const FATORES_LABELS = {
  localizacao: "Localização",
  area: "Área",
  conservacao: "Conservação",
  padrao: "Padrão",
  idade: "Idade",
  garagem: "Garagem",
  infraestrutura: "Infraestrutura",
  vista: "Vista",
  liquidez: "Liquidez",
  outros: "Outros",
};

export function mapSasToManual(data) {
  const area =
    data.area_privativa || data.area_construida || data.area_total || data.area_terreno;
  return {
    ...createEmptyManualState(),
    titulo: data.codigo
      ? `${data.tipo} ${data.codigo}`
      : `${data.tipo} em ${data.bairro}`,
    tipo: data.tipo,
    operacao:
      String(data.operacao || "").includes("Locação") &&
      !String(data.operacao || "").includes("Venda")
        ? "Aluguel"
        : "Venda",
    area,
    quartos: data.quartos,
    suites: data.suites,
    banheiros: data.banheiros,
    vagas: data.vagas,
    bairro: data.bairro,
    cidade: data.cidade,
    estado: data.estado,
    preco: data.preco,
    valor_condominio: data.valor_condominio,
    valor_iptu: data.valor_iptu,
    andar: data.andar,
    posicao_solar: data.posicao_solar,
    corretor_nome: data.corretor_nome,
    corretor_creci: data.corretor_creci,
    cep: data.cep,
    endereco: [data.endereco, data.numero, data.complemento].filter(Boolean).join(", "),
    proprietario: data.proprietario,
    data_avaliacao: data.data_avaliacao,
    latitude: data.latitude,
    longitude: data.longitude,
    lavabos: data.lavabos,
    ano_construcao: data.ano_construcao,
    estado_conservacao: data.estado_conservacao,
    valor_taxa_extra: data.valor_taxa_extra,
    taxa_extra_descricao: data.taxa_extra_descricao,
    elevador: data.elevador,
    vista_livre: data.vista_livre,
    vista_permanente: data.vista_permanente,
    mobiliado: data.mobiliado,
    reformado: data.reformado,
    descricao: data.descricao,
  };
}
