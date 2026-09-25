/**
 * E2E: simula a edge function `avaliacao-imovel` devolvendo erros
 * estruturados de validação para campos ALÉM de `descricao`
 * (preco, area, cidade, bairro, fotos, tipo) — inclusive múltiplos
 * campos inválidos na mesma resposta — e confirma que a checklist
 * "Verificação de Dados Críticos" marca corretamente TODOS os itens
 * ausentes via `getMissingCriticalFields` + `isChecklistItemMissing`.
 *
 * O objetivo é garantir que:
 *  1. O payload de erro do backend (com `fields[]` ou `field` único)
 *     chega ao front-end através do `FunctionsHttpError.context.json()`.
 *  2. A checklist local, ao ser recomputada com o mesmo `imovel` enviado,
 *     bate 1:1 com os `fields` que o backend rejeitou.
 *  3. Nenhuma chave do CHECKLIST_KEYS é falsamente marcada como OK
 *     quando o backend a listou como inválida.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { invokeSpy } = vi.hoisted(() => ({ invokeSpy: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeSpy } },
}));

import { supabase } from "@/integrations/supabase/client";
import { buildAvaliacaoInvokePayload } from "./avaliacaoPayload";
import {
  getMissingCriticalFields,
  isChecklistItemMissing,
  CHECKLIST_KEYS,
  type ChecklistKey,
} from "./avaliacaoCamposCriticos";
import { resolveBackendErrorMessage } from "./avaliacaoErrorMap";

type FieldName = "preco" | "area" | "cidade" | "bairro" | "fotos" | "tipo" | "descricao";

type BackendMultiFieldError = {
  error: string;
  code: "VALIDACAO_CAMPOS";
  fields: Array<{ field: FieldName; code: string; message: string }>;
  correlation_id?: string;
  http_status?: number;
};

/** Mapa fixo: qual chave da CHECKLIST cobre cada `field` do backend. */
const FIELD_TO_CHECKLIST: Record<FieldName, ChecklistKey> = {
  preco: "Preço",
  area: "Área",
  cidade: "Cidade",
  bairro: "Bairro",
  fotos: "Fotos",
  descricao: "Descrição",
  tipo: "Descrição", // "Tipo do Imóvel" não é chave da CHECKLIST_KEYS — irrelevante para checklist
};

function mockEdge400(payload: BackendMultiFieldError) {
  invokeSpy.mockImplementationOnce(async () => {
    const wire = JSON.stringify(payload);
    return {
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        status: 400,
        context: {
          status: 400,
          json: async () => JSON.parse(wire),
        },
      },
    };
  });
}

/** Replica de getFunctionErrorMessage focado em recuperar o payload. */
async function extractPayload(error: any) {
  if (error?.context && typeof error.context.json === "function") {
    try { return await error.context.json(); } catch { return null; }
  }
  return null;
}

function baseImovelValido() {
  return {
    preco: 500000,
    area: 80,
    cidade: "São Paulo",
    bairro: "Vila Mariana",
    fotos: ["foto1.jpg"],
    tipo: "Apartamento",
    descricao: "Apartamento reformado com 3 quartos, varanda e lazer.",
  };
}

async function invokeAvaliacao(imovel: any) {
  const selected = { id: "manual", titulo: "t", ...imovel, descricao: imovel.descricao ?? null };
  return supabase.functions.invoke("avaliacao-imovel", {
    body: buildAvaliacaoInvokePayload(selected as any, [], "corr-multi"),
  });
}

