/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import { FORMAS_PAGAMENTO, STATUS_PROPOSTA, formatBRL } from "./realtyCrm";

const statusLabel = (id) => STATUS_PROPOSTA.find((s) => s.id === id)?.label || id;
const pgtoLabel = (id) => FORMAS_PAGAMENTO.find((f) => f.id === id)?.label || id || "—";

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
};

const openPrintWindow = (title, bodyHtml) => {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #1e293b; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .sub { color: #64748b; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
      th { background: #f1f5f9; }
      .summary { margin-top: 16px; display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; }
      .summary span { background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 8px; }
      .block { margin-bottom: 10px; }
      .label { color: #64748b; font-size: 11px; }
      .val { font-size: 13px; font-weight: 600; }
    </style>
  </head><body>${bodyHtml}</body></html>`);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
};

export function exportPropostasPDF({ propostas, imoveis, brandName, filterLabel }) {
  const getImovel = (id) => {
    if (!id) return "—";
    const found = imoveis.find((i) => Number(i.id) === Number(id));
    return found?.title || "—";
  };

  const emNegociacao = propostas.filter((p) => p.status === "em_negociacao");
  const aceitas = propostas.filter((p) => p.status === "aceita");

  const rows = propostas
    .map(
      (p) => `<tr>
        <td>P${p.numeroProposta || p.id}</td>
        <td>${p.clienteNome || p.title || "—"}</td>
        <td>${getImovel(p.imovelId)}</td>
        <td>${formatBRL(p.value)}</td>
        <td>${pgtoLabel(p.paymentMethod)}</td>
        <td>${statusLabel(p.status)}</td>
        <td>${fmtDate(p.createdAt)}</td>
      </tr>`
    )
    .join("");

  openPrintWindow(
    "Relatório de Propostas",
    `<h1>${brandName ? `${brandName} — ` : ""}Relatório de Propostas</h1>
     <div class="sub">${filterLabel || `${propostas.length} proposta(s)`} • Gerado em ${fmtDate(new Date())}</div>
     <table>
       <thead><tr>
         <th>Nº</th><th>Cliente</th><th>Imóvel</th><th>Valor</th><th>Pagamento</th><th>Status</th><th>Data</th>
       </tr></thead>
       <tbody>${rows || "<tr><td colspan='7'>Nenhuma proposta</td></tr>"}</tbody>
     </table>
     <div class="summary">
       <span>Total: <strong>${propostas.length}</strong></span>
       <span>Em Negociação: <strong>${emNegociacao.length}</strong></span>
       <span>Aceitas: <strong>${aceitas.length}</strong></span>
       <span>Valor em Negociação: <strong>${formatBRL(emNegociacao.reduce((s, p) => s + Number(p.value || 0), 0))}</strong></span>
     </div>`
  );
}

export function exportPropostaIndividualPDF({ proposta, imovelTitulo, brandName }) {
  if (!proposta) return;
  openPrintWindow(
    `Proposta P${proposta.numeroProposta || proposta.id}`,
    `<h1>${brandName ? `${brandName} — ` : ""}Proposta P${proposta.numeroProposta || proposta.id}</h1>
     <div class="sub">Gerado em ${fmtDate(new Date())}</div>
     <div class="block"><div class="label">Cliente</div><div class="val">${proposta.clienteNome || proposta.title || "—"}</div></div>
     <div class="block"><div class="label">Telefone</div><div class="val">${proposta.clienteTelefone || "—"}</div></div>
     <div class="block"><div class="label">Email</div><div class="val">${proposta.clienteEmail || "—"}</div></div>
     <div class="block"><div class="label">Imóvel</div><div class="val">${imovelTitulo || "—"}</div></div>
     <div class="block"><div class="label">Valor</div><div class="val">${formatBRL(proposta.value)}</div></div>
     <div class="block"><div class="label">Forma de Pagamento</div><div class="val">${pgtoLabel(proposta.paymentMethod)}</div></div>
     <div class="block"><div class="label">Status</div><div class="val">${statusLabel(proposta.status)}</div></div>
     <div class="block"><div class="label">Prazo do Contrato</div><div class="val">${proposta.prazoContrato || "—"}</div></div>
     <div class="block"><div class="label">Condições Especiais</div><div class="val">${proposta.conditions || "—"}</div></div>
     <div class="block"><div class="label">Observações</div><div class="val">${proposta.notes || "—"}</div></div>
     <div class="block"><div class="label">Data</div><div class="val">${fmtDate(proposta.createdAt)}</div></div>`
  );
}
