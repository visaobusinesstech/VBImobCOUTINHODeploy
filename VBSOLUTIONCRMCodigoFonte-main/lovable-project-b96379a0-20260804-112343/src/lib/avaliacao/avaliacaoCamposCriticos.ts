/**
 * Extraído de `src/pages/Avaliacao.tsx` para permitir testes:
 * lista os campos críticos ausentes/inválidos de um imóvel que precisam
 * de atenção antes de disparar a avaliação.
 *
 * A string retornada para o campo "Descrição do imóvel" é usada em dois
 * lugares na UI:
 *  - Painel "campos que precisam de atenção" (mostra o texto integral)
 *  - Diálogo "Verificação de Dados Críticos" (badge computado por
 *    `f.startsWith("Descrição")`)
 *
 * Por isso, a entrada da descrição SEMPRE começa com "Descrição do imóvel"
 * e embute o erro detalhado entre parênteses.
 */
import { validarDescricaoAvaliacao } from "./avaliacaoDescricao";

export function getMissingCriticalFields(imovel: any): string[] {
  const missing: string[] = [];
  const preco = Number(imovel?.preco);
  const area = Number(imovel?.area);

  if (!imovel?.preco || Number.isNaN(preco) || preco <= 0) {
    missing.push("Preço (valor deve ser maior que zero)");
  }

  if (!imovel?.area || Number.isNaN(area) || area <= 0) {
    missing.push("Área (m² deve ser preenchida)");
  } else if (area < 5) {
    missing.push("Área (valor parece muito baixo)");
  }

  if (!imovel?.cidade?.trim?.()) {
    missing.push("Cidade");
  }

  if (!imovel?.bairro?.trim?.()) {
    missing.push("Bairro (essencial para precisão regional)");
  }

  const fotos = Array.isArray(imovel?.fotos) ? imovel.fotos.filter(Boolean) : [];
  if (fotos.length === 0) {
    missing.push("Fotos (pelo menos uma foto é necessária para o laudo)");
  }

  if (!imovel?.tipo) {
    missing.push("Tipo do Imóvel");
  }

  const vDesc = validarDescricaoAvaliacao(imovel?.descricao || "");
  if (!vDesc.valid && vDesc.erro) {
    missing.push(`Descrição do imóvel (${vDesc.erro})`);
  }

  return missing;
}

/**
 * Reproduz a lógica do diálogo "Verificação de Dados Críticos":
 * cada item é marcado como faltando quando alguma entrada de
 * `missingFieldsAvaliarWarning` começa com sua chave.
 */
export const CHECKLIST_KEYS = ["Preço", "Área", "Cidade", "Bairro", "Fotos", "Descrição"] as const;
export type ChecklistKey = typeof CHECKLIST_KEYS[number];

export function isChecklistItemMissing(
  missing: string[],
  key: ChecklistKey,
): boolean {
  return missing.some((f) => f.startsWith(key));
}

/**
 * Reproduz o gate final antes do `invoke("avaliacao-imovel")` em
 * `handleAvaliar`: quando a descrição é inválida, alimenta
 * `missingFieldsAvaliarWarning` — com fallback para uma lista contendo
 * APENAS a descrição quando nenhum outro campo crítico está faltando.
 */
export function resolveWarningPayloadForDescricao(imovel: any): string[] {
  const missing = getMissingCriticalFields(imovel);
  const vDesc = validarDescricaoAvaliacao(imovel?.descricao || "");
  if (vDesc.valid) return missing;
  return missing.length ? missing : [`Descrição do imóvel (${vDesc.erro})`];
}
