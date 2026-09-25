/**
 * Testes para o contador de caracteres e aplicação de limites (mín/máx)
 * ao digitar rapidamente. Simula o ciclo real do onChange:
 *
 *   const next = truncarDescricao(e.target.value);
 *   setManual({ ...manual, descricao: next });
 *
 * Verifica que:
 *  1. O contador (contarDescricao/formatarContador) sempre reflete o valor
 *     efetivo do estado após o truncamento — nunca o input bruto.
 *  2. O limite máximo (2000 code points) é aplicado de forma idempotente:
 *     digitar/colar acima do limite converge para exatamente MAX chars.
 *  3. Transições rápidas ao redor do mínimo (30) e do máximo (2000)
 *     produzem estados consistentes (valid → invalid → valid…).
 *  4. Colagens gigantes (10× o limite) não corrompem o estado nem quebram
 *     surrogates/acentos NFC.
 */
import { describe, it, expect } from "vitest";
import {
  truncarDescricao,
  contarDescricao,
  contadorEmAlerta,
  formatarContador,
  validarDescricaoAvaliacao,
  DESCRICAO_MIN,
  DESCRICAO_MAX,
  DESCRICAO_LIMITE_ALERTA,
} from "./avaliacaoDescricao";

/** Simula um ciclo onChange do textarea (truncamento + atualização de estado). */
function digitar(prev: string, chunk: string): string {
  return truncarDescricao(prev + chunk);
}

/** Simula N onChanges consecutivos (digitação rápida char por char). */
function digitarRapido(inicial: string, texto: string): string[] {
  const snapshots: string[] = [];
  let state = inicial;
  for (const cp of Array.from(texto)) {
    state = digitar(state, cp);
    snapshots.push(state);
  }
  return snapshots;
}

describe("Contador de caracteres — sincronizado com o estado após truncamento", () => {
  it("contarDescricao(state) === Array.from(state).length em cada tecla digitada", () => {
    const snapshots = digitarRapido("", "a".repeat(DESCRICAO_MAX + 200));
    for (const s of snapshots) {
      expect(contarDescricao(s)).toBe(Array.from(s).length);
    }
  });

  it("formatarContador reflete o estado (não o input bruto) após colar excesso", () => {
    const bruto = "a".repeat(DESCRICAO_MAX + 999);
    const state = truncarDescricao(bruto);
    expect(state.length).toBeLessThanOrEqual(bruto.length);
    expect(contarDescricao(state)).toBe(DESCRICAO_MAX);
    expect(formatarContador(state)).toBe(`${DESCRICAO_MAX}/${DESCRICAO_MAX}`);
  });

  it("contador avança monotonicamente enquanto abaixo do limite (digitação rápida)", () => {
    const snapshots = digitarRapido("", "b".repeat(DESCRICAO_MIN + 20));
    for (let i = 1; i < snapshots.length; i++) {
      const anterior = contarDescricao(snapshots[i - 1]);
      const atual = contarDescricao(snapshots[i]);
      expect(atual - anterior).toBe(1);
    }
    expect(contarDescricao(snapshots[snapshots.length - 1])).toBe(DESCRICAO_MIN + 20);
  });

  it("contador congela no MAX quando digitação rápida ultrapassa o limite", () => {
    // Começa próximo ao teto e digita 50 chars extras rapidamente.
    let state = "x".repeat(DESCRICAO_MAX - 3);
    const extras = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"; // 50
    const contagens: number[] = [];
    for (const c of extras) {
      state = digitar(state, c);
      contagens.push(contarDescricao(state));
    }
    // Cresce por 3, depois congela em MAX
    expect(contagens.slice(0, 3)).toEqual([DESCRICAO_MAX - 2, DESCRICAO_MAX - 1, DESCRICAO_MAX]);
    for (const n of contagens.slice(3)) expect(n).toBe(DESCRICAO_MAX);
    expect(contarDescricao(state)).toBe(DESCRICAO_MAX);
  });

  it("truncar é idempotente — reaplicar em uma colagem gigante não muda o resultado", () => {
    const gigante = "z".repeat(DESCRICAO_MAX * 10);
    const t1 = truncarDescricao(gigante);
    const t2 = truncarDescricao(t1);
    const t3 = truncarDescricao(t2);
    expect(t1).toBe(t2);
    expect(t2).toBe(t3);
    expect(contarDescricao(t1)).toBe(DESCRICAO_MAX);
  });

  it("emojis (surrogate pairs) não corrompem o contador em digitação rápida", () => {
    // 🏠 é 1 code point mas 2 code units UTF-16 — o contador conta code points.
    const emoji = "🏠";
    const state = digitarRapido("", emoji.repeat(DESCRICAO_MAX + 5)).pop()!;
    expect(contarDescricao(state)).toBe(DESCRICAO_MAX);
    // Nenhum surrogate órfão: reconstrução por Array.from bate com o comprimento contado.
    expect(Array.from(state).length).toBe(DESCRICAO_MAX);
    expect(Array.from(state).every((c) => c === emoji)).toBe(true);
  });
});

