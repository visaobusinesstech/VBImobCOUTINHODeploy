/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Testes unitários frontend — paridade Consulta CPF.
 */

import {
  CONSULTA_CPF_FIELD_MAP,
  CONSULTA_CPF_FORM_FIELDS,
  CONSULTA_CPF_UI,
  buildScoreTips,
  buildWhatsAppScoreMessage,
  formatCpfMask,
  isValidCpfDigits,
  normalizeRestrictions,
  scoreBarPercent,
  scoreTone,
} from "./consultaCpfParity";

describe("consultaCpfParity frontend", () => {
  it("maps Lovable inputs to VB fields 1:1", () => {
    expect(CONSULTA_CPF_FORM_FIELDS).toEqual(["cpf", "lgpdConsent"]);
    expect(CONSULTA_CPF_FIELD_MAP.cpf).toBe("cpf");
    expect(CONSULTA_CPF_FIELD_MAP.lgpdConsent).toBe("lgpdConsent");
    expect(CONSULTA_CPF_FIELD_MAP.lgpd_consent).toBe("lgpdConsent");
    expect(CONSULTA_CPF_FIELD_MAP.contrato_id).toBe("contratoId");
  });

  it("keeps Lovable placeholders and action labels", () => {
    expect(CONSULTA_CPF_UI.cpfPlaceholder).toBe("000.000.000-00");
    expect(CONSULTA_CPF_UI.scoreTipsActions).toEqual([
      "Exportar Plano PDF",
      "Enviar via WhatsApp",
      "Agendar Reconsulta",
    ]);
    expect(CONSULTA_CPF_UI.providers).toEqual([
      "Serasa Experian",
      "SPC Brasil",
      "Boa Vista SCPC",
    ]);
  });

  it("validates and masks CPF like the Lovable widget", () => {
    expect(formatCpfMask("52998224725")).toBe("529.982.247-25");
    expect(isValidCpfDigits("52998224725")).toBe(true);
    expect(isValidCpfDigits("11111111111")).toBe(false);
  });

  it("normalizes string and object restrictions", () => {
    const all = normalizeRestrictions([
      "Pendência X",
      { descricao: "Protesto", credor: "Banco", valor: 100, data: "2024-01-01", cidade: "SP", uf: "SP" },
    ]);
    expect(all).toHaveLength(2);
    expect(all[0].descricao).toBe("Pendência X");
    expect(all[1].credor).toBe("Banco");
  });

  it("score bar and tone thresholds match Lovable", () => {
    expect(scoreTone(700)).toBe("success");
    expect(scoreTone(500)).toBe("warning");
    expect(scoreTone(499)).toBe("danger");
    expect(scoreBarPercent(300)).toBe(0);
    expect(scoreBarPercent(900)).toBe(100);
    expect(scoreBarPercent(600)).toBe(50);
  });

  it("builds tips and WhatsApp message like Lovable", () => {
    const tips = buildScoreTips(650);
    expect(tips.some((t) => t.title === "Manter contas em dia")).toBe(true);
    const msg = buildWhatsAppScoreMessage(650);
    expect(msg).toContain("score de crédito (atual: 650)");
    expect(msg).toContain("Cadastro Positivo");
  });
});
