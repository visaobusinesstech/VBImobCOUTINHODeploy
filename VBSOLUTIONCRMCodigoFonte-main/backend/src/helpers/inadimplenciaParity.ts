/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Paridade Inadimplência (Lovable /inadimplencia ↔ VBSolution).
 */

export const GRAVIDADE_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "leve", label: "Leve (1-15 dias)" },
  { value: "moderado", label: "Moderado (16-30 dias)" },
  { value: "grave", label: "Grave (31-60 dias)" },
  { value: "critico", label: "Crítico (60+ dias)" }
] as const;

export type GravidadeKey = "leve" | "moderado" | "grave" | "critico";

export const GRAVIDADE_CONFIG: Record<
  GravidadeKey,
  { label: string; days: string; minExclusive: number }
> = {
  leve: { label: "Leve", days: "1-15 dias", minExclusive: 0 },
  moderado: { label: "Moderado", days: "16-30 dias", minExclusive: 15 },
  grave: { label: "Grave", days: "31-60 dias", minExclusive: 30 },
  critico: { label: "Crítico", days: "60+ dias", minExclusive: 60 }
};

/** Lovable snake_case → VB camelCase (contratos). */
export const CONTRATO_FIELD_MAP: Record<string, string> = {
  titulo: "title",
  valor: "value",
  dia_vencimento_aluguel: "diaVencimentoAluguel",
  inquilino_telefone: "inquilinoTelefone",
  tipo: "tipo",
  status: "status",
  inquilino: "inquilino",
  cliente: "cliente",
  proprietario: "proprietario"
};

/** Campos mínimos de transação usados pelo relatório (Lovable). */
export const TRANSACAO_MATCH_FIELDS = [
  "descricao",
  "tipo",
  "categoria",
  "data",
  "status"
] as const;

export const INADIMPLENCIA_TABS = ["lista", "graficos"] as const;

export const INADIMPLENCIA_TABLE_COLUMNS = [
  "Gravidade",
  "Contrato",
  "Inquilino",
  "Proprietário",
  "Aluguel",
  "Meses",
  "Dívida Total",
  "Dias Atraso",
  "Ações"
] as const;

export const MESES_JANELA = 3;

/** Status que contam como aluguel pago (Lovable usa "pago"; VB Financeiro usa "confirmado"). */
export const PAGAMENTO_STATUS_OK = new Set(["pago", "confirmado"]);

export interface InadContratoInput {
  id: number | string;
  title?: string | null;
  titulo?: string | null;
  tipo?: string | null;
  status?: string | null;
  value?: number | null;
  valor?: number | null;
  diaVencimentoAluguel?: number | null;
  dia_vencimento_aluguel?: number | null;
  inquilino?: string | null;
  cliente?: string | null;
  inquilinoTelefone?: string | null;
  inquilino_telefone?: string | null;
  proprietario?: string | null;
}

export interface InadTransacaoInput {
  descricao?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  data?: string | Date | null;
  status?: string | null;
}

export interface InadComprovanteInput {
  contratoId: number | string;
  ano: number;
  mes: number;
  recebido?: boolean | null;
}

export interface InadimplenciaItem {
  contrato_id: string;
  titulo: string;
  inquilino: string;
  inquilino_telefone: string | null;
  proprietario: string | null;
  valor_aluguel: number;
  dia_vencimento: number;
  meses_atrasados: number;
  valor_total_divida: number;
  dias_atraso: number;
  status_gravidade: GravidadeKey;
  ultimo_pagamento: string | null;
}

