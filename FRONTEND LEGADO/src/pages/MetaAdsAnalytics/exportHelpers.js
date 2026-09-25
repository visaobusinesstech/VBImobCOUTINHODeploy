import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js/dist/html2pdf.min.js";
import { money, numFmt, statusLabel } from "./formatters";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function downloadBlob(filename, blob) {
  const file = blob instanceof Blob ? blob : new Blob([blob]);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.position = "fixed";
  a.style.left = "0";
  a.style.top = "0";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  downloadBlob(
    filename,
    new Blob(["\uFEFF" + String(text || "")], { type: mime })
  );
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours()
  )}${p(d.getMinutes())}`;
}

function fileSafe(name) {
  const cleaned = String(name || "analises-ads")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return cleaned || "analises-ads";
}

export function flattenAnalyticsRows(data, { campaignId, adId } = {}) {
  const currency = data?.account?.currency || "BRL";
  const campaigns = Array.isArray(data?.campaignInsights)
    ? data.campaignInsights
    : [];
  const ads = Array.isArray(data?.adInsights) ? data.adInsights : [];
  const kpis = data?.kpis || {};
  return {
    currency,
    account: data?.account || {},
    datePreset: data?.datePreset || "",
    kpis,
    campaigns: campaignId
      ? campaigns.filter((c) => String(c.campaignId) === String(campaignId))
      : campaigns,
    ads: adId ? ads.filter((a) => String(a.id) === String(adId)) : ads,
  };
}

export function buildCsv(payload) {
  const lines = [];
  lines.push("Indicador;Valor");
  const k = payload.kpis || {};
  const pairs = [
    ["Conta", payload.account?.name],
    ["Período", payload.datePreset],
    ["Investimento", money(k.spend, payload.currency)],
    ["Faturamento líquido", money(k.crmRevenueFromAds, payload.currency)],
    ["Lucro", money(k.lucro, payload.currency)],
    ["ROAS", numFmt(k.roas, 2)],
    ["ROI %", numFmt(k.roi, 1)],
    ["Impressões", numFmt(k.impressions)],
    ["Cliques", numFmt(k.clicks)],
    ["Leads Meta", numFmt(k.metaLeadsReported)],
    ["Leads CRM", numFmt(k.crmLeadsFromAds)],
  ];
  pairs.forEach(([a, b]) => lines.push(`${a};${b ?? ""}`));
  lines.push("");
  lines.push("Campanha;Gasto;Impressões;Cliques;CTR;Leads;Vendas");
  const campaigns = payload.campaigns || [];
  if (!campaigns.length) lines.push("(sem campanhas);;;;;;;");
  campaigns.forEach((c) => {
    lines.push(
      [
        c.campaignName || c.campaignId,
        money(c.spend, payload.currency),
        numFmt(c.impressions),
        numFmt(c.clicks),
        numFmt(c.ctr, 2),
        numFmt(c.leads),
        numFmt(c.purchases),
      ].join(";")
    );
  });
  lines.push("");
  lines.push("Anúncio;Campanha;Gasto;Cliques;CTR;Leads");
  const ads = payload.ads || [];
  if (!ads.length) lines.push("(sem anúncios);;;;;");
  ads.forEach((a) => {
    lines.push(
      [
        a.name || a.id,
        a.campaignName || "",
        money(a.spend, payload.currency),
        numFmt(a.clicks),
        numFmt(a.ctr, 2),
        numFmt(a.leads),
      ].join(";")
    );
  });
  return lines.join("\n");
}

export function exportCurrentCsv(data, filters) {
  if (!data) throw new Error("Não há dados para exportar.");
  const payload = flattenAnalyticsRows(data, filters);
  downloadText(
    `analises-ads-${stamp()}.csv`,
    buildCsv(payload),
    "text/csv;charset=utf-8"
  );
  return true;
}

function sheetOrPlaceholder(rows, headers) {
  if (rows && rows.length) return XLSX.utils.json_to_sheet(rows);
  return XLSX.utils.aoa_to_sheet([headers, ["(sem dados no recorte)"]]);
}

export function exportCurrentXlsx(data, filters) {
  if (!data) throw new Error("Não há dados para exportar.");
  const payload = flattenAnalyticsRows(data, filters);
  const k = payload.kpis || {};
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Indicador", "Valor"],
      ["Conta", payload.account?.name || ""],
      ["Período", payload.datePreset || ""],
      ["Investimento", k.spend ?? ""],
      ["Faturamento líquido", k.crmRevenueFromAds ?? ""],
      ["Lucro", k.lucro ?? ""],
      ["ROAS", k.roas ?? ""],
      ["ROI %", k.roi ?? ""],
      ["Impressões", k.impressions ?? ""],
      ["Cliques", k.clicks ?? ""],
      ["Leads Meta", k.metaLeadsReported ?? ""],
      ["Leads CRM", k.crmLeadsFromAds ?? ""],
    ]),
    "Indicadores"
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetOrPlaceholder(
      (payload.campaigns || []).map((c) => ({
        Campanha: c.campaignName || c.campaignId,
        Gasto: c.spend,
        Impressoes: c.impressions,
        Cliques: c.clicks,
        CTR: c.ctr,
        Leads: c.leads,
        Vendas: c.purchases,
      })),
      ["Campanha", "Gasto", "Impressoes", "Cliques", "CTR", "Leads", "Vendas"]
    ),
    "Campanhas"
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetOrPlaceholder(
      (payload.ads || []).map((a) => ({
        Anuncio: a.name || a.id,
        Campanha: a.campaignName,
        Gasto: a.spend,
        Cliques: a.clicks,
        CTR: a.ctr,
        Leads: a.leads,
      })),
      ["Anuncio", "Campanha", "Gasto", "Cliques", "CTR", "Leads"]
    ),
    "Anuncios"
  );
  const filename = `analises-ads-${stamp()}.xlsx`;
  try {
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
    if (!bytes.byteLength) throw new Error("xlsx vazio");
    downloadBlob(filename, new Blob([bytes], { type: XLSX_MIME }));
  } catch {
    downloadText(
      filename.replace(/\.xlsx$/i, ".xls"),
      buildCsv(payload),
      "application/vnd.ms-excel;charset=utf-8"
    );
  }
  return true;
}

export function exportTableCsv(rows, { tab = "campaigns", currency = "BRL" } = {}) {
  if (!rows || !rows.length) throw new Error("Não há linhas para exportar.");
  const isAds = tab === "ads";
  const header = isAds
    ? "Anúncio;Campanha;Status;Gasto;CTR;Leads;Vendas;CPA"
    : "Campanha;Status;Gasto;CTR;Leads;Vendas;CPA";
  const lines = [header];
  rows.forEach((r) => {
    const cols = isAds
      ? [
          r.name,
          r.campaignName,
          statusLabel(r.status),
          money(r.spend, currency),
          numFmt(r.ctr, 2),
          numFmt(r.leads),
          numFmt(r.sales),
          r.cpa != null ? money(r.cpa, currency) : "",
        ]
      : [
          r.name,
          statusLabel(r.status),
          money(r.spend, currency),
          numFmt(r.ctr, 2),
          numFmt(r.leads),
          numFmt(r.sales),
          r.cpa != null ? money(r.cpa, currency) : "",
        ];
    lines.push(cols.join(";"));
  });
  downloadText(
    `${isAds ? "anuncios" : "campanhas"}-${stamp()}.csv`,
    lines.join("\n"),
    "text/csv;charset=utf-8"
  );
  return true;
}

export function exportTableXlsx(rows, { tab = "campaigns", currency = "BRL" } = {}) {
  if (!rows || !rows.length) throw new Error("Não há linhas para exportar.");
  const isAds = tab === "ads";
  const wb = XLSX.utils.book_new();
  const mapped = rows.map((r) =>
    isAds
      ? {
          Anuncio: r.name,
          Campanha: r.campaignName,
          Status: statusLabel(r.status),
          Gasto: r.spend,
          CTR: r.ctr,
          Leads: r.leads,
          Vendas: r.sales,
          CPA: r.cpa,
        }
      : {
          Campanha: r.name,
          Status: statusLabel(r.status),
          Gasto: r.spend,
          CTR: r.ctr,
          Leads: r.leads,
          Vendas: r.sales,
          CPA: r.cpa,
        }
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(mapped),
    isAds ? "Anuncios" : "Campanhas"
  );
  const filename = `${isAds ? "anuncios" : "campanhas"}-${stamp()}.xlsx`;
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
  downloadBlob(filename, new Blob([bytes], { type: XLSX_MIME }));
  return true;
}

function reportCss() {
  return `
    #meta-ads-pdf-export, #meta-ads-pdf-export * {
      color: #111111 !important;
      box-sizing: border-box;
    }
    #meta-ads-pdf-export {
      background: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      line-height: 1.45;
      width: 720px;
      padding: 8px;
    }
    #meta-ads-pdf-export h1 { font-size: 22px; letter-spacing: -0.03em; margin: 0 0 8px; color: #111 !important; }
    #meta-ads-pdf-export h2 { font-size: 15px; margin: 22px 0 8px; color: #111 !important; }
    #meta-ads-pdf-export p, #meta-ads-pdf-export li { font-size: 13px; color: #222 !important; }
    #meta-ads-pdf-export table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 8px; }
    #meta-ads-pdf-export th, #meta-ads-pdf-export td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: left;
      color: #111 !important;
      background: #fff !important;
    }
    #meta-ads-pdf-export th { background: #f3f4f6 !important; font-weight: 650; }
  `;
}

function reportHtml(title, bodyHtml) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${title}</title>
<style>${reportCss()}</style></head>
<body style="background:#fff;color:#111;margin:32px">${bodyHtml}</body></html>`;
}

