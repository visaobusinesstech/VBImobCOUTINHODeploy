/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import * as XLSX from "xlsx";
import {
  formatBRL,
  imovelPurposeLabel,
  imovelStatusLabel,
} from "./realtyCrm";

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
};

const openPrintWindow = (title, bodyHtml) => {
  const win = window.open("", "_blank", "noopener,noreferrer,width=980,height=720");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: "Plus Jakarta Sans", Inter, Arial, sans-serif; color: #2b3340; padding: 24px; }
      h1 { font-size: 20px; margin: 0 0 4px; color: #2673d9; }
      .sub { color: #737d8c; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #e2e6ee; padding: 8px; text-align: left; }
      th { background: #f7f9fc; }
      .summary { margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; }
      .summary span { background: #f7f9fc; border: 1px solid #e2e6ee; padding: 8px 12px; border-radius: 8px; }
    </style>
  </head><body>${bodyHtml}</body></html>`);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
};

export function exportImoveisPDF({ imoveis, brandName, filterLabel }) {
  const vendas = imoveis.filter((i) => i.purpose === "venda" || i.purpose === "ambos").length;
  const alugueis = imoveis.filter((i) => i.purpose === "aluguel" || i.purpose === "ambos").length;
  const totalValor = imoveis.reduce((s, i) => s + (Number(i.price) || 0), 0);

  const rows = imoveis
    .map(
      (i) => `<tr>
        <td>${i.code || "—"}</td>
        <td>${i.title || "—"}</td>
        <td>${i.type || "—"}</td>
        <td>${imovelPurposeLabel(i.purpose)}</td>
        <td>${formatBRL(i.price)}</td>
        <td>${i.bedrooms ?? "—"}</td>
        <td>${i.areaM2 ? `${i.areaM2}m²` : "—"}</td>
        <td>${[i.neighborhood, i.city].filter(Boolean).join(", ") || "—"}</td>
        <td>${imovelStatusLabel(i.status)}</td>
        <td>${i.portalOrigem || "—"}</td>
      </tr>`
    )
    .join("");

  openPrintWindow(
    "Relatório de Imóveis",
    `<h1>${brandName ? `${brandName} — ` : ""}Relatório de Imóveis</h1>
     <div class="sub">${filterLabel || `${imoveis.length} imóvel(is)`} • Gerado em ${fmtDate(new Date())}</div>
     <table>
       <thead><tr>
         <th>Código</th><th>Título</th><th>Tipo</th><th>Operação</th><th>Preço</th>
         <th>Quartos</th><th>Área</th><th>Localização</th><th>Status</th><th>Portal</th>
       </tr></thead>
       <tbody>${rows || "<tr><td colspan='10'>Nenhum imóvel</td></tr>"}</tbody>
     </table>
     <div class="summary">
       <span>Total: <strong>${imoveis.length}</strong></span>
       <span>Venda: <strong>${vendas}</strong></span>
       <span>Aluguel: <strong>${alugueis}</strong></span>
       <span>Valor Total: <strong>${formatBRL(totalValor)}</strong></span>
     </div>`
  );
}

export function exportImoveisExcel({ imoveis }) {
  const rows = imoveis.map((i) => ({
    Código: i.code || "",
    Título: i.title || "",
    Tipo: i.type || "",
    Operação: imovelPurposeLabel(i.purpose),
    Preço: formatBRL(i.price),
    Quartos: i.bedrooms ?? "",
    Banheiros: i.bathrooms ?? "",
    Vagas: i.parkingSpots ?? "",
    "Área (m²)": i.areaM2 ?? "",
    Endereço: i.address || "",
    Bairro: i.neighborhood || "",
    Cidade: i.city || "",
    Status: imovelStatusLabel(i.status),
    "Portal de Origem": i.portalOrigem || "",
    "Link do Anúncio": i.urlAnuncio || "",
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Imóveis");
  XLSX.writeFile(book, `imoveis_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
