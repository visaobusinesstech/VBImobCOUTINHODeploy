/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Catálogo de variáveis usadas nas mensagens de nutrição (WhatsApp e e-mail).
 */



export const GRUPOS_VARIAVEL = {
  lead: "Lead / cliente",
  imovel: "Imóvel",
  imobiliaria: "Imobiliária",
  data: "Datas",
};

export const VARIAVEIS_NUTRICAO = [
  { chave: "nome", label: "Nome completo", grupo: "lead", exemplo: "Ana Paula Ribeiro" },
  { chave: "primeiro_nome", label: "Primeiro nome", grupo: "lead", exemplo: "Ana" },
  { chave: "telefone", label: "Telefone", grupo: "lead", exemplo: "(61) 99999-1234" },
  { chave: "email", label: "E-mail", grupo: "lead", exemplo: "ana@email.com" },
  { chave: "interesse", label: "Interesse", grupo: "lead", exemplo: "Apartamento 2 quartos na Asa Norte" },
  { chave: "tipo_operacao", label: "Operação", grupo: "lead", exemplo: "Compra" },
  { chave: "tipo_imovel_interesse", label: "Tipo procurado", grupo: "lead", exemplo: "Apartamento" },
  { chave: "bairro_interesse", label: "Bairro de interesse", grupo: "lead", exemplo: "Asa Norte" },
  { chave: "valor_maximo", label: "Orçamento máximo", grupo: "lead", exemplo: "R$ 750.000" },
  { chave: "quartos_minimo", label: "Quartos desejados", grupo: "lead", exemplo: "2" },
  { chave: "vagas_minimo", label: "Vagas desejadas", grupo: "lead", exemplo: "1" },
  { chave: "urgencia", label: "Urgência", grupo: "lead", exemplo: "Alta" },
  { chave: "estagio", label: "Etapa no pipeline", grupo: "lead", exemplo: "Qualificados" },
  { chave: "corretor", label: "Corretor responsável", grupo: "lead", exemplo: "Marina Souza" },

  { chave: "imovel_titulo", label: "Título do imóvel", grupo: "imovel", exemplo: "Apartamento reformado na 210 Norte" },
  { chave: "imovel_tipo", label: "Tipo do imóvel", grupo: "imovel", exemplo: "Apartamento" },
  { chave: "imovel_operacao", label: "Operação do imóvel", grupo: "imovel", exemplo: "Venda" },
  { chave: "imovel_preco", label: "Preço", grupo: "imovel", exemplo: "R$ 720.000" },
  { chave: "imovel_bairro", label: "Bairro", grupo: "imovel", exemplo: "Asa Norte" },
  { chave: "imovel_cidade", label: "Cidade", grupo: "imovel", exemplo: "Brasília" },
  { chave: "imovel_endereco", label: "Endereço", grupo: "imovel", exemplo: "SQN 210, Bloco C" },
  { chave: "imovel_quartos", label: "Quartos", grupo: "imovel", exemplo: "2" },
  { chave: "imovel_suites", label: "Suítes", grupo: "imovel", exemplo: "1" },
  { chave: "imovel_banheiros", label: "Banheiros", grupo: "imovel", exemplo: "2" },
  { chave: "imovel_vagas", label: "Vagas", grupo: "imovel", exemplo: "1" },
  { chave: "imovel_area", label: "Área", grupo: "imovel", exemplo: "78 m²" },
  { chave: "imovel_condominio", label: "Condomínio", grupo: "imovel", exemplo: "R$ 690" },
  { chave: "imovel_iptu", label: "IPTU", grupo: "imovel", exemplo: "R$ 1.200" },
  { chave: "imovel_resumo", label: "Resumo pronto", grupo: "imovel", exemplo: "Apartamento • 2 quartos • 78 m² • Asa Norte • R$ 720.000", descricao: "Linha única com os principais dados" },
  { chave: "imovel_link", label: "Link do anúncio", grupo: "imovel", exemplo: "https://radarimobtech.shop/imovel/123" },

  { chave: "imobiliaria", label: "Nome da imobiliária", grupo: "imobiliaria", exemplo: "Radar Imob" },
  { chave: "imobiliaria_telefone", label: "Telefone da imobiliária", grupo: "imobiliaria", exemplo: "(61) 3333-0000" },
  { chave: "imobiliaria_email", label: "E-mail da imobiliária", grupo: "imobiliaria", exemplo: "contato@radarimob.tech" },
  { chave: "creci", label: "CRECI", grupo: "imobiliaria", exemplo: "CRECI 12345-DF" },

  { chave: "hoje", label: "Data de hoje", grupo: "data", exemplo: "27/07/2026" },
  { chave: "saudacao", label: "Saudação do horário", grupo: "data", exemplo: "Boa tarde" },
];

export const CHAVES_VALIDAS = new Set(VARIAVEIS_NUTRICAO.map((v) => v.chave));

export const brl = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

export function saudacaoAgora(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}


const txt = (v) => (v === null || v === undefined ? "" : String(v));

