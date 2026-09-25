/**
 * Testes de integração do bloqueio por descrição fora do limite:
 * verificam que a textarea de descrição recebe `focus()` e
 * `scrollIntoView({ behavior: "smooth", block: "center" })` nos dois
 * modos de avaliação (MANUAL e POR LINK).
 *
 * Simula o comportamento exato do `handleAvaliar` em `src/pages/Avaliacao.tsx`:
 *   1. Resolve `selectedImovel.descricao` via `buildManualImovel` (modo manual x link)
 *   2. Roda `validarDescricaoAvaliacao` como gate
 *   3. Se inválido, dispara `focusDescricaoTextarea()` — exatamente o que a página faz
 *
 * Cobre os 3 estados inválidos: vazio, abaixo do mínimo (29) e acima do máximo (2001).
 */
/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validarDescricaoAvaliacao,
  focusDescricaoTextarea,
  DESCRICAO_TEXTAREA_ID,
  DESCRICAO_MIN,
  DESCRICAO_MAX,
} from "./avaliacaoDescricao";
import { buildManualImovel } from "./avaliacaoPayload";

type Modo = "manual" | "link";

function montarTextarea(): { textarea: HTMLTextAreaElement; scrollSpy: ReturnType<typeof vi.fn> } {
  document.body.innerHTML = "";
  const textarea = document.createElement("textarea");
  textarea.id = DESCRICAO_TEXTAREA_ID;
  document.body.appendChild(textarea);
  // jsdom não implementa scrollIntoView — instalamos um spy explícito.
  const scrollSpy = vi.fn();
  (textarea as any).scrollIntoView = scrollSpy;
  return { textarea, scrollSpy };
}

async function simularHandleAvaliar(
  modo: Modo,
  manualDescricao: string,
  dadosExtraidosDescricao: string | null = null,
) {
  const modoLink = modo === "link";
  const selected = buildManualImovel(
    { descricao: manualDescricao },
    modoLink,
    modoLink ? { descricao: dadosExtraidosDescricao } : null,
  );
  const validation = validarDescricaoAvaliacao((selected as any)?.descricao || "");
  let focused = false;
  if (!validation.valid) {
    focused = await focusDescricaoTextarea(0);
  }
  return { selected, validation, focused };
}

const abaixoMin = "a".repeat(DESCRICAO_MIN - 1);
const acimaMax = "a".repeat(DESCRICAO_MAX + 1);

describe("Integração: bloqueio de envio → focus + scrollIntoView na textarea de descrição", () => {
  beforeEach(() => {
    montarTextarea();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  const cenarios: Array<{ nome: string; texto: string; extraido?: string | null }> = [
    { nome: "descrição vazia", texto: "" },
    { nome: "descrição só com espaços", texto: "   \n\t   " },
    { nome: "descrição abaixo do mínimo (29 chars)", texto: abaixoMin },
    { nome: "descrição acima do máximo (2001 chars)", texto: acimaMax },
  ];

  describe("MODO MANUAL", () => {
    for (const c of cenarios) {
      it(`foca e faz scrollIntoView na textarea quando ${c.nome}`, async () => {
        const textarea = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement;
        const scrollSpy = (textarea as any).scrollIntoView as ReturnType<typeof vi.fn>;
        const focusSpy = vi.spyOn(textarea, "focus");

        const { validation, focused } = await simularHandleAvaliar("manual", c.texto);

        expect(validation.valid).toBe(false);
        expect(focused).toBe(true);
        expect(document.activeElement).toBe(textarea);
        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
        expect(scrollSpy).toHaveBeenCalledTimes(1);
        expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
      });
    }
  });

  describe("MODO POR LINK", () => {
    for (const c of cenarios) {
      it(`foca e faz scrollIntoView na textarea quando ${c.nome} (sem descrição extraída)`, async () => {
        const textarea = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement;
        const scrollSpy = (textarea as any).scrollIntoView as ReturnType<typeof vi.fn>;
        const focusSpy = vi.spyOn(textarea, "focus");

        const { validation, focused } = await simularHandleAvaliar("link", c.texto, null);

        expect(validation.valid).toBe(false);
        expect(focused).toBe(true);
        expect(document.activeElement).toBe(textarea);
        expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
        expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
      });
    }

    it("foca a textarea quando o usuário não digitou e a descrição extraída está abaixo do mínimo", async () => {
      const textarea = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement;
      const focusSpy = vi.spyOn(textarea, "focus");
      const scrollSpy = (textarea as any).scrollIntoView as ReturnType<typeof vi.fn>;

      const { validation, focused } = await simularHandleAvaliar("link", "", abaixoMin);

      expect(validation.valid).toBe(false);
      expect(focused).toBe(true);
      expect(focusSpy).toHaveBeenCalled();
      expect(scrollSpy).toHaveBeenCalled();
    });

    it("foca a textarea quando o usuário não digitou e a descrição extraída excede o máximo", async () => {
      const textarea = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement;
      const focusSpy = vi.spyOn(textarea, "focus");
      const scrollSpy = (textarea as any).scrollIntoView as ReturnType<typeof vi.fn>;

      const { validation, focused } = await simularHandleAvaliar("link", "", acimaMax);

      expect(validation.valid).toBe(false);
      expect(focused).toBe(true);
      expect(focusSpy).toHaveBeenCalled();
      expect(scrollSpy).toHaveBeenCalled();
    });
  });

  describe("caso positivo (não deve focar)", () => {
    it("NÃO chama focus/scrollIntoView quando a descrição é válida (modo manual)", async () => {
      const textarea = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement;
      const focusSpy = vi.spyOn(textarea, "focus");
      const scrollSpy = (textarea as any).scrollIntoView as ReturnType<typeof vi.fn>;

      const { validation, focused } = await simularHandleAvaliar("manual", "a".repeat(DESCRICAO_MIN));

      expect(validation.valid).toBe(true);
      expect(focused).toBe(false);
      expect(focusSpy).not.toHaveBeenCalled();
      expect(scrollSpy).not.toHaveBeenCalled();
    });

    it("NÃO chama focus/scrollIntoView quando o extraído é válido no modo link", async () => {
      const textarea = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement;
      const focusSpy = vi.spyOn(textarea, "focus");
      const scrollSpy = (textarea as any).scrollIntoView as ReturnType<typeof vi.fn>;

      const { focused } = await simularHandleAvaliar("link", "", "b".repeat(120));

      expect(focused).toBe(false);
      expect(focusSpy).not.toHaveBeenCalled();
      expect(scrollSpy).not.toHaveBeenCalled();
    });
  });

  describe("robustez do helper focusDescricaoTextarea", () => {
    it("retorna false quando a textarea não está montada (sem quebrar)", async () => {
      document.body.innerHTML = "";
      const ok = await focusDescricaoTextarea(0);
      expect(ok).toBe(false);
    });

    it("não quebra quando scrollIntoView do jsdom lança erro", async () => {
      const textarea = document.getElementById(DESCRICAO_TEXTAREA_ID) as HTMLTextAreaElement;
      (textarea as any).scrollIntoView = () => {
        throw new Error("jsdom não suporta scrollIntoView");
      };
      const focusSpy = vi.spyOn(textarea, "focus");
      const ok = await focusDescricaoTextarea(0);
      expect(ok).toBe(true);
      expect(focusSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(textarea);
    });
  });
});
