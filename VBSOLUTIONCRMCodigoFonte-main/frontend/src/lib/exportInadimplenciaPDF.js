/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Exportação PDF do relatório de inadimplência (paridade Lovable).
 */

import { formatCurrency } from "../helpers/inadimplenciaCrm";

const GRAVIDADE_LABELS = {
  leve: "Leve (1-15d)",
  moderado: "Moderado (16-30d)",
  grave: "Grave (31-60d)",
  critico: "Crítico (60+d)",
};

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
};

/**
 * Gera relatório HTML imprimível / salvável como PDF (mesmo conteúdo do Lovable).
 * @returns {boolean} false se não houver inadimplentes
 */
export function exportInadimplenciaPDF({
  inadimplentes,
  contratosAtivos,
  brandName,
  brandCreci,
  brandCnpj,
  brandTelefone,
}) {
  if (!inadimplentes || inadimplentes.length === 0) return false;

  const empresa = brandName || "VB Solution";
  const dataAtual = new Date().toLocaleDateString("pt-BR");
  const totalDivida = inadimplentes.reduce((s, i) => s + i.valor_total_divida, 0);
  const totalInadimplentes = inadimplentes.length;
  const taxa =
    contratosAtivos > 0 ? ((totalInadimplentes / contratosAtivos) * 100).toFixed(1) : "0.0";
  const mediaAtraso =
    totalInadimplentes > 0
      ? Math.round(inadimplentes.reduce((s, i) => s + i.dias_atraso, 0) / totalInadimplentes)
      : 0;

  const byG = {
    critico: inadimplentes.filter((i) => i.status_gravidade === "critico"),
    grave: inadimplentes.filter((i) => i.status_gravidade === "grave"),
    moderado: inadimplentes.filter((i) => i.status_gravidade === "moderado"),
    leve: inadimplentes.filter((i) => i.status_gravidade === "leve"),
  };

  const maiorDivida = Math.max(...inadimplentes.map((i) => i.valor_total_divida));
  const maiorDevedor = inadimplentes.find((i) => i.valor_total_divida === maiorDivida);

  const distRows = ["leve", "moderado", "grave", "critico"]
    .map((g) => {
      const items = byG[g] || [];
      const val = items.reduce((s, i) => s + i.valor_total_divida, 0);
      const pct = totalDivida > 0 ? ((val / totalDivida) * 100).toFixed(1) + "%" : "0%";
      return `<tr><td>${GRAVIDADE_LABELS[g]}</td><td>${items.length}</td><td>${formatCurrency(val)}</td><td>${pct}</td></tr>`;
    })
    .join("");

  const detailBlocks = ["critico", "grave", "moderado", "leve"]
    .map((g) => {
      const items = byG[g] || [];
      if (!items.length) return "";
      const rows = items
        .map(
          (i) => `<tr>
          <td>${escapeHtml(i.titulo)}</td>
          <td>${escapeHtml(i.inquilino)}</td>
          <td>${escapeHtml(i.proprietario || "—")}</td>
          <td>${formatCurrency(i.valor_aluguel)}</td>
          <td>${i.meses_atrasados}x</td>
          <td><strong>${formatCurrency(i.valor_total_divida)}</strong></td>
          <td>${i.dias_atraso}d</td>
          <td>${i.ultimo_pagamento ? fmtDate(i.ultimo_pagamento) : "—"}</td>
        </tr>`
        )
        .join("");
      return `
        <h3 class="g-${g}">${GRAVIDADE_LABELS[g].toUpperCase()} — ${items.length} contrato(s)</h3>
        <table>
          <thead>
            <tr>
              <th>Contrato</th><th>Inquilino</th><th>Proprietário</th><th>Aluguel</th>
              <th>Meses</th><th>Dívida Total</th><th>Dias</th><th>Últ. Pgto</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Inadimplencia_${new Date().toISOString().split("T")[0]}</title>
<style>
  body { font-family: Inter, Geist, system-ui, sans-serif; color: #1e293b; margin: 24px; }
  .hdr { background: #991b1b; color: #fff; padding: 18px 20px; border-radius: 8px; margin-bottom: 20px; }
  .hdr h1 { margin: 0 0 6px; font-size: 20px; }
  .hdr p { margin: 0; font-size: 12px; opacity: .9; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
  .kpi span { display: block; font-size: 11px; color: #64748b; }
  .kpi strong { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #991b1b; color: #fff; }
  h2 { font-size: 14px; color: #991b1b; }
  h3 { font-size: 12px; color: #fff; padding: 6px 10px; border-radius: 4px; margin: 16px 0 8px; }
  .g-critico { background: #7f1d1d; }
  .g-grave { background: #dc2626; }
  .g-moderado { background: #f97316; }
  .g-leve { background: #eab308; color: #1e293b !important; }
  .insight { background: #fff7ed; border: 1px solid #f97316; border-radius: 8px; padding: 10px; font-size: 12px; margin-bottom: 16px; }
  .ft { margin-top: 24px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  @media print { body { margin: 12px; } .noprint { display: none; } }
</style>
</head>
<body>
  <div class="hdr">
    <h1>Relatório de Inadimplência</h1>
    <p>${escapeHtml(empresa)} — ${dataAtual}
      ${brandCreci ? ` · CRECI: ${escapeHtml(brandCreci)}` : ""}
      ${brandCnpj ? ` · CNPJ: ${escapeHtml(brandCnpj)}` : ""}
    </p>
  </div>

  <h2>RESUMO EXECUTIVO</h2>
  <div class="kpis">
    <div class="kpi"><span>Total em Atraso</span><strong>${formatCurrency(totalDivida)}</strong></div>
    <div class="kpi"><span>Contratos Inadimplentes</span><strong>${totalInadimplentes} de ${contratosAtivos}</strong></div>
    <div class="kpi"><span>Taxa de Inadimplência</span><strong>${taxa}%</strong></div>
    <div class="kpi"><span>Média de Atraso</span><strong>${mediaAtraso} dias</strong></div>
  </div>

  <h2>Distribuição por Gravidade</h2>
  <table>
    <thead><tr><th>Gravidade</th><th>Qtd Contratos</th><th>Valor Total</th><th>% do Total</th></tr></thead>
    <tbody>
      ${distRows}
      <tr><td><strong>TOTAL</strong></td><td><strong>${totalInadimplentes}</strong></td><td><strong>${formatCurrency(totalDivida)}</strong></td><td><strong>100%</strong></td></tr>
    </tbody>
  </table>

  ${
    maiorDevedor
      ? `<div class="insight"><strong>⚠ Maior devedor:</strong> ${escapeHtml(maiorDevedor.inquilino)} — ${formatCurrency(maiorDevedor.valor_total_divida)} (${maiorDevedor.meses_atrasados} mês(es), ${maiorDevedor.dias_atraso} dias)</div>`
      : ""
  }

  ${detailBlocks}

  <div class="ft">
    Gerado em ${new Date().toLocaleString("pt-BR")} · ${escapeHtml(empresa)}${brandTelefone ? ` · ${escapeHtml(brandTelefone)}` : ""}
  </div>
  <p class="noprint"><button onclick="window.print()">Imprimir / Salvar PDF</button></p>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default exportInadimplenciaPDF;
