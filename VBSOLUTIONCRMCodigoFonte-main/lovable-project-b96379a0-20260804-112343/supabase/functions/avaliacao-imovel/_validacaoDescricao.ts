/**
 * Validação pura de descrição do imóvel para a edge function
 * `avaliacao-imovel`. Extraída em módulo próprio (sem side effects)
 * para permitir testes Deno diretos, sem subir o `serve()`.
 *
 * Regra alinhada 1:1 ao helper do front-end
 * (`src/lib/avaliacao/avaliacaoDescricao.ts::validarDescricaoBackendShape`):
 *  - Normalização NFC + trim antes de contar
 *  - Contagem por code points (Array.from) para não quebrar emojis
 *  - Mínimo 30, máximo 2000 caracteres
 */

export const DESCRICAO_MIN = 30;
export const DESCRICAO_MAX = 2000;

export type DescricaoErroCode =
  | "DESCRICAO_OBRIGATORIA"
  | "DESCRICAO_ABAIXO_MINIMO"
  | "DESCRICAO_ACIMA_MAXIMO";

export type DescricaoErroResponse = {
  error: string;
  code: DescricaoErroCode;
  field: "descricao";
  descricao_length: number;
  descricao_min: number;
  descricao_max: number;
};

/** Retorna o body a serializar em HTTP 400 quando a descrição for inválida, ou `null` se válida. */
export function validarDescricaoImovel(rawDescricao: unknown): DescricaoErroResponse | null {
  const normalized = typeof rawDescricao === "string"
    ? rawDescricao.normalize("NFC").trim()
    : "";
  const len = Array.from(normalized).length;

  const base = {
    field: "descricao" as const,
    descricao_length: len,
    descricao_min: DESCRICAO_MIN,
    descricao_max: DESCRICAO_MAX,
  };

  if (len === 0) {
    return {
      ...base,
      code: "DESCRICAO_OBRIGATORIA",
      error: `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
    };
  }
  if (len < DESCRICAO_MIN) {
    return {
      ...base,
      code: "DESCRICAO_ABAIXO_MINIMO",
      error: `Descrição abaixo do recomendado (${len}/${DESCRICAO_MIN} caracteres mínimos).`,
    };
  }
  if (len > DESCRICAO_MAX) {
    return {
      ...base,
      code: "DESCRICAO_ACIMA_MAXIMO",
      error: `Descrição acima do limite (${len}/${DESCRICAO_MAX} caracteres).`,
    };
  }
  return null;
}