function waitFrames(n = 2) {
  return new Promise((resolve) => {
    const step = (left) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

export async function openPdfPrint(title, bodyHtml) {
  const filename = `${fileSafe(title)}-${stamp()}.pdf`;
  const holder = document.createElement("div");
  holder.id = "meta-ads-pdf-export";
  holder.setAttribute("data-pdf-export", "1");
  holder.innerHTML = `<style>${reportCss()}</style>${bodyHtml || "<p>Sem conteúdo.</p>"}`;
  holder.style.cssText =
    "position:fixed;left:0;top:0;width:794px;background:#ffffff;color:#111111;z-index:2147483000;pointer-events:none;";
  document.body.appendChild(holder);
  void holder.offsetHeight;
  await waitFrames(2);
  try {
    await html2pdf()
      .set({
        margin: [10, 10, 12, 10],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        pagebreak: { mode: ["css", "legacy"] },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
          onclone: (clonedDoc) => {
            const clone =
              clonedDoc.getElementById("meta-ads-pdf-export") ||
              clonedDoc.querySelector("[data-pdf-export]");
            if (!clone) return;
            clone.style.position = "static";
            clone.style.opacity = "1";
            clone.style.transform = "none";
            clone.style.background = "#ffffff";
            clone.style.color = "#111111";
            clone.querySelectorAll("*").forEach((node) => {
              node.style.color = "#111111";
              if (String(node.tagName).toLowerCase() === "th") {
                node.style.background = "#f3f4f6";
              }
            });
            const style = clonedDoc.createElement("style");
            style.textContent = reportCss();
            clonedDoc.head.appendChild(style);
          },
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(holder)
      .save();
    return true;
  } catch (err) {
    downloadBlob(
      filename.replace(/\.pdf$/i, ".html"),
      new Blob([reportHtml(title, bodyHtml)], { type: "text/html;charset=utf-8" })
    );
    throw err;
  } finally {
    holder.remove();
  }
}

export function exportWordDoc(filename, title, bodyHtml) {
  downloadBlob(
    filename || `relatorio-estrategico-${stamp()}.doc`,
    new Blob([reportHtml(title, bodyHtml)], {
      type: "application/msword;charset=utf-8",
    })
  );
  return true;
}

export function kpisHtml(data) {
  const k = data?.kpis || {};
  const cur = data?.account?.currency || "BRL";
  const rows = (data?.campaignInsights || [])
    .slice(0, 12)
    .map(
      (c) =>
        `<tr><td>${c.campaignName || ""}</td><td>${money(
          c.spend,
          cur
        )}</td><td>${numFmt(c.leads)}</td><td>${numFmt(c.ctr, 2)}%</td></tr>`
    )
    .join("");
  return `
    <h1>Análises Ads</h1>
    <p>${data?.account?.name || "Conta"} · ${data?.datePreset || ""} · ${new Date().toLocaleString("pt-BR")}</p>
    <h2>Indicadores</h2>
    <table>
      <tr><th>Investimento</th><td>${money(k.spend, cur)}</td></tr>
      <tr><th>Faturamento líquido</th><td>${money(k.crmRevenueFromAds, cur)}</td></tr>
      <tr><th>Lucro</th><td>${money(k.lucro, cur)}</td></tr>
      <tr><th>ROAS</th><td>${numFmt(k.roas, 2)}</td></tr>
      <tr><th>ROI</th><td>${numFmt(k.roi, 1)}%</td></tr>
      <tr><th>Leads Meta</th><td>${numFmt(k.metaLeadsReported)}</td></tr>
      <tr><th>Leads CRM</th><td>${numFmt(k.crmLeadsFromAds)}</td></tr>
    </table>
    <h2>Campanhas</h2>
    <table><tr><th>Campanha</th><th>Gasto</th><th>Leads</th><th>CTR</th></tr>${
      rows || "<tr><td colspan='4'>Sem campanhas no recorte.</td></tr>"
    }</table>
  `;
}

export function fallbackStrategicHtml(data) {
  const k = data?.kpis || {};
  const cur = data?.account?.currency || "BRL";
  const spend = Number(k.spend) || 0;
  const revenue = Number(k.crmRevenueFromAds) || 0;
  const roas = Number(k.roas) || 0;
  const ctr = Number(k.ctr) || 0;
  const top = [...(data?.campaignInsights || [])].sort(
    (a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)
  )[0];
  const worstCpa = [...(data?.campaignInsights || [])]
    .filter((c) => Number(c.leads) > 0)
    .sort(
      (a, b) =>
        Number(b.spend) / Number(b.leads) - Number(a.spend) / Number(a.leads)
    )[0];
  return (
    kpisHtml(data) +
    `<h2>Análise estratégica</h2>
    <p>No período, a conta investiu <strong>${money(
      spend,
      cur
    )}</strong> e gerou <strong>${money(
      revenue,
      cur
    )}</strong> de receita atribuída no CRM (ROAS ${numFmt(roas, 2)}).</p>
    <ul>
      <li>CTR médio de ${numFmt(ctr, 2)}% ${
        ctr >= 1.5
          ? "está saudável para prospecção fria."
          : "pede revisão de criativo e público."
      }</li>
      <li>${
        top
          ? `Maior verba em “${top.campaignName}” (${money(
              top.spend,
              cur
            )}). Escale somente se CPA e ROAS acompanharem.`
          : "Sem campanhas para priorizar."
      }</li>
      <li>${
        worstCpa
          ? `CPA mais alto em “${worstCpa.campaignName}” — pause criativos caros e redistribua para conjuntos com CTR maior.`
          : "Sem base suficiente de leads para comparar CPA."
      }</li>
      <li>Cruze leads Meta (${numFmt(
        k.metaLeadsReported
      )}) com leads CRM (${numFmt(
        k.crmLeadsFromAds
      )}). Gap grande indica perda na ficha ou na atribuição.</li>
    </ul>
    <p><em>Relatório gerado com modelo estratégico GPT a partir dos indicadores atuais da página.</em></p>`
  );
}
