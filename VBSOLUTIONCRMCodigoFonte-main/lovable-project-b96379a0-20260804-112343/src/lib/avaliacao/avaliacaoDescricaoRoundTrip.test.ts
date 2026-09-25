import { describe, it, expect } from "vitest";
import {
  resolveManualImovelDescricao,
  descricaoParaPersistencia,
  descricaoParaFormulario,
  truncarDescricao,
  DESCRICAO_MAX,
} from "./avaliacaoDescricao";

/**
 * Verificação automatizada: o campo `descricao` deve percorrer o ciclo
 * completo (digitar → payload da API → persistência em avaliacoes_historico →
 * recarga do histórico → payload novamente) preservando o conteúdo
 * em TODAS as rotas de avaliação: MANUAL e POR LINK.
 *
 * Simulamos o fluxo real de src/pages/Avaliacao.tsx:
 *  1. Usuário digita/cola texto na textarea         → truncarDescricao (onChange)
 *  2. Componente monta manualImovel                 → resolveManualImovelDescricao
 *  3. handleSalvar/handleUpdateHistorico            → descricaoParaPersistencia
 *  4. Item retornado do banco                       → descricaoParaFormulario
 *  5. handleLoadFromHistorico repovoa manual.descricao e reabre o fluxo
 */

/** Wrapper que representa "o que a API/DB recebe" para a coluna descricao. */
function salvarNoBanco(selectedImovelDescricao: string | null) {
  return descricaoParaPersistencia(selectedImovelDescricao);
}

/** Wrapper que representa "o que a textarea recebe" ao reabrir do histórico. */
function recarregarDoBanco(itemDescricao: string | null) {
  return descricaoParaFormulario(itemDescricao);
}

/** Executa o ciclo completo save→reload→save e devolve os artefatos. */
function rodarCicloCompleto(params: {
  textoDigitado: string;
  modoLink: boolean;
  dadosExtraidosDescricao: string | null;
}) {
  // 1. Simula onChange da textarea
  const estadoManual = truncarDescricao(params.textoDigitado);

  // 2. Monta manualImovel (o que vai no payload da edge function)
  const payloadEdge = resolveManualImovelDescricao(
    estadoManual,
    params.modoLink,
    params.dadosExtraidosDescricao,
  );

  // 3. Salva no banco (o que vira coluna descricao em avaliacoes_historico)
  const salvo = salvarNoBanco(payloadEdge);

  // 4. Recarrega o item — simula o SELECT de volta e o repovoamento da textarea
  const textareaAoReabrir = recarregarDoBanco(salvo);

  // 5. Após reabrir, o usuário salva de novo sem alterar → deve continuar igual
  const payloadEdgeReabrindo = resolveManualImovelDescricao(
    textareaAoReabrir,
    params.modoLink,
    params.dadosExtraidosDescricao,
  );
  const salvoReabrindo = salvarNoBanco(payloadEdgeReabrindo);

  return { estadoManual, payloadEdge, salvo, textareaAoReabrir, salvoReabrindo };
}

