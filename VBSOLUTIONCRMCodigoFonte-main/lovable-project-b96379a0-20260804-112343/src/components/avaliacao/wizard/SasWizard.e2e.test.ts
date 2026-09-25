/**
 * E2E-style integration tests for the SAS Wizard (Avaliação Imobiliária).
 *
 * Cobre o fluxo completo sem renderizar componentes pesados de UI/Supabase:
 *  1. Estado inicial vazio → preenchimento das 4 etapas.
 *  2. Autosave em localStorage durante a navegação.
 *  3. Cálculos do motor NBR 14.653 (homogeneização, IC 95%, qualidade).
 *  4. Geração do PDF (capa, valor final, memória, conclusão).
 *  5. QR Code de validação embutido no laudo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import QRCode from "qrcode";


import { emptyWizardState, type WizardState } from "./types";
import {
  calcularAvaliacao,
  FATORES_DEFAULT,
  pctParaFator,
  type ComparavelInput,
  type FatoresHomogeneizacao,
} from "@/lib/avaliacao/engine";
import { exportLaudoWizardPDF } from "@/lib/avaliacao/exportLaudoWizardPDF";

const DRAFT_KEY = "sas-wizard-v1";

// ---------- helpers ----------

function makeComparavel(i: number, overrides: Partial<ComparavelInput> = {}): ComparavelInput {
  return {
    id: `cmp-${i}`,
    endereco: `Rua Teste ${i}`,
    bairro: "Asa Sul",
    area: 100,
    valor_anunciado: 800_000 + i * 10_000,
    valor_negociado: 750_000 + i * 10_000,
    distancia_km: 0.5,
    data_pesquisa: "2026-06-01",
    link_fonte: `https://exemplo.com/${i}`,
    observacoes: "",
    ...overrides,
  };
}

/** Simula o reducer/autosave do SasWizard.tsx sem depender do componente React. */
function createWizardStore(initial?: WizardState) {
  let state: WizardState = initial ?? emptyWizardState();
  const persist = () => localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  return {
    get: () => state,
    setImovel(patch: Partial<WizardState["imovel"]>) {
      state = { ...state, imovel: { ...state.imovel, ...patch } };
      persist();
    },
    setComparaveis(next: ComparavelInput[]) {
      state = { ...state, comparaveis: next };
      persist();
    },
    setFatores(next: Record<string, FatoresHomogeneizacao>) {
      state = { ...state, fatores: next };
      persist();
    },
    setResultado(r: WizardState["resultado"]) {
      state = { ...state, resultado: r };
      persist();
    },
    setIA(ia: WizardState["iaAnalise"]) {
      state = { ...state, iaAnalise: ia };
      persist();
    },
    clear() {
      localStorage.removeItem(DRAFT_KEY);
      state = emptyWizardState();
    },
  };
}

// ---------- tests ----------

