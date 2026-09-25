/**
 * Constrói o payload enviado à edge function `avaliacao-imovel`.
 * Extraído em módulo próprio para garantir, via testes, que o campo
 * `descricao` esteja SEMPRE presente em `selectedImovel` (payload.imovel),
 * tanto no modo MANUAL quanto no modo POR LINK — e nunca seja perdido
 * mesmo quando o usuário não digita nada, aproveitando o valor extraído.
 */
import { resolveManualImovelDescricao } from "./avaliacaoDescricao";

export type ManualImovelInput = {
  titulo?: string;
  tipo?: string;
  operacao?: string;
  descricao?: string | null;
  // demais campos são irrelevantes para descricao — mantidos abertos
  [key: string]: unknown;
};

export type DadosExtraidosInput = {
  descricao?: string | null;
  cep?: string | null;
  endereco?: string | null;
  [key: string]: unknown;
} | null;

export type SelectedImovelPayload = {
  id: string;
  titulo: string;
  tipo?: string;
  operacao?: string;
  descricao: string | null;
  [key: string]: unknown;
};

export type AvaliacaoInvokePayload = {
  imovel: SelectedImovelPayload;
  comparaveis: unknown[];
  correlation_id?: string;
};

/**
 * Espelha exatamente a construção de `manualImovel` em `src/pages/Avaliacao.tsx`
 * no que tange à resolução de `descricao`. Demais campos são delegados ao
 * chamador — aqui a garantia é que `descricao` NUNCA sai indefinida.
 */
export function buildManualImovel(
  manual: ManualImovelInput,
  modoLink: boolean,
  dadosExtraidos: DadosExtraidosInput,
): SelectedImovelPayload {
  return {
    id: "manual",
    titulo: manual.titulo || "Imóvel Manual",
    tipo: manual.tipo,
    operacao: manual.operacao,
    descricao: resolveManualImovelDescricao(
      manual.descricao,
      modoLink,
      dadosExtraidos?.descricao,
    ),
  };
}

/**
 * Monta o payload final da chamada `supabase.functions.invoke("avaliacao-imovel", { body })`.
 * Este é o ponto único de verdade usado nos testes para provar que
 * `body.imovel.descricao` está sempre presente (string ou null explícito)
 * e reflete a regra manual/link.
 */
export function buildAvaliacaoInvokePayload(
  selectedImovel: SelectedImovelPayload,
  comparaveis: unknown[],
  correlationId?: string,
): AvaliacaoInvokePayload {
  return {
    imovel: {
      ...selectedImovel,
      // Garante que a chave `descricao` exista sempre no payload (null se ausente).
      descricao: selectedImovel.descricao ?? null,
    },
    comparaveis,
    ...(correlationId ? { correlation_id: correlationId } : {}),
  };
}
