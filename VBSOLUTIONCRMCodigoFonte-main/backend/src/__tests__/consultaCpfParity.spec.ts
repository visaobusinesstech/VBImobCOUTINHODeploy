/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Paridade Consulta CPF — sem simulação/mock.
 */

import fs from "fs";
import path from "path";
import {
  CONSULTA_CPF_FORM_FIELDS,
  CONSULTA_CPF_UI,
  CreditCheckConfigError,
  digitsOnly,
  formatCpfMask,
  getConfiguredBureaus,
  isValidCpfDigits,
  maskCpf,
  missingBureauConfigMessage,
  runCreditCheck,
  scoreTipsFor,
  validateCpfForCreditCheck
} from "../helpers/consultaCpfCredit";

const FRONT = path.resolve(__dirname, "../../../frontend/src");

function readFront(rel: string) {
  return fs.readFileSync(path.join(FRONT, rel), "utf8");
}

/** CPF válido conhecido: 529.982.247-25 */
const VALID_CPF = "52998224725";
const VALID_CPF_MASKED_INPUT = "529.982.247-25";

describe("consultaCpf parity — Lovable inputs/opções", () => {
  it("form fields are exactly cpf + lgpdConsent", () => {
    expect([...CONSULTA_CPF_FORM_FIELDS]).toEqual(["cpf", "lgpdConsent"]);
  });

  it("UI labels/placeholders match Lovable widget", () => {
    expect(CONSULTA_CPF_UI.title).toBe("Consulta CPF — Restrição");
    expect(CONSULTA_CPF_UI.cpfPlaceholder).toBe("000.000.000-00");
    expect(CONSULTA_CPF_UI.lgpdLabel).toBe(
      "Declaro consentimento do titular do CPF para esta consulta (LGPD)."
    );
    expect(CONSULTA_CPF_UI.consultButton).toBe("Consultar");
    expect([...CONSULTA_CPF_UI.providers]).toEqual([
      "Serasa Experian",
      "SPC Brasil",
      "Boa Vista SCPC"
    ]);
  });

  it("frontend has no simulated/mock UI banners", () => {
    const page = readFront("pages/ConsultaCPF/index.js");
    expect(page).not.toContain("DADOS SIMULADOS");
    expect(page).not.toContain("result.simulated");
    expect(page).toContain("creditCheckConsultaCpf");
    expect(page).toContain("lgpdConsent");
  });

  it("helper source has no generateSimulatedScore", () => {
    const helper = fs.readFileSync(
      path.resolve(__dirname, "../helpers/consultaCpfCredit.ts"),
      "utf8"
    );
    expect(helper).not.toContain("generateSimulatedScore");
    expect(helper).toContain("runCreditCheck");
    expect(helper).toContain("simulated: false");
  });
});

describe("consultaCpf — CPF validation", () => {
  it("formats mask and validates digits", () => {
    expect(formatCpfMask("52998224725")).toBe(VALID_CPF_MASKED_INPUT);
    expect(isValidCpfDigits(VALID_CPF)).toBe(true);
    expect(isValidCpfDigits("11111111111")).toBe(false);
    expect(validateCpfForCreditCheck("")).toBe("CPF é obrigatório");
    expect(digitsOnly(VALID_CPF_MASKED_INPUT)).toBe(VALID_CPF);
    expect(maskCpf(VALID_CPF)).toBe("***.***.247-25");
  });
});

describe("consultaCpf — real providers only (no mock)", () => {
  it("reports no configured bureaus without env keys", () => {
    expect(getConfiguredBureaus({})).toEqual([]);
    expect(missingBureauConfigMessage({})).toMatch(/Nenhum bureau/);
    expect(missingBureauConfigMessage({})).toMatch(/simuladas foram desativadas/);
  });

  it("requires api key + url for a bureau", () => {
    expect(
      getConfiguredBureaus({
        SPC_API_KEY: "abc",
        SPC_API_URL: ""
      })
    ).toEqual([]);
    expect(
      getConfiguredBureaus({
        SPC_API_KEY: "abc",
        SPC_API_URL: "https://spc.example/check"
      }).map(b => b.name)
    ).toEqual(["SPC Brasil"]);
  });

  it("runCreditCheck throws config error without keys (never invents scores)", async () => {
    await expect(runCreditCheck(VALID_CPF, {})).rejects.toBeInstanceOf(
      CreditCheckConfigError
    );
  });

  it("score tips still follow Lovable thresholds", () => {
    const low = scoreTipsFor(650);
    expect(low.some(t => t.title === "Manter contas em dia")).toBe(true);
    const high = scoreTipsFor(720);
    expect(high.some(t => t.title.includes("Score já está bom"))).toBe(true);
  });
});