describe("[E2E] SAS Wizard — fluxo completo de avaliação", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Etapa 1: preenche dados do imóvel e persiste rascunho no localStorage", () => {
    const wiz = createWizardStore();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    wiz.setImovel({
      tipo: "Apartamento",
      finalidade: "Venda",
      bairro: "Asa Sul",
      cidade: "Brasília",
      estado: "DF",
      cep: "70000-000",
      area_construida: "120",
      idade: "5",
      quartos: "3",
      suites: "1",
      banheiros: "2",
      garagens: "2",
    });

    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY)!);
    expect(saved.imovel.tipo).toBe("Apartamento");
    expect(saved.imovel.bairro).toBe("Asa Sul");
    expect(saved.imovel.area_construida).toBe("120");
  });

  it("Etapa 2 → 3 → 4: comparáveis, homogeneização e cálculo produzem valor coerente", () => {
    const wiz = createWizardStore();
    wiz.setImovel({ area_construida: "100", bairro: "X", cidade: "Y" });

    const comps = Array.from({ length: 6 }, (_, i) => makeComparavel(i + 1));
    wiz.setComparaveis(comps);
    expect(wiz.get().comparaveis).toHaveLength(6);

    // Etapa 3 — fatores: -10% (mais barato que o avaliando) em alguns, neutros nos demais
    const fatores: Record<string, FatoresHomogeneizacao> = {};
    comps.forEach((c, i) => {
      fatores[c.id] = { ...FATORES_DEFAULT, localizacao: pctParaFator(i % 2 === 0 ? -10 : 5) };
    });
    wiz.setFatores(fatores);

    // Etapa 4 — cálculo
    const resultado = calcularAvaliacao(wiz.get().comparaveis, wiz.get().fatores, 100);
    wiz.setResultado(resultado);

    expect(resultado.amostraValida).toBeGreaterThanOrEqual(5);
    expect(resultado.precoM2.mediana).toBeGreaterThan(0);
    expect(resultado.precoM2.media).toBeGreaterThan(0);
    expect(resultado.precoM2.coeficienteVariacao).toBeGreaterThanOrEqual(0);
    expect(resultado.valorFinal.sugerido).toBeGreaterThan(0);
    expect(resultado.valorFinal.minimo).toBeLessThanOrEqual(resultado.valorFinal.sugerido);
    expect(resultado.valorFinal.maximo).toBeGreaterThanOrEqual(resultado.valorFinal.sugerido);
    expect(["rigoroso", "normal", "expedito"]).toContain(resultado.qualidade.nivel);

    // Persistência
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY)!);
    expect(draft.comparaveis).toHaveLength(6);
    expect(draft.resultado?.valorFinal?.sugerido).toBe(resultado.valorFinal.sugerido);
  });

  it("Autosave: cada mutação grava o estado atualizado no localStorage", () => {
    const wiz = createWizardStore();
    wiz.setImovel({ bairro: "A" });
    const s1 = JSON.parse(localStorage.getItem(DRAFT_KEY)!).imovel.bairro;
    wiz.setImovel({ bairro: "B" });
    const s2 = JSON.parse(localStorage.getItem(DRAFT_KEY)!).imovel.bairro;
    wiz.setComparaveis([makeComparavel(1)]);
    const s3 = JSON.parse(localStorage.getItem(DRAFT_KEY)!).comparaveis.length;

    expect(s1).toBe("A");
    expect(s2).toBe("B");
    expect(s3).toBe(1);
  });

  it("Limpar rascunho remove a chave do localStorage", () => {
    const wiz = createWizardStore();
    wiz.setImovel({ bairro: "Z" });
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    wiz.clear();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("Amostra heterogênea dispara alertas de qualidade", () => {
    const wiz = createWizardStore();
    const comps: ComparavelInput[] = [
      makeComparavel(1, { valor_anunciado: 500_000, valor_negociado: 500_000 }),
      makeComparavel(2, { valor_anunciado: 600_000, valor_negociado: 600_000 }),
      makeComparavel(3, { valor_anunciado: 2_000_000, valor_negociado: 2_000_000 }),
    ];
    wiz.setComparaveis(comps);
    const r = calcularAvaliacao(comps, {}, 100);
    expect(r.qualidade.alertas.length).toBeGreaterThan(0);
  });
});

// ===== PDF / QR Code =====
// Substitui jsPDF por um stub que registra todas as chamadas relevantes.
type Recorded = {
  texts: string[];
  images: any[][];
  pages: number;
  savedAs: string | null;
};

const pdfRecorder: Recorded = { texts: [], images: [], pages: 1, savedAs: null };

vi.mock("jspdf", () => {
  class FakeJsPDF {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    constructor(_opts?: any) {
      pdfRecorder.texts = [];
      pdfRecorder.images = [];
      pdfRecorder.pages = 1;
      pdfRecorder.savedAs = null;
    }
    setFillColor() {} setTextColor() {} setDrawColor() {}
    setFont() {} setFontSize() {}
    rect() {} line() {}
    addPage() { pdfRecorder.pages += 1; }
    splitTextToSize(text: string) { return Array.isArray(text) ? text : [text]; }
    addImage(...args: any[]) { pdfRecorder.images.push(args); }
    text(value: string | string[]) {
      const v = Array.isArray(value) ? value.join(" ") : String(value);
      pdfRecorder.texts.push(v);
    }
    save(name: string) { pdfRecorder.savedAs = name; }
  }
  return { default: FakeJsPDF };
});

import { exportLaudoWizardPDF as exportLaudoWizardPDFMocked } from "@/lib/avaliacao/exportLaudoWizardPDF";

