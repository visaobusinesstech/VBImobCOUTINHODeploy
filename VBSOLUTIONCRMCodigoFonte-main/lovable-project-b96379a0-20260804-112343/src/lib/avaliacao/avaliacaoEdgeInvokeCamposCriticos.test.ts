/**
 * E2E: simula a chamada à edge function `avaliacao-imovel` interceptando
 * `supabase.functions.invoke` e verifica que, quando a `descricao` está
 * inválida (vazia, < 30 ou > 2000 code points), os campos exibidos em
 * "campos que precisam de atenção" (via `getMissingCriticalFields` e
 * `resolveWarningPayloadForDescricao`) retornam corretamente e refletem
 * exatamente o erro que a edge function devolveria.
 *
 * Cobre os DOIS modos:
 *  - MANUAL: usuário digita descrição inválida diretamente.
 *  - POR LINK: descrição extraída é inválida e o manual está vazio.
 *
 * A edge function é mockada para devolver o payload backend
 * (code/field/descricao_length/min/max) exatamente como o backend real
 * responde em HTTP 400. O teste então:
 *   1. Chama `buildAvaliacaoInvokePayload` e simula o invoke.
 *   2. Recupera do body a `descricao` que iria pra rede.
 *   3. Recomputa `getMissingCriticalFields` no `imovel` enviado.
 *   4. Verifica que o item "Descrição do imóvel (...)" aparece com o
 *      mesmo texto do gate de UI e que os `code`s do erro backend
 *      simulado batem com `validarDescricaoBackendShape` do front-end.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { invokeSpy } = vi.hoisted(() => ({
  invokeSpy: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeSpy } },
}));

import { supabase } from "@/integrations/supabase/client";
import {
  buildManualImovel,
  buildAvaliacaoInvokePayload,
} from "./avaliacaoPayload";
import {
  getMissingCriticalFields,
  resolveWarningPayloadForDescricao,
  isChecklistItemMissing,
} from "./avaliacaoCamposCriticos";
import {
  validarDescricaoBackendShape,
  DESCRICAO_MIN,
  DESCRICAO_MAX,
  type DescricaoErroBackend,
} from "./avaliacaoDescricao";

/** Mock da edge function: replica o shape do erro 400 do backend. */
function mockEdge400(err: DescricaoErroBackend) {
  invokeSpy.mockImplementationOnce(async () => ({
    data: null,
    error: {
      message: err.error,
      context: { status: 400, body: err },
    },
  }));
}

function baseImovelValido() {
  return {
    preco: 500000,
    area: 80,
    cidade: "São Paulo",
    bairro: "Vila Mariana",
    fotos: ["foto1.jpg"],
    tipo: "Apartamento",
  };
}

async function invokeAvaliacao(selected: ReturnType<typeof buildManualImovel>) {
  return supabase.functions.invoke("avaliacao-imovel", {
    body: buildAvaliacaoInvokePayload(selected, [], "corr-camposcriticos"),
  });
}

function getInvokeBody() {
  const call = invokeSpy.mock.calls.find(
    (c) => c[0] === "avaliacao-imovel" && c[1] && (c[1] as any).body,
  );
  if (!call) throw new Error("invoke não foi chamado com body");
  return (call[1] as any).body;
}