export function montarContextoNutricao(lead, imovel, config, extras) {
  const nome = txt(lead?.nome);
  const areaImovel = Number(imovel?.area);
  const resumoPartes = [
    txt(imovel?.tipo),
    imovel?.quartos ? `${imovel.quartos} quartos` : "",
    Number.isFinite(areaImovel) && areaImovel > 0 ? `${areaImovel} m²` : "",
    txt(imovel?.bairro),
    brl(imovel?.preco),
  ].filter(Boolean);

  return {
    nome,
    primeiro_nome: nome.split(" ")[0] ?? "",
    telefone: txt(lead?.telefone),
    email: txt(lead?.email),
    interesse: txt(lead?.interesse),
    tipo_operacao: txt(lead?.tipo_operacao),
    tipo_imovel_interesse: txt(lead?.tipo_imovel_interesse),
    bairro_interesse: txt(lead?.bairro_interesse),
    valor_maximo: brl(lead?.valor_maximo) || brl(lead?.valor),
    quartos_minimo: txt(lead?.quartos_minimo),
    vagas_minimo: txt(lead?.vagas_minimo),
    urgencia: txt(lead?.urgencia),
    estagio: txt(lead?.estagio),
    corretor: txt(extras?.corretor),

    imovel_titulo: txt(imovel?.titulo),
    imovel_tipo: txt(imovel?.tipo),
    imovel_operacao: txt(imovel?.operacao),
    imovel_preco: brl(imovel?.preco),
    imovel_bairro: txt(imovel?.bairro),
    imovel_cidade: txt(imovel?.cidade),
    imovel_endereco: txt(imovel?.endereco),
    imovel_quartos: txt(imovel?.quartos),
    imovel_suites: txt(imovel?.suites),
    imovel_banheiros: txt(imovel?.banheiros),
    imovel_vagas: txt(imovel?.vagas),
    imovel_area: Number.isFinite(areaImovel) && areaImovel > 0 ? `${areaImovel} m²` : "",
    imovel_condominio: brl(imovel?.valor_condominio),
    imovel_iptu: brl(imovel?.valor_iptu),
    imovel_resumo: resumoPartes.join(" • "),
    imovel_link: txt(extras?.imovelLink ?? imovel?.url_anuncio),

    imobiliaria: txt(config?.nome_empresa),
    imobiliaria_telefone: txt(config?.telefone),
    imobiliaria_email: txt(config?.email),
    creci: txt(config?.creci),

    hoje: new Date().toLocaleDateString("pt-BR"),
    saudacao: saudacaoAgora(),
  };
}

export const CONTEXTO_EXEMPLO = VARIAVEIS_NUTRICAO.reduce(
  (acc, v) => ({ ...acc, [v.chave]: v.exemplo }),
  {} ,
);

/** Substitui {{chave}} pelo valor do contexto; chaves vazias somem junto com espaços duplicados. */
export function aplicarVariaveis(texto, ctx) {
  return texto
    .replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, key) => ctx[key] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .trimStart();
}

export function variaveisUsadas(texto) {
  const encontradas = [...texto.matchAll(/\{\{\s*([\w]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(encontradas)];
}

export function variaveisDesconhecidas(texto) {
  return variaveisUsadas(texto).filter((v) => !CHAVES_VALIDAS.has(v));
}

export function variaveisSemValor(texto, ctx) {
  return variaveisUsadas(texto).filter((v) => CHAVES_VALIDAS.has(v) && !ctx[v]);
}

/** Blocos rápidos para montar mensagens em um clique. */
export const BLOCOS_MENSAGEM = [
  {
    id: "abertura",
    label: "Abertura personalizada",
    canal: "ambos",
    texto: "{{saudacao}}, {{primeiro_nome}}! Aqui é da {{imobiliaria}}.",
  },
  {
    id: "retomada",
    label: "Retomada de busca",
    canal: "whatsapp",
    texto:
      "Passando para saber se sua busca por {{tipo_imovel_interesse}} em {{bairro_interesse}} continua ativa.",
  },
  {
    id: "oferta-imovel",
    label: "Oferta de imóvel",
    canal: "ambos",
    texto:
      "Separei uma opção que combina com o seu perfil: {{imovel_resumo}}. Fica em {{imovel_endereco}} e tem {{imovel_vagas}} vaga(s).",
  },
  {
    id: "orcamento",
    label: "Encaixe no orçamento",
    canal: "ambos",
    texto:
      "O valor é {{imovel_preco}}, dentro da faixa de até {{valor_maximo}} que combinamos. Condomínio {{imovel_condominio}} e IPTU {{imovel_iptu}}.",
  },
  {
    id: "link",
    label: "Link do anúncio",
    canal: "ambos",
    texto: "Você pode ver todas as fotos aqui: {{imovel_link}}",
  },
  {
    id: "cta-visita",
    label: "Chamada para visita",
    canal: "whatsapp",
    texto: "Consigo agendar uma visita ainda esta semana. Prefere durante a semana ou no sábado?",
  },
  {
    id: "assinatura",
    label: "Assinatura",
    canal: "email",
    texto:
      "\n\nAbraço,\n{{corretor}} — {{imobiliaria}}\n{{imobiliaria_telefone}} • {{imobiliaria_email}}\n{{creci}}",
  },
];
