import { describe, it, expect } from "vitest";
import {
  buildRelatorioCaptacaoCsv,
  type RelatorioCaptacaoItem,
  type RelatorioCaptacaoMetric,
} from "./relatorioCaptacaoCsv";

const baseMetric = (over: Partial<RelatorioCaptacaoMetric> = {}): RelatorioCaptacaoMetric => ({
  canal: "Indicação",
  total: 2,
  concluidas: 1,
  emAndamento: 0,
  pendentes: 1,
  canceladas: 0,
  taxaConversao: 50,
  tempoRespostaHoras: 1.5,
  tempoFechamentoDias: 2,
  ...over,
});

const item = (over: Partial<RelatorioCaptacaoItem>): RelatorioCaptacaoItem => ({
  tipo: "indicacao",
  status: "pendente",
  operacao: "Venda",
  observacoes: null,
  nome_contato: "Lead",
  telefone_contato: "61999990000",
  created_at: "2026-06-01T12:00:00.000Z",
  ...over,
});

describe("buildRelatorioCaptacaoCsv", () => {
  it("inclui a coluna 'Indicado por' no cabeçalho", () => {
    const csv = buildRelatorioCaptacaoCsv([], []);
    expect(csv.split("\n")[0]).toContain("Indicado por");
  });

  it("agrega os indicadores únicos do canal Indicação na linha de métricas", () => {
    const filtered: RelatorioCaptacaoItem[] = [
      item({ observacoes: "Indicado por: Ana\nlead quente" }),
      item({ observacoes: "Indicado por: Bruno", status: "concluida" }),
      item({ observacoes: "Indicado por: Ana" }), // duplicado
    ];
    const csv = buildRelatorioCaptacaoCsv([baseMetric({ total: 3 })], filtered);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain("Indicação");
    expect(dataLine.endsWith("Ana | Bruno")).toBe(true);
  });

  it("não acrescenta o bloco 'Detalhe Indicações' quando não há indicações no período", () => {
    const filtered: RelatorioCaptacaoItem[] = [
      item({ tipo: "porteiro", observacoes: null }),
    ];
    const csv = buildRelatorioCaptacaoCsv(
      [baseMetric({ canal: "Porteiro", total: 1, concluidas: 0, pendentes: 1, taxaConversao: 0 })],
      filtered,
    );
    expect(csv).not.toContain("Detalhe Indicações");
    expect(csv.split("\n")).toHaveLength(2); // header + 1 row
  });

  it("anexa o bloco 'Detalhe Indicações' com cabeçalho e linhas detalhadas", () => {
    const filtered: RelatorioCaptacaoItem[] = [
      item({
        nome_contato: "Carlos Silva",
        telefone_contato: "61911112222",
        observacoes: "Indicado por: Fernanda",
        operacao: "Locação",
        status: "em_andamento",
        created_at: "2026-06-10T15:00:00.000Z",
      }),
    ];
    const csv = buildRelatorioCaptacaoCsv([baseMetric({ total: 1 })], filtered);

    expect(csv).toContain("Detalhe Indicações");
    expect(csv).toMatch(/Data;Nome;Telefone;Indicado por;Operação;Status/);
    expect(csv).toContain("Carlos Silva");
    expect(csv).toContain("61911112222");
    expect(csv).toContain("Fernanda");
    expect(csv).toContain("Locação");
    expect(csv).toContain("Em andamento");
  });

  it("ignora indicações sem nome de indicador no agrupamento da métrica", () => {
    const filtered: RelatorioCaptacaoItem[] = [
      item({ observacoes: null }),
      item({ observacoes: "" }),
    ];
    const csv = buildRelatorioCaptacaoCsv([baseMetric({ total: 2 })], filtered);
    const dataLine = csv.split("\n")[1];
    // última coluna fica vazia (termina com separador final do agregador)
    expect(dataLine.endsWith(";")).toBe(true);
  });

  it("escapa valores contendo ponto-e-vírgula, aspas ou quebra de linha", () => {
    const filtered: RelatorioCaptacaoItem[] = [
      item({
        nome_contato: 'Maria; "VIP"',
        observacoes: "Indicado por: João\nobs",
      }),
    ];
    const csv = buildRelatorioCaptacaoCsv([baseMetric({ total: 1 })], filtered);
    expect(csv).toContain('"Maria; ""VIP"""');
  });

  it("separa o bloco de detalhes do bloco de métricas com uma linha em branco", () => {
    const filtered: RelatorioCaptacaoItem[] = [
      item({ observacoes: "Indicado por: Ana" }),
    ];
    const csv = buildRelatorioCaptacaoCsv([baseMetric({ total: 1 })], filtered);
    const lines = csv.split("\n");
    const idx = lines.findIndex((l) => l.startsWith("Detalhe Indicações"));
    expect(idx).toBeGreaterThan(0);
    expect(lines[idx - 1]).toBe("");
  });
});