export function normalizeContratoStatus(status: unknown): string {
  return String(status || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isLocacaoAtiva(c: InadContratoInput): boolean {
  return c.tipo === "Locação" && normalizeContratoStatus(c.status) === "ativo";
}

export function resolveTitulo(c: InadContratoInput): string {
  return String(c.title ?? c.titulo ?? "").trim();
}

export function resolveValorAluguel(c: InadContratoInput): number {
  const n = Number(c.value ?? c.valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function resolveDiaVencimento(c: InadContratoInput): number {
  const d = Number(c.diaVencimentoAluguel ?? c.dia_vencimento_aluguel ?? 10);
  if (!Number.isFinite(d) || d < 1) return 10;
  return Math.min(31, Math.floor(d));
}

export function resolveInquilino(c: InadContratoInput): string {
  return String(c.inquilino || c.cliente || "—");
}

export function resolveTelefone(c: InadContratoInput): string | null {
  const t = c.inquilinoTelefone ?? c.inquilino_telefone;
  if (t == null || String(t).trim() === "") return null;
  return String(t);
}

export function classifyGravidade(diasAtraso: number): GravidadeKey {
  if (diasAtraso > 60) return "critico";
  if (diasAtraso > 30) return "grave";
  if (diasAtraso > 15) return "moderado";
  return "leve";
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function subMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() - n, d.getDate());
}

function differenceInDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function parseData(raw: string | Date | null | undefined): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const s = String(raw).trim();
  if (!s) return null;
  // DATEONLY / ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isPagamentoStatusOk(status: unknown): boolean {
  return PAGAMENTO_STATUS_OK.has(String(status || "").trim().toLowerCase());
}

function comprovantePagoNoMes(
  comps: InadComprovanteInput[] | undefined,
  contratoId: string | number,
  ref: Date
): boolean {
  if (!comps || !comps.length) return false;
  const ano = ref.getFullYear();
  const mes = ref.getMonth() + 1;
  const id = String(contratoId);
  return comps.some(
    c =>
      String(c.contratoId) === id &&
      Number(c.ano) === ano &&
      Number(c.mes) === mes &&
      !!c.recebido
  );
}

/**
 * Mesma regra do Lovable Inadimplencia.tsx:
 * - Locação ativa
 * - Últimos 3 meses sem pagamento de aluguel (entrada + categoria aluguel + status pago/confirmado)
 * - OU comprovante mensal recebido (adaptação VB Contratos)
 */
export function computeInadimplenciaItems(
  contratos: InadContratoInput[],
  transacoes: InadTransacaoInput[],
  opts?: { hoje?: Date; comprovantes?: InadComprovanteInput[] }
): InadimplenciaItem[] {
  const hoje = opts?.hoje ? new Date(opts.hoje) : new Date();
  hoje.setHours(12, 0, 0, 0);
  const comprovantes = opts?.comprovantes;

  const contratosLocacao = (contratos || []).filter(isLocacaoAtiva);
  const items: InadimplenciaItem[] = [];

  for (const contrato of contratosLocacao) {
    const titulo = resolveTitulo(contrato);
    const diaVenc = resolveDiaVencimento(contrato);
    const valorAluguel = resolveValorAluguel(contrato);

    const transacoesContrato = (transacoes || []).filter(
      t =>
        !!titulo &&
        String(t.descricao || "").includes(titulo) &&
        t.tipo === "entrada" &&
        t.categoria === "aluguel"
    );

    let mesesAtrasados = 0;
    let ultimoPagamento: string | null = null;

    for (let i = 0; i < MESES_JANELA; i++) {
      const mesRef = subMonths(hoje, i);
      const inicio = startOfMonth(mesRef);
      const fim = endOfMonth(mesRef);

      const pagamentoMes = transacoesContrato.find(t => {
        const dataT = parseData(t.data);
        if (!dataT) return false;
        const inRange =
          dataT.getTime() >= inicio.getTime() && dataT.getTime() <= fim.getTime();
        return inRange && isPagamentoStatusOk(t.status);
      });

      const pagoComprovante = comprovantePagoNoMes(comprovantes, contrato.id, mesRef);

      if (!pagamentoMes && !pagoComprovante) {
        const dataVenc = new Date(mesRef.getFullYear(), mesRef.getMonth(), diaVenc);
        if (dataVenc.getTime() < hoje.getTime()) {
          mesesAtrasados++;
        }
      } else if (!ultimoPagamento) {
        if (pagamentoMes?.data) {
          const d = parseData(pagamentoMes.data);
          ultimoPagamento = d ? toDateOnly(d) : String(pagamentoMes.data).slice(0, 10);
        } else {
          ultimoPagamento = toDateOnly(
            new Date(mesRef.getFullYear(), mesRef.getMonth(), diaVenc)
          );
        }
      }
    }

    if (mesesAtrasados > 0) {
      const mesAtrasadoMaisAntigo = subMonths(hoje, mesesAtrasados);
      const dataVencMaisAntiga = new Date(
        mesAtrasadoMaisAntigo.getFullYear(),
        mesAtrasadoMaisAntigo.getMonth(),
        diaVenc
      );
      const diasAtraso = differenceInDays(hoje, dataVencMaisAntiga);

      items.push({
        contrato_id: String(contrato.id),
        titulo: titulo || `Contrato #${contrato.id}`,
        inquilino: resolveInquilino(contrato),
        inquilino_telefone: resolveTelefone(contrato),
        proprietario: contrato.proprietario ? String(contrato.proprietario) : null,
        valor_aluguel: valorAluguel,
        dia_vencimento: diaVenc,
        meses_atrasados: mesesAtrasados,
        valor_total_divida: valorAluguel * mesesAtrasados,
        dias_atraso: diasAtraso,
        status_gravidade: classifyGravidade(diasAtraso),
        ultimo_pagamento: ultimoPagamento
      });
    }
  }

  return items.sort((a, b) => b.dias_atraso - a.dias_atraso);
}

export function filterByGravidade(
  items: InadimplenciaItem[],
  filtro: string
): InadimplenciaItem[] {
  if (!filtro || filtro === "todos") return items;
  return items.filter(i => i.status_gravidade === filtro);
}

export function computeInadimplenciaMetrics(
  items: InadimplenciaItem[],
  contratosAtivos: number
) {
  const totalDivida = items.reduce((s, i) => s + i.valor_total_divida, 0);
  const totalInadimplentes = items.length;
  const taxaInadimplencia =
    contratosAtivos > 0
      ? ((totalInadimplentes / contratosAtivos) * 100).toFixed(1)
      : "0";
  const mediaAtraso =
    totalInadimplentes > 0
      ? Math.round(items.reduce((s, i) => s + i.dias_atraso, 0) / totalInadimplentes)
      : 0;
  return {
    totalDivida,
    totalInadimplentes,
    contratosAtivos,
    taxaInadimplencia,
    mediaAtraso
  };
}

export function chartGravidadeData(items: InadimplenciaItem[]) {
  return [
    { name: "Leve", value: items.filter(i => i.status_gravidade === "leve").length },
    {
      name: "Moderado",
      value: items.filter(i => i.status_gravidade === "moderado").length
    },
    { name: "Grave", value: items.filter(i => i.status_gravidade === "grave").length },
    {
      name: "Crítico",
      value: items.filter(i => i.status_gravidade === "critico").length
    }
  ].filter(d => d.value > 0);
}

export function chartValorPorGravidade(items: InadimplenciaItem[]) {
  return [
    {
      name: "Leve",
      valor: items
        .filter(i => i.status_gravidade === "leve")
        .reduce((s, i) => s + i.valor_total_divida, 0)
    },
    {
      name: "Moderado",
      valor: items
        .filter(i => i.status_gravidade === "moderado")
        .reduce((s, i) => s + i.valor_total_divida, 0)
    },
    {
      name: "Grave",
      valor: items
        .filter(i => i.status_gravidade === "grave")
        .reduce((s, i) => s + i.valor_total_divida, 0)
    },
    {
      name: "Crítico",
      valor: items
        .filter(i => i.status_gravidade === "critico")
        .reduce((s, i) => s + i.valor_total_divida, 0)
    }
  ].filter(d => d.valor > 0);
}

/** Alerta do mês corrente (paridade edge function alertas-inadimplencia). */
export function shouldAlertCurrentMonth(
  contrato: InadContratoInput,
  transacoes: InadTransacaoInput[],
  hoje = new Date(),
  comprovantes?: InadComprovanteInput[]
): { alert: boolean; diasAtraso: number; gravidadeLabel: string } {
  if (!isLocacaoAtiva(contrato)) {
    return { alert: false, diasAtraso: 0, gravidadeLabel: "" };
  }
  const diaVenc = resolveDiaVencimento(contrato);
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const dataVencimento = new Date(anoAtual, mesAtual, diaVenc);
  if (hoje.getTime() <= dataVencimento.getTime()) {
    return { alert: false, diasAtraso: 0, gravidadeLabel: "" };
  }

  const titulo = resolveTitulo(contrato);
  const inicio = startOfMonth(hoje);
  const fim = endOfMonth(hoje);

  const pagoTx = (transacoes || []).some(t => {
    if (
      !titulo ||
      !String(t.descricao || "").includes(titulo) ||
      t.tipo !== "entrada" ||
      t.categoria !== "aluguel" ||
      !isPagamentoStatusOk(t.status)
    ) {
      return false;
    }
    const dataT = parseData(t.data);
    if (!dataT) return false;
    return dataT.getTime() >= inicio.getTime() && dataT.getTime() <= fim.getTime();
  });

  const pagoComp = comprovantePagoNoMes(comprovantes, contrato.id, hoje);
  if (pagoTx || pagoComp) {
    return { alert: false, diasAtraso: 0, gravidadeLabel: "" };
  }

  const diasAtraso = differenceInDays(hoje, dataVencimento);
  let gravidadeLabel = "🟡 Leve";
  if (diasAtraso > 60) gravidadeLabel = "⚫ Crítico";
  else if (diasAtraso > 30) gravidadeLabel = "🔴 Grave";
  else if (diasAtraso > 15) gravidadeLabel = "🟠 Moderado";

  return { alert: true, diasAtraso, gravidadeLabel };
}

export function buildWhatsAppMessage(item: InadimplenciaItem, formatCurrency: (v: number) => string) {
  return `Olá ${item.inquilino}, identificamos que o aluguel referente ao contrato "${item.titulo}" encontra-se em atraso de ${item.dias_atraso} dia(s). Valor pendente: ${formatCurrency(item.valor_total_divida)}. Por favor, entre em contato para regularizar.`;
}

export function whatsappUrl(telefone: string, text: string): string {
  const digits = String(telefone || "").replace(/\D/g, "");
  return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`;
}
