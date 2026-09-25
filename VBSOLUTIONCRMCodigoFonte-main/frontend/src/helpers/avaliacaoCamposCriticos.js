/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Campos críticos — paridade Lovable avaliacaoCamposCriticos.ts
 */
import { validarDescricaoAvaliacao } from "./avaliacaoDescricao";

export function getMissingCriticalFields(imovel) {
  const missing = [];
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

export const CHECKLIST_KEYS = ["Preço", "Área", "Cidade", "Bairro", "Fotos", "Descrição"];

export function isChecklistItemMissing(missing, key) {
  return missing.some((f) => f.startsWith(key));
}

export function resolveWarningPayloadForDescricao(imovel) {
  const missing = getMissingCriticalFields(imovel);
  const vDesc = validarDescricaoAvaliacao(imovel?.descricao || "");
  if (vDesc.valid) return missing;
  return missing.length ? missing : [`Descrição do imóvel (${vDesc.erro})`];
}