describe("Alerta visual do contador (>1800)", () => {
  it("não alerta enquanto o contador está <= LIMITE_ALERTA", () => {
    const state = "a".repeat(DESCRICAO_LIMITE_ALERTA);
    expect(contadorEmAlerta(state)).toBe(false);
  });

  it("alerta assim que passa de LIMITE_ALERTA na digitação char-a-char", () => {
    let state = "a".repeat(DESCRICAO_LIMITE_ALERTA);
    expect(contadorEmAlerta(state)).toBe(false);
    state = digitar(state, "a");
    expect(contarDescricao(state)).toBe(DESCRICAO_LIMITE_ALERTA + 1);
    expect(contadorEmAlerta(state)).toBe(true);
  });

  it("permanece em alerta até o MAX (mesmo com digitação rápida além do limite)", () => {
    let state = "a".repeat(DESCRICAO_LIMITE_ALERTA + 1);
    for (let i = 0; i < 500; i++) {
      state = digitar(state, "a");
      expect(contadorEmAlerta(state)).toBe(true);
      expect(contarDescricao(state)).toBeLessThanOrEqual(DESCRICAO_MAX);
    }
    expect(contarDescricao(state)).toBe(DESCRICAO_MAX);
  });
});

describe("Consistência de validação nas transições de limite", () => {
  it("digitação rápida de 0→MIN alterna invalid → valid exatamente na tecla MIN", () => {
    let state = "";
    const results: boolean[] = [];
    for (let i = 0; i < DESCRICAO_MIN + 2; i++) {
      state = digitar(state, "a");
      results.push(validarDescricaoAvaliacao(state).valid);
    }
    // Índice 0 = 1 char; índice MIN-1 = MIN chars (primeiro válido).
    expect(results.slice(0, DESCRICAO_MIN - 1).every((v) => v === false)).toBe(true);
    expect(results[DESCRICAO_MIN - 1]).toBe(true);
    expect(results[DESCRICAO_MIN]).toBe(true);
  });

  it("digitação rápida próxima do MAX nunca vira invalid por excesso (truncamento aplica primeiro)", () => {
    let state = "a".repeat(DESCRICAO_MAX - 5);
    for (let i = 0; i < 200; i++) {
      state = digitar(state, "a");
      const v = validarDescricaoAvaliacao(state);
      expect(v.valid).toBe(true);
      expect(contarDescricao(state)).toBeLessThanOrEqual(DESCRICAO_MAX);
    }
  });

  it("apagar chars após saturar o MAX volta o contador corretamente (idempotência reversa)", () => {
    let state = truncarDescricao("a".repeat(DESCRICAO_MAX + 500));
    expect(contarDescricao(state)).toBe(DESCRICAO_MAX);
    // Remove 100 chars simulando backspace rápido.
    for (let i = 0; i < 100; i++) state = truncarDescricao(state.slice(0, -1));
    expect(contarDescricao(state)).toBe(DESCRICAO_MAX - 100);
    expect(validarDescricaoAvaliacao(state).valid).toBe(true);
  });

  it("colar exatamente MAX chars → contador = MAX e validação = valid", () => {
    const state = truncarDescricao("a".repeat(DESCRICAO_MAX));
    expect(contarDescricao(state)).toBe(DESCRICAO_MAX);
    expect(formatarContador(state)).toBe(`${DESCRICAO_MAX}/${DESCRICAO_MAX}`);
    expect(validarDescricaoAvaliacao(state).valid).toBe(true);
  });

  it("colar MAX+1 chars → estado saturado em MAX e validação = valid (truncou antes de validar)", () => {
    const state = truncarDescricao("a".repeat(DESCRICAO_MAX + 1));
    expect(contarDescricao(state)).toBe(DESCRICAO_MAX);
    expect(validarDescricaoAvaliacao(state).valid).toBe(true);
  });

  it("simulação combinada: digitar → apagar → colar mantém estado sempre dentro dos limites", () => {
    let state = "";
    // Digita até 25 (invalid)
    for (let i = 0; i < 25; i++) state = digitar(state, "a");
    expect(validarDescricaoAvaliacao(state).valid).toBe(false);
    // Cola texto grande — trunca em MAX
    state = truncarDescricao(state + "b".repeat(DESCRICAO_MAX * 3));
    expect(contarDescricao(state)).toBe(DESCRICAO_MAX);
    expect(validarDescricaoAvaliacao(state).valid).toBe(true);
    // Apaga tudo
    state = truncarDescricao("");
    expect(contarDescricao(state)).toBe(0);
    expect(formatarContador(state)).toBe(`0/${DESCRICAO_MAX}`);
    expect(validarDescricaoAvaliacao(state).valid).toBe(false);
  });
});