describe("E2E: edge function retorna erros de múltiplos campos → checklist marca todos", () => {
  beforeEach(() => invokeSpy.mockReset());

  it("PREÇO inválido: backend field=preco → checklist marca 'Preço'", async () => {
    const imovel = { ...baseImovelValido(), preco: 0 };
    mockEdge400({
      error: "Preço deve ser maior que zero.",
      code: "VALIDACAO_CAMPOS",
      fields: [{ field: "preco", code: "PRECO_INVALIDO", message: "Preço deve ser maior que zero." }],
      correlation_id: "corr-multi",
      http_status: 400,
    });

    const { error } = await invokeAvaliacao(imovel);
    const payload = await extractPayload(error);

    expect(payload.fields.map((f: any) => f.field)).toEqual(["preco"]);
    const missing = getMissingCriticalFields(imovel);
    expect(isChecklistItemMissing(missing, "Preço")).toBe(true);
    // Demais chaves não devem estar marcadas
    for (const k of CHECKLIST_KEYS.filter((k) => k !== "Preço")) {
      expect(isChecklistItemMissing(missing, k)).toBe(false);
    }
  });

  it("ÁREA inválida (< 5m²): backend field=area → checklist marca 'Área'", async () => {
    const imovel = { ...baseImovelValido(), area: 2 };
    mockEdge400({
      error: "Área muito baixa para gerar avaliação confiável.",
      code: "VALIDACAO_CAMPOS",
      fields: [{ field: "area", code: "AREA_INVALIDA", message: "Área muito baixa." }],
    });

    const { error } = await invokeAvaliacao(imovel);
    const payload = await extractPayload(error);

    expect(payload.fields[0].field).toBe("area");
    const missing = getMissingCriticalFields(imovel);
    expect(isChecklistItemMissing(missing, "Área")).toBe(true);
  });

  it("CIDADE vazia + BAIRRO vazio: backend lista ambos → checklist marca os dois", async () => {
    const imovel = { ...baseImovelValido(), cidade: "", bairro: "" };
    mockEdge400({
      error: "Cidade e bairro são obrigatórios.",
      code: "VALIDACAO_CAMPOS",
      fields: [
        { field: "cidade", code: "CIDADE_OBRIGATORIA", message: "Cidade é obrigatória." },
        { field: "bairro", code: "BAIRRO_OBRIGATORIO", message: "Bairro é obrigatório." },
      ],
    });

    const { error } = await invokeAvaliacao(imovel);
    const payload = await extractPayload(error);

    expect(payload.fields.map((f: any) => f.field).sort()).toEqual(["bairro", "cidade"]);
    const missing = getMissingCriticalFields(imovel);
    expect(isChecklistItemMissing(missing, "Cidade")).toBe(true);
    expect(isChecklistItemMissing(missing, "Bairro")).toBe(true);
    // Demais OK
    expect(isChecklistItemMissing(missing, "Preço")).toBe(false);
    expect(isChecklistItemMissing(missing, "Área")).toBe(false);
    expect(isChecklistItemMissing(missing, "Fotos")).toBe(false);
    expect(isChecklistItemMissing(missing, "Descrição")).toBe(false);
  });

  it("FOTOS vazias: backend field=fotos → checklist marca 'Fotos'", async () => {
    const imovel = { ...baseImovelValido(), fotos: [] };
    mockEdge400({
      error: "Pelo menos uma foto é necessária para o laudo.",
      code: "VALIDACAO_CAMPOS",
      fields: [{ field: "fotos", code: "FOTOS_OBRIGATORIAS", message: "Pelo menos uma foto." }],
    });

    const { error } = await invokeAvaliacao(imovel);
    const payload = await extractPayload(error);

    expect(payload.fields[0].field).toBe("fotos");
    const missing = getMissingCriticalFields(imovel);
    expect(isChecklistItemMissing(missing, "Fotos")).toBe(true);
  });

  it("TIPO ausente: backend field=tipo → getMissingCriticalFields inclui 'Tipo do Imóvel'", async () => {
    const imovel = { ...baseImovelValido(), tipo: undefined };
    mockEdge400({
      error: "Tipo do imóvel é obrigatório.",
      code: "VALIDACAO_CAMPOS",
      fields: [{ field: "tipo", code: "TIPO_OBRIGATORIO", message: "Tipo é obrigatório." }],
    });

    const { error } = await invokeAvaliacao(imovel);
    const payload = await extractPayload(error);

    expect(payload.fields[0].field).toBe("tipo");
    const missing = getMissingCriticalFields(imovel);
    // "Tipo do Imóvel" não é chave da CHECKLIST_KEYS, mas aparece no painel de avisos
    expect(missing).toContain("Tipo do Imóvel");
  });

  it("TODOS os campos inválidos: backend lista 6 fields → checklist marca todos os 6 itens", async () => {
    const imovel = {
      preco: 0,
      area: 0,
      cidade: "",
      bairro: "",
      fotos: [],
      tipo: undefined,
      descricao: "",
    };

    mockEdge400({
      error: "Vários campos obrigatórios estão faltando.",
      code: "VALIDACAO_CAMPOS",
      fields: [
        { field: "preco", code: "PRECO_INVALIDO", message: "Preço obrigatório." },
        { field: "area", code: "AREA_INVALIDA", message: "Área obrigatória." },
        { field: "cidade", code: "CIDADE_OBRIGATORIA", message: "Cidade obrigatória." },
        { field: "bairro", code: "BAIRRO_OBRIGATORIO", message: "Bairro obrigatório." },
        { field: "fotos", code: "FOTOS_OBRIGATORIAS", message: "Fotos obrigatórias." },
        { field: "descricao", code: "DESCRICAO_OBRIGATORIA", message: "Descrição obrigatória." },
      ],
      correlation_id: "corr-multi",
    });

    const { error } = await invokeAvaliacao(imovel);
    const payload = await extractPayload(error);

    // 1. Payload chegou intacto
    expect(payload.fields).toHaveLength(6);
    expect(payload.correlation_id).toBe("corr-multi");

    // 2. Mensagem VERBATIM via resolver
    const msg = resolveBackendErrorMessage(payload, "fallback");
    expect(msg).toBe("Vários campos obrigatórios estão faltando.");

    // 3. Checklist marca TODAS as 6 chaves
    const missing = getMissingCriticalFields(imovel);
    for (const key of CHECKLIST_KEYS) {
      expect(isChecklistItemMissing(missing, key)).toBe(true);
    }
    // 4. Painel também traz "Tipo do Imóvel"
    expect(missing).toContain("Tipo do Imóvel");

    // 5. Paridade explícita backend ↔ checklist: cada `field` retornado do
    //    backend (que tenha chave correspondente na CHECKLIST_KEYS) está marcado.
    for (const f of payload.fields as Array<{ field: FieldName }>) {
      const key = FIELD_TO_CHECKLIST[f.field];
      if ((CHECKLIST_KEYS as readonly string[]).includes(key)) {
        expect(isChecklistItemMissing(missing, key)).toBe(true);
      }
    }
  });

  it("subset (PREÇO + FOTOS + DESCRIÇÃO): checklist marca só os 3, resto OK", async () => {
    const imovel = {
      ...baseImovelValido(),
      preco: 0,
      fotos: [],
      descricao: "curto",
    };

    mockEdge400({
      error: "Preço, fotos e descrição estão inválidos.",
      code: "VALIDACAO_CAMPOS",
      fields: [
        { field: "preco", code: "PRECO_INVALIDO", message: "Preço obrigatório." },
        { field: "fotos", code: "FOTOS_OBRIGATORIAS", message: "Fotos obrigatórias." },
        { field: "descricao", code: "DESCRICAO_ABAIXO_MINIMO", message: "Descrição curta." },
      ],
    });

    const { error } = await invokeAvaliacao(imovel);
    const payload = await extractPayload(error);
    expect(payload.fields).toHaveLength(3);

    const missing = getMissingCriticalFields(imovel);
    const marcados = CHECKLIST_KEYS.filter((k) => isChecklistItemMissing(missing, k));
    expect(marcados.sort()).toEqual(["Descrição", "Fotos", "Preço"]);
  });
});
