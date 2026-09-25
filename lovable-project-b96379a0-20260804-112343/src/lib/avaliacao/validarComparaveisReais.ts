/**
 * Validação automática de comparáveis do laudo de avaliação.
 *
 * Regra: TODO imóvel de referência usado no PDF precisa ter correspondência
 * real na carteira (public.imoveis) ou no mercado (public.imoveis_mercado).
 * Itens sem correspondência (sintéticos/inventados) ou com dados essenciais
 * ausentes são bloqueados antes da geração do laudo.
 */

export type MotivoInvalido =
  | "sem_id"
  | "fonte_invalida"
  | "sem_correspondencia_carteira"
  | "sem_correspondencia_mercado"
  | "dados_incompletos";

export interface ComparavelValidavel {
  id?: string | null;
  titulo?: string | null;
  preco?: number | null;
  area?: number | null;
  fonte?: string | null;
  url_anuncio?: string | null;
}

export interface ComparavelInvalido {
  comparavel: ComparavelValidavel;
  motivo: MotivoInvalido;
  descricao: string;
}

export interface ResultadoValidacaoComparaveis<T = ComparavelValidavel> {
  ok: boolean;
  validos: T[];
  invalidos: ComparavelInvalido[];
  total: number;
  totalValidos: number;
  totalInvalidos: number;
  resumo: string;
}

const DESCRICOES: Record<MotivoInvalido, string> = {
  sem_id: "Comparável sem identificador de origem",
  fonte_invalida: "Fonte desconhecida (esperado carteira ou mercado)",
  sem_correspondencia_carteira: "Não encontrado na carteira de imóveis",
  sem_correspondencia_mercado: "Não encontrado na base de mercado",
  dados_incompletos: "Preço ou área ausente/inválido",
};

export interface OpcoesValidacao {
  /** IDs reais existentes em public.imoveis */
  idsCarteira: Iterable<string>;
  /** IDs reais existentes em public.imoveis_mercado */
  idsMercado: Iterable<string>;
  /** Mínimo de comparáveis válidos para permitir o laudo (default 1) */
  minimoValidos?: number;
}

export function validarComparaveisReais<T extends ComparavelValidavel>(
  comparaveis: T[] | null | undefined,
  { idsCarteira, idsMercado, minimoValidos = 1 }: OpcoesValidacao,
): ResultadoValidacaoComparaveis<T> {
  const carteira = new Set(Array.from(idsCarteira ?? []).map((id) => String(id)));
  const mercado = new Set(Array.from(idsMercado ?? []).map((id) => String(id)));

  const lista = Array.isArray(comparaveis) ? comparaveis : [];
  const validos: T[] = [];
  const invalidos: ComparavelInvalido[] = [];

  const push = (comparavel: T, motivo: MotivoInvalido) =>
    invalidos.push({ comparavel, motivo, descricao: DESCRICOES[motivo] });

  for (const c of lista) {
    const id = c?.id ? String(c.id).trim() : "";
    if (!id) {
      push(c, "sem_id");
      continue;
    }

    const fonte = String(c?.fonte || "").trim().toLowerCase();
    if (fonte !== "carteira" && fonte !== "mercado") {
      push(c, "fonte_invalida");
      continue;
    }

    if (fonte === "carteira" && !carteira.has(id)) {
      push(c, "sem_correspondencia_carteira");
      continue;
    }
    if (fonte === "mercado" && !mercado.has(id)) {
      push(c, "sem_correspondencia_mercado");
      continue;
    }

    const preco = Number(c?.preco) || 0;
    const area = Number(c?.area) || 0;
    if (preco <= 0 || area <= 0) {
      push(c, "dados_incompletos");
      continue;
    }

    validos.push(c);
  }

  const totalValidos = validos.length;
  const totalInvalidos = invalidos.length;
  const ok = totalInvalidos === 0 && totalValidos >= minimoValidos;

  const resumo = ok
    ? `${totalValidos} imóveis de referência validados (carteira + mercado).`
    : totalValidos < minimoValidos
      ? `Nenhum imóvel de referência real disponível (mínimo ${minimoValidos}).`
      : `${totalInvalidos} de ${lista.length} imóveis de referência sem correspondência real.`;

  return {
    ok,
    validos,
    invalidos,
    total: lista.length,
    totalValidos,
    totalInvalidos,
    resumo,
  };
}

/** Agrupa motivos para logs/mensagens ao usuário. */
export function resumirMotivos(invalidos: ComparavelInvalido[]): Record<string, number> {
  return invalidos.reduce<Record<string, number>>((acc, i) => {
    acc[i.motivo] = (acc[i.motivo] || 0) + 1;
    return acc;
  }, {});
}
