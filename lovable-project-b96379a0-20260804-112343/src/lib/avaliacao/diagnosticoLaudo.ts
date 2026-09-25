/**
 * Diagnóstico do laudo: analisa o payload que será enviado ao gerador de PDF e
 * classifica cada campo como mapeado (com valor) ou descartado (com motivo).
 */

export type CampoStatus = "mapeado" | "descartado";

export interface CampoDiagnostico {
  campo: string;
  rotulo: string;
  grupo: string;
  status: CampoStatus;
  valor?: unknown;
  motivo?: string;
}

export interface ComparavelDiagnostico {
  id: string;
  titulo: string;
  fonte: string;
  preco: number | null;
  area: number | null;
  bairro: string | null;
  url_anuncio?: string | null;
  status: CampoStatus;
  motivo?: string;
}

export interface DiagnosticoLaudo {
  campos: CampoDiagnostico[];
  mapeados: CampoDiagnostico[];
  descartados: CampoDiagnostico[];
  comparaveis: ComparavelDiagnostico[];
  comparaveisSelecao?: Array<{
    id: string;
    titulo: string;
    score: number;
    componentes: {
      area: number;
      pm2: number;
      bairro: number;
    };
    selecionado: boolean;
  }>;
  totais: {
    camposMapeados: number;
    camposDescartados: number;
    comparaveisUsados: number;
    comparaveisDescartados: number;
  };
  payload: Record<string, unknown>;
}

const isVazio = (v: unknown): boolean =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "number" && Number.isNaN(v));

function motivoPadrao(v: unknown): string {
  if (v === null || v === undefined) return "Campo ausente no payload (não retornado pela origem)";
  if (typeof v === "string") return "Texto vazio — descartado do laudo";
  if (Array.isArray(v)) return "Lista vazia — nada a renderizar";
  if (typeof v === "number") return "Valor numérico inválido (NaN)";
  return "Valor vazio";
}

interface Definicao {
  campo: string;
  rotulo: string;
  grupo: string;
  valor: unknown;
  motivo?: string;
}

function classificar(defs: Definicao[]): CampoDiagnostico[] {
  return defs.map((d) =>
    isVazio(d.valor)
      ? {
          campo: d.campo,
          rotulo: d.rotulo,
          grupo: d.grupo,
          status: "descartado" as const,
          motivo: d.motivo || motivoPadrao(d.valor),
        }
      : {
          campo: d.campo,
          rotulo: d.rotulo,
          grupo: d.grupo,
          status: "mapeado" as const,
          valor: d.valor,
        },
  );
}

export interface DiagnosticoInput {
  imovel: Record<string, any> | null | undefined;
  avaliacao: Record<string, any> | null | undefined;
  comparaveis: Array<Record<string, any>> | null | undefined;
  comparaveisDescartados?: Array<{ comparavel?: Record<string, any> | null; motivo?: string; descricao?: string }> | null;
  corretorInfo?: Record<string, any> | null;
  layout?: string;
  brandName?: string;
  logoUrl?: string | null;
  comparaveisSelecao?: Array<{
    id: string;
    titulo: string;
    score: number;
    componentes: {
      area: number;
      pm2: number;
      bairro: number;
    };
    selecionado: boolean;
  }>;
}