describe("[E2E] SAS Wizard — geração do PDF + QR Code", () => {
  let qrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pdfRecorder.texts = [];
    pdfRecorder.images = [];
    pdfRecorder.pages = 1;
    pdfRecorder.savedAs = null;
    qrSpy = vi.spyOn(QRCode, "toDataURL");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildFullState(): WizardState {
    const base = emptyWizardState();
    base.imovel = {
      ...base.imovel,
      tipo: "Apartamento",
      finalidade: "Venda",
      endereco: "SQS 308 Bloco A",
      bairro: "Asa Sul",
      cidade: "Brasília",
      estado: "DF",
      cep: "70355-010",
      area_construida: "120",
      idade: "8",
      quartos: "3",
      suites: "1",
      banheiros: "2",
      garagens: "2",
      area_lazer: "350",
      caracteristicas: "Vista livre, andar alto, reformado",
    };
    base.comparaveis = Array.from({ length: 5 }, (_, i) => makeComparavel(i + 1));
    base.fatores = {};
    base.comparaveis.forEach((c) => (base.fatores[c.id] = { ...FATORES_DEFAULT }));
    base.resultado = calcularAvaliacao(base.comparaveis, base.fatores, 120);
    base.iaAnalise = {
      inconsistencias: [],
      suficiencia: "Amostra adequada para o método comparativo.",
      valor_sugerido_ia: base.resultado.valorFinal.sugerido,
      fundamentacao: "Aplicado método comparativo direto de dados de mercado conforme ABNT NBR 14.653.",
      conclusao: "Valor final atribuído conforme mediana homogeneizada.",
      gerado_em: new Date().toISOString(),
    };
    return base;
  }

  it("Gera laudo com capa, valor final, memória, fundamentação e nome de arquivo correto", async () => {
    const state = buildFullState();
    await exportLaudoWizardPDFMocked({
      state,
      imobiliaria: {
        nome: "Imobiliária Teste",
        creci: "12345-DF",
        telefone: "(61) 99999-9999",
        email: "contato@teste.com",
        cnpj: "00.000.000/0001-00",
        logo_url: null,
      },
      usuario: { nome: "Avaliador Teste", email: "avaliador@teste.com" },
    });

    expect(pdfRecorder.savedAs).toMatch(/^laudo-LAUDO-[A-Z0-9]+\.pdf$/);

    const allText = pdfRecorder.texts.join("\n");
    expect(allText).toContain("LAUDO DE AVALIAÇÃO");
    expect(allText).toContain("VALOR FINAL SUGERIDO");
    expect(allText).toContain("Imobiliária Teste");
    expect(allText).toContain("CRECI 12345-DF");
    expect(allText).toContain("Asa Sul");
    expect(allText).toContain("Brasília/DF");
    expect(allText).toMatch(/Bruto R\$\/m²/);
    expect(allText).toContain("Fundamentação técnica");
    expect(allText).toContain("Conclusão");
    expect(allText).toContain("ABNT NBR 14.653");

    // Múltiplas páginas geradas (capa + dados + mercado + memória + resultado + ia + assinatura)
    expect(pdfRecorder.pages).toBeGreaterThanOrEqual(6);
  });

  it("Embute QR Code de validação com URL contendo o protocolo do laudo", async () => {
    const state = buildFullState();
    await exportLaudoWizardPDFMocked({
      state,
      imobiliaria: { nome: "X", logo_url: null },
      usuario: { nome: "Y", email: "y@y.com" },
    });

    expect(qrSpy).toHaveBeenCalledTimes(1);
    const qrArg = qrSpy.mock.calls[0][0] as string;
    expect(qrArg).toMatch(/\/avaliacao\/validar\/LAUDO-[A-Z0-9]+$/);

    // O QR (PNG data URL) foi inserido via addImage
    const qrImageCall = pdfRecorder.images.find((args) => {
      const data = args[0];
      return typeof data === "string" && data.startsWith("data:image/png;base64,");
    });
    expect(qrImageCall).toBeTruthy();
  });

  it("Protocolos diferentes em laudos distintos (rastreabilidade única)", async () => {
    const state = buildFullState();
    await exportLaudoWizardPDFMocked({
      state, imobiliaria: { nome: "X", logo_url: null }, usuario: { nome: "Y", email: "y@y.com" },
    });
    const first = pdfRecorder.savedAs;
    await new Promise((r) => setTimeout(r, 5));
    await exportLaudoWizardPDFMocked({
      state, imobiliaria: { nome: "X", logo_url: null }, usuario: { nome: "Y", email: "y@y.com" },
    });
    const second = pdfRecorder.savedAs;
    expect(first).not.toBe(second);
  });
});