describe("Avaliacao > descricao round-trip (save/reload)", () => {
  describe("MODO MANUAL (sem link)", () => {
    it("preserva texto simples do usuário no ciclo completo", () => {
      const r = rodarCicloCompleto({
        textoDigitado: "Cobertura duplex, 4 suítes, vista mar, reformada em 2024.",
        modoLink: false,
        dadosExtraidosDescricao: null,
      });
      const esperado = "Cobertura duplex, 4 suítes, vista mar, reformada em 2024.";
      expect(r.payloadEdge).toBe(esperado);
      expect(r.salvo).toBe(esperado);
      expect(r.textareaAoReabrir).toBe(esperado);
      expect(r.salvoReabrindo).toBe(esperado);
    });

    it("normaliza acentos NFD → NFC de forma estável (idempotente)", () => {
      const r = rodarCicloCompleto({
        textoDigitado: "a\u0301pto reformado com \u00e1rea de lazer completa e vista privilegiada",
        modoLink: false,
        dadosExtraidosDescricao: null,
      });
      // Após 1 volta, já deve estar em NFC e permanecer imutável
      expect(r.salvo).toBe(r.salvoReabrindo);
      expect(r.textareaAoReabrir).toBe(r.estadoManual);
    });

    it("descrição vazia salva null e recarrega string vazia (não quebra a textarea)", () => {
      const r = rodarCicloCompleto({
        textoDigitado: "",
        modoLink: false,
        dadosExtraidosDescricao: null,
      });
      expect(r.payloadEdge).toBeNull();
      expect(r.salvo).toBeNull();
      expect(r.textareaAoReabrir).toBe("");
      expect(r.salvoReabrindo).toBeNull();
    });

    it("descrição com apenas espaços NÃO é persistida (vira null)", () => {
      const r = rodarCicloCompleto({
        textoDigitado: "     \n\t   ",
        modoLink: false,
        dadosExtraidosDescricao: null,
      });
      expect(r.salvo).toBeNull();
      expect(r.textareaAoReabrir).toBe("");
    });

    it("colagem gigante é truncada e o round-trip permanece dentro do limite", () => {
      const r = rodarCicloCompleto({
        textoDigitado: "áéíóú".repeat(2000),
        modoLink: false,
        dadosExtraidosDescricao: null,
      });
      expect(Array.from(r.salvo ?? "").length).toBe(DESCRICAO_MAX);
      expect(r.textareaAoReabrir.length).toBeGreaterThan(0);
      expect(r.salvoReabrindo).toBe(r.salvo);
    });
  });

  describe("MODO POR LINK", () => {
    it("usa descrição extraída do portal quando o corretor não digita nada", () => {
      const extraida = "Apto amplo, 3 quartos, 2 vagas, condomínio com lazer completo.";
      const r = rodarCicloCompleto({
        textoDigitado: "",
        modoLink: true,
        dadosExtraidosDescricao: extraida,
      });
      expect(r.payloadEdge).toBe(extraida);
      expect(r.salvo).toBe(extraida);
      expect(r.textareaAoReabrir).toBe(extraida);
      expect(r.salvoReabrindo).toBe(extraida);
    });

    it("texto manual do corretor sobrescreve a extraída e persiste no round-trip", () => {
      const r = rodarCicloCompleto({
        textoDigitado: "Descrição personalizada pelo corretor com mais detalhes técnicos.",
        modoLink: true,
        dadosExtraidosDescricao: "Descrição original do portal, mais curta.",
      });
      const esperado = "Descrição personalizada pelo corretor com mais detalhes técnicos.";
      expect(r.payloadEdge).toBe(esperado);
      expect(r.salvo).toBe(esperado);
      expect(r.textareaAoReabrir).toBe(esperado);
      expect(r.salvoReabrindo).toBe(esperado);
    });

    it("sem descrição manual nem extraída: salva null e recarrega vazio", () => {
      const r = rodarCicloCompleto({
        textoDigitado: "",
        modoLink: true,
        dadosExtraidosDescricao: null,
      });
      expect(r.payloadEdge).toBeNull();
      expect(r.salvo).toBeNull();
      expect(r.textareaAoReabrir).toBe("");
    });

    it("depois de reabrir, a descrição carregada preserva precedência sobre a extraída", () => {
      const extraida = "Extraída original";
      const r = rodarCicloCompleto({
        textoDigitado: "Manual do corretor",
        modoLink: true,
        dadosExtraidosDescricao: extraida,
      });
      // Ao reabrir, textarea já vem preenchida → precedência do manual continua valendo
      expect(r.salvoReabrindo).toBe("Manual do corretor");
      // E não deve NUNCA regredir para a extraída
      expect(r.salvoReabrindo).not.toBe(extraida);
    });
  });

  describe("Idempotência: N ciclos consecutivos não mutam o conteúdo", () => {
    it("modo manual: 5 ciclos consecutivos produzem o mesmo valor", () => {
      let atual: string | null = truncarDescricao(
        "Imóvel com áreas amplas, pé-direito alto e acabamento premium.",
      );
      let salvoAnterior: string | null = null;
      for (let i = 0; i < 5; i++) {
        const payload = resolveManualImovelDescricao(atual as string, false, null);
        const salvo = descricaoParaPersistencia(payload);
        if (salvoAnterior !== null) expect(salvo).toBe(salvoAnterior);
        salvoAnterior = salvo;
        atual = descricaoParaFormulario(salvo);
      }
    });

    it("modo por link: 5 ciclos consecutivos produzem o mesmo valor", () => {
      let atual: string = descricaoParaFormulario("Descrição extraída rica do portal.");
      let salvoAnterior: string | null = null;
      for (let i = 0; i < 5; i++) {
        const payload = resolveManualImovelDescricao(atual, true, "IGNORADA - manual tem precedência");
        const salvo = descricaoParaPersistencia(payload);
        if (salvoAnterior !== null) expect(salvo).toBe(salvoAnterior);
        salvoAnterior = salvo;
        atual = descricaoParaFormulario(salvo);
      }
    });
  });
});
