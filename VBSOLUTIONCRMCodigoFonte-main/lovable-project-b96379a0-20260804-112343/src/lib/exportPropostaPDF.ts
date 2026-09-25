import { exportToPDF } from "./exportPDF";
import type { Proposta } from "@/hooks/usePropostas";
import { FORMAS_PAGAMENTO, STATUS_PROPOSTA } from "@/hooks/usePropostas";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

const statusLabel = (id: string) => STATUS_PROPOSTA.find(s => s.id === id)?.label || id;
const pgtoLabel = (id: string) => FORMAS_PAGAMENTO.find(f => f.id === id)?.label || id;

interface ExportPropostasOptions {
  propostas: Proposta[];
  imoveis: { id: string; titulo: string }[];
  brandName?: string;
  filterLabel?: string;
}

export function exportPropostasPDF({ propostas, imoveis, brandName, filterLabel }: ExportPropostasOptions) {
  const getImovel = (id: string | null) => {
    if (!id) return "—";
    return imoveis.find(i => i.id === id)?.titulo || "—";
  };

  const emNegociacao = propostas.filter(p => p.status === "em_negociacao");
  const aceitas = propostas.filter(p => p.status === "aceita");

  exportToPDF({
    title: "Relatório de Propostas",
    subtitle: filterLabel || `${propostas.length} proposta(s) • Gerado em ${fmtDate(new Date().toISOString())}`,
    brandName,
    columns: [
      { header: "Nº", dataKey: "numero" },
      { header: "Cliente", dataKey: "cliente" },
      { header: "Imóvel", dataKey: "imovel" },
      { header: "Valor", dataKey: "valor" },
      { header: "Pagamento", dataKey: "pagamento" },
      { header: "Status", dataKey: "status" },
      { header: "Data", dataKey: "data" },
    ],
    data: propostas.map(p => ({
      numero: `P${p.numero_proposta}`,
      cliente: p.cliente_nome,
      imovel: getImovel(p.imovel_id),
      valor: fmt(p.valor),
      pagamento: pgtoLabel(p.forma_pagamento),
      status: statusLabel(p.status),
      data: fmtDate(p.created_at),
    })),
    summary: [
      { label: "Total", value: String(propostas.length) },
      { label: "Em Negociação", value: String(emNegociacao.length) },
      { label: "Aceitas", value: String(aceitas.length) },
      { label: "Valor em Negociação", value: fmt(emNegociacao.reduce((s, p) => s + p.valor, 0)) },
    ],
  });
}
