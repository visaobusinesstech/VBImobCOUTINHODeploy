/**
 * E2E: simula a chamada à edge function `avaliacao-imovel` interceptando
 * `supabase.functions.invoke` e verifica que `selectedImovel.descricao`
 * chega INTACTA no corpo da requisição, tanto no modo MANUAL quanto no
 * modo POR LINK.
 *
 * A verificação inclui:
 *  - Serialização JSON e reidratação (equivalente ao que a rede faz),
 *    garantindo que emojis / acentos / quebras de linha não sejam corrompidos.
 *  - Ambos os caminhos de precedência (manual sobrescreve; extraído entra
 *    quando manual está vazio no modo link).
 *  - Presença explícita da chave `descricao` (nunca `undefined`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do client Supabase ANTES do import que o consome (hoisted).
const { invokeSpy } = vi.hoisted(() => ({
  invokeSpy: vi.fn(async (...args: any[]) => {
    // Defensivo: alguns caminhos internos podem chamar o spy sem args em cleanup.
    const opts = (args[1] ?? {}) as { body?: unknown };
    const wire = opts.body ? JSON.parse(JSON.stringify(opts.body)) : null;
    return { data: { ok: true, echoedImovel: wire?.imovel ?? null }, error: null };
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeSpy } },
}));

import { supabase } from "@/integrations/supabase/client";
import {
  buildManualImovel,
  buildAvaliacaoInvokePayload,
} from "./avaliacaoPayload";

const DESC_MANUAL_LONG =
  "Apartamento reformado com 3 quartos, 2 banheiros, varanda gourmet, " +
  "vista para o parque e 1 vaga de garagem. Condomínio com lazer completo.";

const DESC_EXTRAIDA =
  "🏠 Casa térrea, 4 dormitórios (1 suíte), quintal com churrasqueira,\n" +
  "próximo ao metrô — ótimo custo/benefício. Área útil ~180m².";

async function invokeEdge(selected: ReturnType<typeof buildManualImovel>) {
  return supabase.functions.invoke("avaliacao-imovel", {
    body: buildAvaliacaoInvokePayload(selected, [], "corr-e2e"),
  });
}

/** Recupera a chamada real de invoke (ignora chamadas fantasma sem body). */
function getInvokeCall() {
  const call = invokeSpy.mock.calls.find(
    (c) => c[0] === "avaliacao-imovel" && c[1] && (c[1] as any).body,
  );
  if (!call) throw new Error("supabase.functions.invoke não foi chamado com body");
  return { fn: call[0] as string, body: (call[1] as any).body };
}

describe("E2E avaliacao-imovel: descricao chega intacta no request", () => {
  beforeEach(() => invokeSpy.mockClear());

  it("modo MANUAL: descricao digitada pelo usuário chega idêntica no body", async () => {
    const selected = buildManualImovel({ descricao: DESC_MANUAL_LONG }, false, null);
    await invokeEdge(selected);

    expect(invokeSpy).toHaveBeenCalled();
    const { fn, body } = getInvokeCall();
    expect(fn).toBe("avaliacao-imovel");

    expect(body.imovel).toHaveProperty("descricao");
    expect(body.imovel.descricao).toBe(DESC_MANUAL_LONG);
    const wire = JSON.parse(JSON.stringify(body));
    expect(wire.imovel.descricao).toBe(DESC_MANUAL_LONG);
    expect(body.correlation_id).toBe("corr-e2e");
  });

  it("modo POR LINK sem input manual: descricao EXTRAÍDA chega intacta (emojis, \\n)", async () => {
    const selected = buildManualImovel(
      { descricao: "" },
      true,
      { descricao: DESC_EXTRAIDA },
    );
    const { data } = await invokeEdge(selected);

    const { body } = getInvokeCall();
    expect(body.imovel.descricao).toBe(DESC_EXTRAIDA);
    // Reidratação simulada pela edge function preservou emojis e \n.
    expect((data as any).echoedImovel.descricao).toBe(DESC_EXTRAIDA);
    expect((data as any).echoedImovel.descricao).toContain("🏠");
    expect((data as any).echoedImovel.descricao).toContain("\n");
  });

  it("modo POR LINK com input manual: MANUAL vence e chega intacto", async () => {
    const selected = buildManualImovel(
      { descricao: DESC_MANUAL_LONG },
      true,
      { descricao: DESC_EXTRAIDA },
    );
    await invokeEdge(selected);

    const body = getInvokeCall().body as any;
    expect(body.imovel.descricao).toBe(DESC_MANUAL_LONG);
    expect(body.imovel.descricao).not.toContain("🏠");
  });

  it("modo MANUAL sem descricao: chave presente como null (nunca undefined)", async () => {
    const selected = buildManualImovel({ descricao: "" }, false, null);
    await invokeEdge(selected);

    const body = getInvokeCall().body as any;
    expect("descricao" in body.imovel).toBe(true);
    expect(body.imovel.descricao).toBeNull();
    // Serialização preserva null (não vira undefined nem some).
    const serialized = JSON.stringify(body);
    expect(serialized).toMatch(/"descricao":null/);
  });

  it("modo POR LINK com extraído null: descricao vai como null explícito", async () => {
    const selected = buildManualImovel(
      { descricao: "   " }, // só whitespace → trim vazio
      true,
      { descricao: null },
    );
    await invokeEdge(selected);

    const body = getInvokeCall().body as any;
    expect(body.imovel.descricao).toBeNull();
  });

  it("descricao com 2000 chars (limite) sobrevive ao roundtrip byte-a-byte", async () => {
    const grande = "á".repeat(2000);
    const selected = buildManualImovel({ descricao: grande }, false, null);
    await invokeEdge(selected);

    const body = getInvokeCall().body as any;
    expect(body.imovel.descricao).toBe(grande);
    expect(Array.from(body.imovel.descricao as string).length).toBe(2000);
  });
});
