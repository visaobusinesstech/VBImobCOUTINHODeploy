import { describe, it, expect } from "vitest";
import {
  computeConversao,
  computeTaxaFechamento,
  computeMRR,
  computeTempoRespostaMedioHoras,
  computeLeadsPorEstagio,
  type LeadMinimo,
  type ContratoMinimo,
  type AtividadeMinima,
} from "./dashboardMetrics";
import { ESTAGIOS } from "@/hooks/useLeads";

const iso = (d: string) => new Date(d).toISOString();

const leads: LeadMinimo[] = [
  { id: "l1", estagio: "novos", created_at: iso("2026-06-01T09:00:00Z") },
  { id: "l2", estagio: "qualificados", created_at: iso("2026-06-02T09:00:00Z") },
  { id: "l3", estagio: "fechado", created_at: iso("2026-06-03T09:00:00Z") },
  { id: "l4", estagio: "fechado", created_at: iso("2026-06-04T09:00:00Z") },
  { id: "l5", estagio: "perdido", created_at: iso("2026-06-05T09:00:00Z") },
  { id: "l6", estagio: "desistiu", created_at: iso("2026-06-06T09:00:00Z") },
  { id: "l7", estagio: "comprou_outra", created_at: iso("2026-06-07T09:00:00Z") },
  { id: "l8", estagio: "mandar_opcoes", created_at: iso("2026-06-08T09:00:00Z") },
];

const atividades: AtividadeMinima[] = [
  { lead_id: "l1", created_at: iso("2026-06-01T10:00:00Z") }, // 1h
  { lead_id: "l1", created_at: iso("2026-06-01T12:00:00Z") }, // ignorado (não é a 1ª)
  { lead_id: "l2", created_at: iso("2026-06-02T12:00:00Z") }, // 3h
  { lead_id: "l3", created_at: iso("2026-06-03T14:00:00Z") }, // 5h
  { lead_id: "l99", created_at: iso("2026-06-01T09:30:00Z") }, // sem lead correspondente
];

const contratos: ContratoMinimo[] = [
  { id: "c1", tipo: "Locação", status: "ativo", valor: 2500,
    data_inicio: iso("2026-01-01T00:00:00Z"), data_fim: iso("2027-01-01T00:00:00Z") },
  { id: "c2", tipo: "Locação", status: "assinado", valor: 1800,
    data_inicio: iso("2026-05-01T00:00:00Z"), data_fim: iso("2027-05-01T00:00:00Z") },
  { id: "c3", tipo: "Locação", status: "cancelado", valor: 5000,
    data_inicio: iso("2026-05-01T00:00:00Z"), data_fim: iso("2027-05-01T00:00:00Z") },
  { id: "c4", tipo: "Locação", status: "ativo", valor: 9999,
    data_inicio: iso("2027-01-01T00:00:00Z"), data_fim: iso("2028-01-01T00:00:00Z") }, // futuro
  { id: "c5", tipo: "Venda", status: "ativo", valor: 500000,
    data_inicio: iso("2026-06-01T00:00:00Z"), data_fim: iso("2027-06-01T00:00:00Z") },
];

const REFERENCE = new Date("2026-07-02T00:00:00Z");

describe("Dashboard — métricas avançadas usam ESTAGIOS", () => {
  it("ESTAGIOS contém 'fechado' e não contém 'procurar_opcoes'", () => {
    expect(ESTAGIOS.some((e) => e.id === "fechado")).toBe(true);
    expect(ESTAGIOS.some((e) => String(e.id) === "procurar_opcoes")).toBe(false);
  });

  it("computeConversao usa o id 'fechado' de ESTAGIOS", () => {
    // 2 fechados de 8 leads = 25%
    expect(computeConversao(leads)).toBe(25);
  });

  it("computeConversao retorna 0 para conjunto vazio", () => {
    expect(computeConversao([])).toBe(0);
  });

  it("computeTaxaFechamento considera apenas leads decididos (fechado ou descartados)", () => {
    // decididos: 2 fechados + 3 descartados = 5. Fechados = 2 → 40%.
    expect(computeTaxaFechamento(leads)).toBe(40);
  });

  it("computeTaxaFechamento retorna 0 quando nenhum lead foi decidido", () => {
    const emAndamento: LeadMinimo[] = [
      { id: "a", estagio: "novos", created_at: iso("2026-06-01T00:00:00Z") },
      { id: "b", estagio: "mandar_opcoes", created_at: iso("2026-06-02T00:00:00Z") },
    ];
    expect(computeTaxaFechamento(emAndamento)).toBe(0);
  });

  it("computeMRR soma apenas locações ativas/assinadas em vigor na data de referência", () => {
    // c1 (2500) + c2 (1800) = 4300; c3 cancelado, c4 futuro, c5 é venda.
    expect(computeMRR(contratos, REFERENCE)).toBe(4300);
  });

  it("computeMRR retorna 0 quando não há locações vigentes", () => {
    expect(computeMRR([contratos[3]], REFERENCE)).toBe(0);
  });

  it("computeTempoRespostaMedioHoras usa apenas a 1ª atividade e ignora leads inexistentes", () => {
    // (1 + 3 + 5) / 3 = 3
    expect(computeTempoRespostaMedioHoras(leads, atividades)).toBe(3);
  });

  it("computeTempoRespostaMedioHoras retorna null quando nenhum lead tem atividade", () => {
    expect(computeTempoRespostaMedioHoras(leads, [])).toBeNull();
  });

  it("computeLeadsPorEstagio segue a ordem e os ids de ESTAGIOS", () => {
    const dist = computeLeadsPorEstagio(leads);
    expect(dist.map((d) => d.id)).toEqual(ESTAGIOS.map((e) => e.id));
    expect(dist.map((d) => d.title)).toEqual(ESTAGIOS.map((e) => e.title));
    const byId = Object.fromEntries(dist.map((d) => [d.id, d.total]));
    expect(byId["novos"]).toBe(1);
    expect(byId["fechado"]).toBe(2);
    expect(byId["mandar_opcoes"]).toBe(1);
    expect(byId["perdido"]).toBe(1);
  });

  it("distribuição por estágio nunca inclui 'procurar_opcoes'", () => {
    const dist = computeLeadsPorEstagio(leads);
    expect(dist.some((d) => String(d.id) === "procurar_opcoes")).toBe(false);
    expect(dist.some((d) => /procurar/i.test(d.title))).toBe(false);
  });
});
