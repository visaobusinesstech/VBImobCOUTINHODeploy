import { describe, it, expect } from "vitest";
import { normalizeEstagio, ESTAGIOS, LEGACY_ESTAGIO_REMAP } from "./useLeads";

describe("normalizeEstagio — guarda contra card fantasma 'Procurar Opções'", () => {
  it("mapeia 'procurar_opcoes' para 'mandar_opcoes'", () => {
    expect(normalizeEstagio("procurar_opcoes")).toBe("mandar_opcoes");
    expect(LEGACY_ESTAGIO_REMAP.procurar_opcoes).toBe("mandar_opcoes");
  });

  it("também mapeia o id temporário 'opcoes' para 'mandar_opcoes'", () => {
    expect(normalizeEstagio("opcoes")).toBe("mandar_opcoes");
  });

  it("preserva qualquer id válido de ESTAGIOS", () => {
    ESTAGIOS.forEach((e) => expect(normalizeEstagio(e.id)).toBe(e.id));
  });

  it("cai em 'novos' para ids desconhecidos, null, undefined ou vazio", () => {
    expect(normalizeEstagio("qualquer_coisa")).toBe("novos");
    expect(normalizeEstagio(null)).toBe("novos");
    expect(normalizeEstagio(undefined)).toBe("novos");
    expect(normalizeEstagio("")).toBe("novos");
    expect(normalizeEstagio("   ")).toBe("novos");
  });

  it("nunca retorna 'procurar_opcoes' para nenhuma entrada", () => {
    const entradas = [
      "procurar_opcoes", "opcoes", "novos", "fechado", "desconhecido",
      "PROCURAR_OPCOES", null, undefined, "", "   procurar_opcoes   ",
    ];
    entradas.forEach((e) => expect(normalizeEstagio(e as any)).not.toBe("procurar_opcoes"));
  });
});
