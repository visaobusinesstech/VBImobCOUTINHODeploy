/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Testes unitários — paridade Inadimplência Lovable ↔ VBSolution.
 */

import fs from "fs";
import path from "path";
import {
  GRAVIDADE_OPTIONS,
  GRAVIDADE_CONFIG,
  CONTRATO_FIELD_MAP,
  INADIMPLENCIA_TABS,
  INADIMPLENCIA_TABLE_COLUMNS,
  MESES_JANELA,
  classifyGravidade,
  computeInadimplenciaItems,
  computeInadimplenciaMetrics,
  filterByGravidade,
  chartGravidadeData,
  chartValorPorGravidade,
  isLocacaoAtiva,
  shouldAlertCurrentMonth,
  buildWhatsAppMessage,
  whatsappUrl,
  isPagamentoStatusOk
} from "../helpers/inadimplenciaParity";

const FRONT = path.resolve(__dirname, "../../../frontend/src");

function readFront(rel: string) {
  return fs.readFileSync(path.join(FRONT, rel), "utf8");
}

describe("inadimplencia parity — inputs/opções Lovable", () => {
  it("exposes the same gravidade filter options", () => {
    expect(GRAVIDADE_OPTIONS.map(o => o.value)).toEqual([
      "todos",
      "leve",
      "moderado",
      "grave",
      "critico"
    ]);
    expect(GRAVIDADE_CONFIG.leve.days).toBe("1-15 dias");
    expect(GRAVIDADE_CONFIG.moderado.days).toBe("16-30 dias");
    expect(GRAVIDADE_CONFIG.grave.days).toBe("31-60 dias");
    expect(GRAVIDADE_CONFIG.critico.days).toBe("60+ dias");
  });

  it("uses the same tabs and table columns as Lovable", () => {
    expect([...INADIMPLENCIA_TABS]).toEqual(["lista", "graficos"]);
    expect([...INADIMPLENCIA_TABLE_COLUMNS]).toEqual([
      "Gravidade",
      "Contrato",
      "Inquilino",
      "Proprietário",
      "Aluguel",
      "Meses",
      "Dívida Total",
      "Dias Atraso",
      "Ações"
    ]);
    expect(MESES_JANELA).toBe(3);
  });

  it("maps Lovable contrato fields to VB camelCase", () => {
    expect(CONTRATO_FIELD_MAP.titulo).toBe("title");
    expect(CONTRATO_FIELD_MAP.valor).toBe("value");
    expect(CONTRATO_FIELD_MAP.dia_vencimento_aluguel).toBe("diaVencimentoAluguel");
    expect(CONTRATO_FIELD_MAP.inquilino_telefone).toBe("inquilinoTelefone");
  });

  it("classifies gravidade with Lovable thresholds", () => {
    expect(classifyGravidade(1)).toBe("leve");
    expect(classifyGravidade(15)).toBe("leve");
    expect(classifyGravidade(16)).toBe("moderado");
    expect(classifyGravidade(30)).toBe("moderado");
    expect(classifyGravidade(31)).toBe("grave");
    expect(classifyGravidade(60)).toBe("grave");
    expect(classifyGravidade(61)).toBe("critico");
  });

  it("accepts pago and confirmado as paid statuses", () => {
    expect(isPagamentoStatusOk("pago")).toBe(true);
    expect(isPagamentoStatusOk("confirmado")).toBe(true);
    expect(isPagamentoStatusOk("pendente")).toBe(false);
    expect(isPagamentoStatusOk("atrasado")).toBe(false);
  });
});

