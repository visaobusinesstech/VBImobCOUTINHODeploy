/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import {
  formatBRL,
  imovelPurposeLabel,
  mediaUrl,
} from "./realtyCrm";

const bool = (v) => (v ? "Sim" : "Não");

const fmtDateTime = () => {
  const d = new Date();
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

function buildRows(imoveis) {
  return [
    { label: "Tipo", values: imoveis.map((i) => i.type || "—") },
    {
      label: "Operação",
      values: imoveis.map((i) => imovelPurposeLabel(i.purpose)),
    },
    { label: "Preço", values: imoveis.map((i) => formatBRL(i.price)) },
    {
      label: "Área (m²)",
      values: imoveis.map((i) => (i.areaM2 != null ? i.areaM2 : "—")),
    },
    {
      label: "Preço/m²",
      values: imoveis.map((i) => {
        const area = Number(i.areaM2) || 0;
        const price = Number(i.price) || 0;
        return area > 0 ? formatBRL(Math.round(price / area)) : "—";
      }),
    },
    { label: "Quartos", values: imoveis.map((i) => i.bedrooms ?? "—") },
    { label: "Suítes", values: imoveis.map((i) => i.suites ?? "—") },
    { label: "Banheiros", values: imoveis.map((i) => i.bathrooms ?? "—") },
    { label: "Vagas", values: imoveis.map((i) => i.parkingSpots ?? "—") },
    { label: "Andar", values: imoveis.map((i) => i.andar || "—") },
    {
      label: "Posição Solar",
      values: imoveis.map((i) => i.posicaoSolar || "—"),
    },
    { label: "Bairro", values: imoveis.map((i) => i.neighborhood || "—") },
    { label: "Cidade", values: imoveis.map((i) => i.city || "—") },
    {
      label: "Condomínio",
      values: imoveis.map((i) =>
        Number(i.condoFee) > 0 ? formatBRL(i.condoFee) : "—"
      ),
    },
    {
      label: "IPTU",
      values: imoveis.map((i) => (Number(i.iptu) > 0 ? formatBRL(i.iptu) : "—")),
    },
    {
      label: "Custo Total/mês",
      values: imoveis.map((i) => {
        if (i.purpose !== "aluguel") return "N/A";
        return formatBRL(
          Number(i.price || 0) + Number(i.condoFee || 0) + Number(i.iptu || 0)
        );
      }),
    },
    {
      label: "Aceita Financiamento",
      values: imoveis.map((i) => bool(i.aceitaFinanciamento)),
    },
    { label: "Aceita FGTS", values: imoveis.map((i) => bool(i.aceitaFgts)) },
    {
      label: "Aceita Permuta",
      values: imoveis.map((i) => bool(i.aceitaPermuta)),
    },
    {
      label: "Tem Escritura",
      values: imoveis.map((i) => bool(i.temEscritura)),
    },
    { label: "Exclusivo", values: imoveis.map((i) => bool(i.exclusivo)) },
  ];
}

export function exportComparativoPDF({ imoveis, brandName }) {
  if (!imoveis || imoveis.length < 2) return;
  const brand = brandName || "VBSolution CRM";
  const rows = buildRows(imoveis);
  const titles = imoveis
    .map((im, idx) => `<div class="im-title">Imóvel ${idx + 1}: ${im.title || "—"}</div>`)
    .join("");

  const headCols = ["Característica", ...imoveis.map((_, i) => `Imóvel ${i + 1}`)]
    .map((h) => `<th>${h}</th>`)
    .join("");

  const body = rows
    .map((r) => {
      const cells = r.values
        .map((v, idx) => {
          const isPrice = r.label === "Preço";
          return `<td class="${isPrice ? "price" : ""}">${v ?? "—"}</td>`;
        })
        .join("");
      return `<tr><td class="label">${r.label}</td>${cells}</tr>`;
    })
    .join("");

  const win = window.open("", "_blank", "noopener,noreferrer,width=1100,height=720");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Comparativo de Imóveis</title>
    <style>
      body { font-family: "Plus Jakarta Sans", Inter, Arial, sans-serif; color: #2b3340; margin: 0; padding: 0; }
      .bar { background: #2673d9; color: #fff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
      .bar h1 { margin: 0; font-size: 18px; }
      .bar .right { text-align: right; }
      .bar .sub { font-size: 11px; opacity: 0.85; margin-top: 4px; }
      .wrap { padding: 20px; }
      .im-title { color: #2673d9; font-size: 13px; font-weight: 650; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 14px; }
      th, td { border: 1px solid #e2e6ee; padding: 8px; text-align: center; }
      th { background: #2673d9; color: #fff; }
      td.label { text-align: left; font-weight: 650; background: #f7f9fc; width: 160px; }
      td.price { color: #2673d9; font-weight: 700; }
      tr:nth-child(even) td:not(.label) { background: #f7f9fc; }
      .foot { margin-top: 18px; text-align: center; font-size: 11px; color: #94a3b8; }
      @media print { .bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
  </head><body>
    <div class="bar">
      <h1>${brand}</h1>
      <div class="right">
        <div>Comparativo de Imóveis</div>
        <div class="sub">Gerado em ${fmtDateTime()}</div>
      </div>
    </div>
    <div class="wrap">
      ${titles}
      <table>
        <thead><tr>${headCols}</tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="foot">${brand} — Documento gerado automaticamente para fins de apresentação.</div>
    </div>
  </body></html>`);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 280);
}