export function construirDiagnosticoLaudo(input: DiagnosticoInput): DiagnosticoLaudo {
  const imovel = input.imovel || {};
  const avaliacao = input.avaliacao || {};
  const corretor = input.corretorInfo || {};
  const comparaveis = input.comparaveis || [];
  const descartados = input.comparaveisDescartados || [];

  const campos = classificar([
    { campo: "imovel.titulo", rotulo: "Título", grupo: "Imóvel", valor: imovel.titulo },
    { campo: "imovel.tipo", rotulo: "Tipo", grupo: "Imóvel", valor: imovel.tipo },
    { campo: "imovel.operacao", rotulo: "Operação", grupo: "Imóvel", valor: imovel.operacao },
    { campo: "imovel.endereco", rotulo: "Endereço", grupo: "Imóvel", valor: imovel.endereco },
    { campo: "imovel.bairro", rotulo: "Bairro", grupo: "Imóvel", valor: imovel.bairro },
    { campo: "imovel.cidade", rotulo: "Cidade", grupo: "Imóvel", valor: imovel.cidade },
    { campo: "imovel.area", rotulo: "Área", grupo: "Imóvel", valor: imovel.area },
    { campo: "imovel.quartos", rotulo: "Quartos", grupo: "Imóvel", valor: imovel.quartos },
    { campo: "imovel.banheiros", rotulo: "Banheiros", grupo: "Imóvel", valor: imovel.banheiros },
    { campo: "imovel.vagas", rotulo: "Vagas", grupo: "Imóvel", valor: imovel.vagas },
    { campo: "imovel.valor", rotulo: "Valor anunciado", grupo: "Imóvel", valor: imovel.valor ?? imovel.preco },
    { campo: "imovel.fotos", rotulo: "Fotos", grupo: "Imóvel", valor: imovel.fotos, motivo: "Sem fotos — o laudo será gerado sem galeria" },

    { campo: "avaliacao.valor_estimado", rotulo: "Valor estimado", grupo: "Avaliação", valor: avaliacao.valor_estimado },
    { campo: "avaliacao.valor_minimo", rotulo: "Valor mínimo", grupo: "Avaliação", valor: avaliacao.valor_minimo },
    { campo: "avaliacao.valor_maximo", rotulo: "Valor máximo", grupo: "Avaliação", valor: avaliacao.valor_maximo },
    { campo: "avaliacao.preco_m2_estimado", rotulo: "Preço m² estimado", grupo: "Avaliação", valor: avaliacao.preco_m2_estimado },
    { campo: "avaliacao.preco_m2_regiao", rotulo: "Preço m² região", grupo: "Avaliação", valor: avaliacao.preco_m2_regiao },
    { campo: "avaliacao.confianca", rotulo: "Confiança", grupo: "Avaliação", valor: avaliacao.confianca },
    { campo: "avaliacao.metodologia", rotulo: "Metodologia", grupo: "Avaliação", valor: avaliacao.metodologia },
    { campo: "avaliacao.justificativa", rotulo: "Justificativa", grupo: "Avaliação", valor: avaliacao.justificativa },
    { campo: "avaliacao.analise_investimento", rotulo: "Análise de investimento", grupo: "Avaliação", valor: avaliacao.analise_investimento },
    { campo: "avaliacao.pontos_fortes", rotulo: "Pontos fortes", grupo: "Avaliação", valor: avaliacao.pontos_fortes },
    { campo: "avaliacao.pontos_atencao", rotulo: "Pontos de atenção", grupo: "Avaliação", valor: avaliacao.pontos_atencao },
    { campo: "avaliacao.tendencia_mercado", rotulo: "Tendência de mercado", grupo: "Avaliação", valor: avaliacao.tendencia_mercado },
    { campo: "avaliacao.tempo_venda_estimado", rotulo: "Tempo de venda estimado", grupo: "Avaliação", valor: avaliacao.tempo_venda_estimado },
    { campo: "avaliacao.rentabilidade_percentual", rotulo: "Rentabilidade", grupo: "Avaliação", valor: avaliacao.rentabilidade_percentual },

    { campo: "corretorInfo.nome", rotulo: "Nome/Marca", grupo: "Emissor", valor: corretor.nome ?? input.brandName },
    { campo: "corretorInfo.creci", rotulo: "CRECI", grupo: "Emissor", valor: corretor.creci },
    { campo: "corretorInfo.telefone", rotulo: "Telefone", grupo: "Emissor", valor: corretor.telefone },
    { campo: "corretorInfo.email", rotulo: "E-mail", grupo: "Emissor", valor: corretor.email },
    { campo: "corretorInfo.cnpj", rotulo: "CNPJ", grupo: "Emissor", valor: corretor.cnpj },
    { campo: "logoUrl", rotulo: "Logo", grupo: "Emissor", valor: input.logoUrl },
    { campo: "layout", rotulo: "Layout do PDF", grupo: "Emissor", valor: input.layout },
  ]);

  const comparaveisDiag: ComparavelDiagnostico[] = [
    ...comparaveis.map((c) => ({
      id: String(c.id ?? ""),
      titulo: String(c.titulo ?? "Sem título"),
      fonte: String(c.fonte ?? "—"),
      preco: typeof c.preco === "number" ? c.preco : null,
      area: typeof c.area === "number" ? c.area : null,
      bairro: c.bairro ?? null,
      url_anuncio: c.url_anuncio ?? null,
      status: "mapeado" as const,
    })),
    ...descartados.map((d) => ({
      id: String(d.comparavel?.id ?? ""),
      titulo: String(d.comparavel?.titulo ?? "Sem título"),
      fonte: String(d.comparavel?.fonte ?? "—"),
      preco: typeof d.comparavel?.preco === "number" ? d.comparavel?.preco : null,
      area: typeof d.comparavel?.area === "number" ? d.comparavel?.area : null,
      bairro: d.comparavel?.bairro ?? null,
      url_anuncio: d.comparavel?.url_anuncio ?? null,
      status: "descartado" as const,
      motivo: d.descricao || d.motivo || "Sem correspondência real",
    })),
  ];

  const mapeados = campos.filter((c) => c.status === "mapeado");
  const camposDescartados = campos.filter((c) => c.status === "descartado");

  return {
    campos,
    mapeados,
    descartados: camposDescartados,
    comparaveis: comparaveisDiag,
    comparaveisSelecao: input.comparaveisSelecao,
    totais: {
      camposMapeados: mapeados.length,
      camposDescartados: camposDescartados.length,
      comparaveisUsados: comparaveis.length,
      comparaveisDescartados: descartados.length,
    },
    payload: {
      imovel,
      avaliacao,
      comparaveis,
      comparaveisDescartados: descartados,
      corretorInfo: corretor,
      brandName: input.brandName ?? null,
      logoUrl: input.logoUrl ?? null,
      layout: input.layout ?? null,
    },
  };
}