describe("inadimplencia compute — regras Lovable", () => {
  const hoje = new Date(2026, 8, 25, 12, 0, 0); // 25 set 2026

  const contratoBase = {
    id: 1,
    title: "Apt Centro 101",
    tipo: "Locação",
    status: "ativo",
    value: 1500,
    diaVencimentoAluguel: 10,
    inquilino: "Maria Silva",
    inquilinoTelefone: "(11) 98888-7777",
    proprietario: "João Dono"
  };

  it("detects overdue when no rent payment in last months", () => {
    const items = computeInadimplenciaItems([contratoBase], [], { hoje });
    expect(items).toHaveLength(1);
    expect(items[0].meses_atrasados).toBeGreaterThan(0);
    expect(items[0].valor_total_divida).toBe(1500 * items[0].meses_atrasados);
    expect(items[0].inquilino).toBe("Maria Silva");
    expect(items[0].titulo).toBe("Apt Centro 101");
    expect(items[0].dias_atraso).toBeGreaterThan(0);
  });

  it("does not list when all months have paid transactions", () => {
    const txs = [
      {
        descricao: "Aluguel Apt Centro 101",
        tipo: "entrada",
        categoria: "aluguel",
        status: "pago",
        data: "2026-09-05"
      },
      {
        descricao: "Aluguel Apt Centro 101",
        tipo: "entrada",
        categoria: "aluguel",
        status: "pago",
        data: "2026-08-08"
      },
      {
        descricao: "Aluguel Apt Centro 101",
        tipo: "entrada",
        categoria: "aluguel",
        status: "confirmado",
        data: "2026-07-09"
      }
    ];
    const items = computeInadimplenciaItems([contratoBase], txs, { hoje });
    expect(items).toHaveLength(0);
  });

  it("treats comprovante recebido as payment (VB adaptation)", () => {
    const comps = [
      { contratoId: 1, ano: 2026, mes: 9, recebido: true },
      { contratoId: 1, ano: 2026, mes: 8, recebido: true },
      { contratoId: 1, ano: 2026, mes: 7, recebido: true }
    ];
    const items = computeInadimplenciaItems([contratoBase], [], {
      hoje,
      comprovantes: comps
    });
    expect(items).toHaveLength(0);
  });

  it("ignores non-Locação and inactive contracts", () => {
    expect(isLocacaoAtiva({ ...contratoBase, tipo: "Venda" })).toBe(false);
    expect(isLocacaoAtiva({ ...contratoBase, status: "cancelado" })).toBe(false);
    const items = computeInadimplenciaItems(
      [
        { ...contratoBase, tipo: "Venda" },
        { ...contratoBase, id: 2, status: "rascunho" }
      ],
      [],
      { hoje }
    );
    expect(items).toHaveLength(0);
  });

  it("filters by gravidade and computes metrics", () => {
    const items = computeInadimplenciaItems([contratoBase], [], { hoje });
    const metrics = computeInadimplenciaMetrics(items, 1);
    expect(metrics.totalInadimplentes).toBe(1);
    expect(metrics.contratosAtivos).toBe(1);
    expect(Number(metrics.taxaInadimplencia)).toBe(100);
    expect(filterByGravidade(items, "todos")).toHaveLength(1);
    const g = items[0].status_gravidade;
    expect(filterByGravidade(items, g)).toHaveLength(1);
    expect(filterByGravidade(items, g === "leve" ? "critico" : "leve")).toHaveLength(0);
    expect(chartGravidadeData(items).length).toBeGreaterThan(0);
    expect(chartValorPorGravidade(items).length).toBeGreaterThan(0);
  });

  it("builds WhatsApp URL and message like Lovable", () => {
    const items = computeInadimplenciaItems([contratoBase], [], { hoje });
    const msg = buildWhatsAppMessage(items[0], v =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    );
    expect(msg).toContain("Maria Silva");
    expect(msg).toContain("Apt Centro 101");
    const url = whatsappUrl(items[0].inquilino_telefone!, msg);
    expect(url).toMatch(/^https:\/\/wa\.me\/55/);
    expect(url).toContain("988887777");
  });

  it("alerts only for current month overdue without payment", () => {
    const check = shouldAlertCurrentMonth(contratoBase, [], hoje);
    expect(check.alert).toBe(true);
    expect(check.diasAtraso).toBeGreaterThan(0);

    const paid = shouldAlertCurrentMonth(
      contratoBase,
      [
        {
          descricao: "Apt Centro 101",
          tipo: "entrada",
          categoria: "aluguel",
          status: "pago",
          data: "2026-09-12"
        }
      ],
      hoje
    );
    expect(paid.alert).toBe(false);
  });
});

describe("inadimplencia frontend page wire-up", () => {
  it("exports dedicated Inadimplencia page (not kindPage stub)", () => {
    const mod = readFront("pages/RealtyModules/index.js");
    expect(mod).toMatch(/export\s+\{\s*default\s+as\s+Inadimplencia\s*\}\s+from\s+[\"'].*Inadimplencia/);
  });

  it("page contains Lovable controls: gravidade, tabs, PDF, alertas", () => {
    const page = readFront("pages/Inadimplencia/index.js");
    const helper = readFront("helpers/inadimplenciaCrm.js");
    expect(page).toContain("filtroGravidade");
    expect(helper).toContain("Lista Detalhada");
    expect(helper).toContain("Gráficos");
    expect(page).toContain("Exportar PDF");
    expect(page).toContain("Gerar Alertas Automáticos");
    expect(page).toContain("Total em Atraso");
    expect(page).toContain("Taxa de Inadimplência");
    expect(page).toContain("openWhatsApp");
    expect(helper).toContain("wa.me");
    expect(helper).toContain('value: "todos"');
    expect(helper).toContain('value: "leve"');
    expect(helper).toContain('value: "moderado"');
    expect(helper).toContain('value: "grave"');
    expect(helper).toContain('value: "critico"');
  });

  it("service exposes inadimplencia endpoints", () => {
    const svc = readFront("services/realtyService.js");
    expect(svc).toContain("/inadimplencia");
    expect(svc).toContain("/inadimplencia/alertas");
    expect(svc).toContain("/realty-transacoes");
  });
});
