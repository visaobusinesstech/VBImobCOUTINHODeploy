/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Helpers de descrição — paridade Lovable avaliacaoDescricao.ts
 */

export const DESCRICAO_MIN = 30;
export const DESCRICAO_MAX = 2000;
export const DESCRICAO_LIMITE_ALERTA = 1800;
export const DESCRICAO_TEXTAREA_ID = "avaliacao-descricao-textarea";

function normalizar(txt) {
  const s = txt ?? "";
  try {
    return s.normalize("NFC");
  } catch {
    return s;
  }
}

function toCodePoints(txt) {
  return Array.from(txt);
}

export function contarDescricao(txt) {
  return toCodePoints(normalizar(txt)).length;
}

export function truncarDescricao(next) {
  const normalized = normalizar(next);
  const cps = toCodePoints(normalized);
  if (cps.length <= DESCRICAO_MAX) return normalized;
  return cps.slice(0, DESCRICAO_MAX).join("");
}

export function contadorEmAlerta(txt) {
  return contarDescricao(txt) > DESCRICAO_LIMITE_ALERTA;
}

export function formatarContador(txt) {
  return `${contarDescricao(txt)}/${DESCRICAO_MAX}`;
}

export function validarDescricaoAvaliacao(txt) {
  const normalizado = normalizar(txt);
  const trimmed = normalizado.trim();
  const len = toCodePoints(trimmed).length;
  if (len === 0) {
    return {
      valid: false,
      erro: `Descrição do imóvel é obrigatória — faltam ${DESCRICAO_MIN} caracteres para atingir o mínimo (0/${DESCRICAO_MIN}).`,
    };
  }
  if (len < DESCRICAO_MIN) {
    const faltam = DESCRICAO_MIN - len;
    return {
      valid: false,
      erro: `Descrição abaixo do recomendado — faltam ${faltam} ${
        faltam === 1 ? "caractere" : "caracteres"
      } para atingir o mínimo (${len}/${DESCRICAO_MIN} caracteres mínimos).`,
    };
  }
  if (len > DESCRICAO_MAX) {
    const excedeu = len - DESCRICAO_MAX;
    return {
      valid: false,
      erro: `Descrição acima do limite — excedeu em ${excedeu} ${
        excedeu === 1 ? "caractere" : "caracteres"
      } o máximo permitido (${len}/${DESCRICAO_MAX} caracteres).`,
    };
  }
  return { valid: true, erro: null };
}

export function validarDescricaoBackendShape(txt) {
  const normalizado = normalizar(txt);
  const trimmed = normalizado.trim();
  const len = toCodePoints(trimmed).length;
  const base = {
    field: "descricao",
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

export function resolveManualImovelDescricao(manualDescricao, modoLink, dadosExtraidosDescricao) {
  const manualTrim = normalizar(manualDescricao).trim();
  if (manualTrim.length > 0) return manualTrim;
  if (modoLink) return dadosExtraidosDescricao ?? null;
  return null;
}

export function descricaoParaPersistencia(descricao) {
  const t = normalizar(descricao).trim();
  return t.length > 0 ? t : null;
}

export function descricaoParaFormulario(descricao) {
  return normalizar(descricao);
}

export function focusDescricaoTextarea(delayMs = 50) {
  return new Promise((resolve) => {
    const run = () => {
      if (typeof document === "undefined") return resolve(false);
      const el = document.getElementById(DESCRICAO_TEXTAREA_ID);
      if (!el) return resolve(false);
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* ignore */
      }
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
      resolve(true);
    };
    if (delayMs > 0) setTimeout(run, delayMs);
    else run();
  });
}