describe("E2E: campos que precisam de atenção quando descricao é inválida", () => {
  beforeEach(() => invokeSpy.mockReset());

  describe("modo MANUAL", () => {
    it("descricao VAZIA: backend devolve DESCRICAO_OBRIGATORIA e UI lista 'Descrição do imóvel (...)'", async () => {
      const imovelBase = baseImovelValido();
      const selected = buildManualImovel(
        { ...imovelBase, descricao: "" },
        false,
        null,
      );

      mockEdge400({
        error: `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
        code: "DESCRICAO_OBRIGATORIA",
        field: "descricao",
        descricao_length: 0,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
      });

      const { error } = await invokeAvaliacao(selected);
      const body = getInvokeBody();
      const backendErr = (error as any).context.body as DescricaoErroBackend;

      // 1. body.imovel enviado corresponde ao que a UI está avaliando
      const imovelParaChecklist = { ...imovelBase, descricao: body.imovel.descricao };
      const missing = getMissingCriticalFields(imovelParaChecklist);
      const warningPayload = resolveWarningPayloadForDescricao(imovelParaChecklist);

      // 2. "campos que precisam de atenção" inclui Descrição
      const descItem = missing.find((f) => f.startsWith("Descrição"));
      expect(descItem).toBeDefined();
      expect(descItem).toContain("Descrição do imóvel");
      // 3. Checklist do diálogo "Verificação de Dados Críticos" também marca
      expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);
      // 4. Nenhum outro campo crítico faltando (só descrição)
      expect(missing).toHaveLength(1);
      expect(warningPayload).toEqual(missing);

      // 5. Front bate com o backend
      const frontErr = validarDescricaoBackendShape(body.imovel.descricao);
      expect(frontErr?.code).toBe(backendErr.code);
      expect(frontErr?.code).toBe("DESCRICAO_OBRIGATORIA");
      expect(frontErr?.descricao_length).toBe(0);
    });

    it("descricao ABAIXO do mínimo (29 chars): checklist marca Descrição e code bate", async () => {
      const imovelBase = baseImovelValido();
      const desc = "a".repeat(29);
      const selected = buildManualImovel(
        { ...imovelBase, descricao: desc },
        false,
        null,
      );

      mockEdge400({
        error: `Descrição abaixo do recomendado (29/${DESCRICAO_MIN} caracteres mínimos).`,
        code: "DESCRICAO_ABAIXO_MINIMO",
        field: "descricao",
        descricao_length: 29,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
      });

      const { error } = await invokeAvaliacao(selected);
      const body = getInvokeBody();
      const backendErr = (error as any).context.body as DescricaoErroBackend;

      const imovelParaChecklist = { ...imovelBase, descricao: body.imovel.descricao };
      const missing = getMissingCriticalFields(imovelParaChecklist);

      expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);
      const descItem = missing.find((f) => f.startsWith("Descrição"))!;
      expect(descItem).toMatch(/faltam \d+ caractere/);

      const frontErr = validarDescricaoBackendShape(body.imovel.descricao);
      expect(frontErr?.code).toBe(backendErr.code);
      expect(frontErr?.descricao_length).toBe(29);
    });

    it("descricao ACIMA do máximo (2001 chars): checklist marca Descrição e code bate", async () => {
      const imovelBase = baseImovelValido();
      const desc = "b".repeat(2001);
      const selected = buildManualImovel(
        { ...imovelBase, descricao: desc },
        false,
        null,
      );

      mockEdge400({
        error: `Descrição acima do limite (2001/${DESCRICAO_MAX} caracteres).`,
        code: "DESCRICAO_ACIMA_MAXIMO",
        field: "descricao",
        descricao_length: 2001,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
      });

      const { error } = await invokeAvaliacao(selected);
      const body = getInvokeBody();
      const backendErr = (error as any).context.body as DescricaoErroBackend;

      const imovelParaChecklist = { ...imovelBase, descricao: body.imovel.descricao };
      const missing = getMissingCriticalFields(imovelParaChecklist);

      expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);
      const descItem = missing.find((f) => f.startsWith("Descrição"))!;
      expect(descItem).toMatch(/excedeu em \d+ caractere/);

      const frontErr = validarDescricaoBackendShape(body.imovel.descricao);
      expect(frontErr?.code).toBe(backendErr.code);
      expect(frontErr?.descricao_length).toBe(2001);
    });
  });

  describe("modo POR LINK", () => {
    it("extraído VAZIO e manual VAZIO: checklist marca Descrição (DESCRICAO_OBRIGATORIA)", async () => {
      const imovelBase = baseImovelValido();
      const selected = buildManualImovel(
        { ...imovelBase, descricao: "" },
        true,
        { descricao: "" },
      );

      mockEdge400({
        error: `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
        code: "DESCRICAO_OBRIGATORIA",
        field: "descricao",
        descricao_length: 0,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
      });

      const { error } = await invokeAvaliacao(selected);
      const body = getInvokeBody();
      const backendErr = (error as any).context.body as DescricaoErroBackend;

      const imovelParaChecklist = { ...imovelBase, descricao: body.imovel.descricao };
      const missing = getMissingCriticalFields(imovelParaChecklist);
      const warningPayload = resolveWarningPayloadForDescricao(imovelParaChecklist);

      expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);
      expect(warningPayload.some((f) => f.startsWith("Descrição"))).toBe(true);

      const frontErr = validarDescricaoBackendShape(body.imovel.descricao);
      expect(frontErr?.code).toBe(backendErr.code);
      expect(frontErr?.code).toBe("DESCRICAO_OBRIGATORIA");
    });

    it("extraído ABAIXO do mínimo (29 chars) e manual VAZIO: checklist marca Descrição", async () => {
      const imovelBase = baseImovelValido();
      const extraida = "x".repeat(29);
      const selected = buildManualImovel(
        { ...imovelBase, descricao: "" },
        true,
        { descricao: extraida },
      );

      mockEdge400({
        error: `Descrição abaixo do recomendado (29/${DESCRICAO_MIN} caracteres mínimos).`,
        code: "DESCRICAO_ABAIXO_MINIMO",
        field: "descricao",
        descricao_length: 29,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
      });

      const { error } = await invokeAvaliacao(selected);
      const body = getInvokeBody();
      const backendErr = (error as any).context.body as DescricaoErroBackend;

      // No modo POR LINK, o extraído é o que vai ao request
      expect(body.imovel.descricao).toBe(extraida);

      const imovelParaChecklist = { ...imovelBase, descricao: body.imovel.descricao };
      const missing = getMissingCriticalFields(imovelParaChecklist);
      expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);

      const frontErr = validarDescricaoBackendShape(body.imovel.descricao);
      expect(frontErr?.code).toBe(backendErr.code);
      expect(frontErr?.descricao_length).toBe(29);
    });

    it("extraído ACIMA do máximo (2001 chars) e manual VAZIO: checklist marca Descrição", async () => {
      const imovelBase = baseImovelValido();
      const extraida = "y".repeat(2001);
      const selected = buildManualImovel(
        { ...imovelBase, descricao: "" },
        true,
        { descricao: extraida },
      );

      mockEdge400({
        error: `Descrição acima do limite (2001/${DESCRICAO_MAX} caracteres).`,
        code: "DESCRICAO_ACIMA_MAXIMO",
        field: "descricao",
        descricao_length: 2001,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
      });

      const { error } = await invokeAvaliacao(selected);
      const body = getInvokeBody();
      const backendErr = (error as any).context.body as DescricaoErroBackend;

      expect(body.imovel.descricao).toBe(extraida);

      const imovelParaChecklist = { ...imovelBase, descricao: body.imovel.descricao };
      const missing = getMissingCriticalFields(imovelParaChecklist);
      expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);

      const frontErr = validarDescricaoBackendShape(body.imovel.descricao);
      expect(frontErr?.code).toBe(backendErr.code);
      expect(frontErr?.descricao_length).toBe(2001);
    });

    it("MANUAL preenchido inválido vence sobre EXTRAÍDO válido — checklist reflete o manual", async () => {
      const imovelBase = baseImovelValido();
      const manualCurto = "curto"; // 5 chars
      const extraidoValido = "Descrição extraída bem detalhada do anúncio original com muitos detalhes relevantes.";
      const selected = buildManualImovel(
        { ...imovelBase, descricao: manualCurto },
        true,
        { descricao: extraidoValido },
      );

      mockEdge400({
        error: `Descrição abaixo do recomendado (5/${DESCRICAO_MIN} caracteres mínimos).`,
        code: "DESCRICAO_ABAIXO_MINIMO",
        field: "descricao",
        descricao_length: 5,
        descricao_min: DESCRICAO_MIN,
        descricao_max: DESCRICAO_MAX,
      });

      const { error } = await invokeAvaliacao(selected);
      const body = getInvokeBody();
      const backendErr = (error as any).context.body as DescricaoErroBackend;

      expect(body.imovel.descricao).toBe(manualCurto);

      const imovelParaChecklist = { ...imovelBase, descricao: body.imovel.descricao };
      const missing = getMissingCriticalFields(imovelParaChecklist);
      expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);

      const frontErr = validarDescricaoBackendShape(body.imovel.descricao);
      expect(frontErr?.code).toBe(backendErr.code);
      expect(frontErr?.descricao_length).toBe(5);
    });
  });

  it("outros campos críticos coexistem com o item de Descrição no painel", async () => {
    // Faltando fotos + bairro, descrição vazia. Todos devem aparecer.
    const imovelIncompleto = {
      preco: 300000,
      area: 60,
      cidade: "Rio de Janeiro",
      bairro: "",
      fotos: [],
      tipo: "Casa",
    };
    const selected = buildManualImovel(
      { ...imovelIncompleto, descricao: "" },
      false,
      null,
    );

    mockEdge400({
      error: `Descrição do imóvel é obrigatória (mínimo ${DESCRICAO_MIN} caracteres).`,
      code: "DESCRICAO_OBRIGATORIA",
      field: "descricao",
      descricao_length: 0,
      descricao_min: DESCRICAO_MIN,
      descricao_max: DESCRICAO_MAX,
    });

    await invokeAvaliacao(selected);
    const body = getInvokeBody();

    const imovelParaChecklist = { ...imovelIncompleto, descricao: body.imovel.descricao };
    const missing = getMissingCriticalFields(imovelParaChecklist);

    expect(isChecklistItemMissing(missing, "Bairro")).toBe(true);
    expect(isChecklistItemMissing(missing, "Fotos")).toBe(true);
    expect(isChecklistItemMissing(missing, "Descrição")).toBe(true);
    // O item de descrição sempre é o texto integral "Descrição do imóvel (...)"
    const descItem = missing.find((f) => f.startsWith("Descrição"))!;
    expect(descItem).toMatch(/^Descrição do imóvel \(/);
  });
});
