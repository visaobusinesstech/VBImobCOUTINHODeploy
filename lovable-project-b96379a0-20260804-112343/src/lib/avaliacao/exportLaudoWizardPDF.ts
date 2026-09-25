import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { WizardState } from "@/components/avaliacao/wizard/types";

interface Args {
  state: WizardState;
  imobiliaria: {
    nome: string;
    creci?: string;
    telefone?: string;
    email?: string;
    cnpj?: string;
    logo_url?: string | null;
  };
  usuario: { nome: string; email: string };
}

const fmt = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtM2 = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

async function dataURLfromUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportLaudoWizardPDF({ state, imobiliaria, usuario }: Args) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const MARGIN = 14;

  const versao = `v1 · ${new Date().toLocaleDateString("pt-BR")}`;
  const protocolo = `LAUDO-${Date.now().toString(36).toUpperCase()}`;

  // ===== CAPA =====
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, H, "F");

  // Faixa de destaque
  doc.setFillColor(59, 130, 246);
  doc.rect(0, H * 0.35, W, 4, "F");

  // Logo
  if (imobiliaria.logo_url) {
    const logo = await dataURLfromUrl(imobiliaria.logo_url);
    if (logo) {
      try { doc.addImage(logo, "PNG", MARGIN, MARGIN, 32, 32, undefined, "FAST"); } catch { /* ignore */ }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("LAUDO DE AVALIAÇÃO", MARGIN, H * 0.45);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 200, 240);
  doc.text("Imóvel — Metodologia ABNT NBR 14.653", MARGIN, H * 0.45 + 8);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  let y = H * 0.6;
  const imovel = state.imovel;
  doc.text(`${imovel.tipo} · ${imovel.finalidade}`, MARGIN, y); y += 6;
  doc.text(`${imovel.endereco || ""}`.trim() || "—", MARGIN, y); y += 6;
  doc.text(`${imovel.bairro} — ${imovel.cidade}/${imovel.estado}`, MARGIN, y);

  // Rodapé capa
  doc.setFontSize(9);
  doc.setTextColor(180, 200, 240);
  doc.text(imobiliaria.nome, MARGIN, H - 18);
  const subInfo = [imobiliaria.creci && `CRECI ${imobiliaria.creci}`, imobiliaria.cnpj && `CNPJ ${imobiliaria.cnpj}`, imobiliaria.telefone].filter(Boolean).join(" · ");
  doc.text(subInfo, MARGIN, H - 12);
  doc.text(`Protocolo ${protocolo} · ${versao}`, MARGIN, H - 6);

  // ===== PÁGINAS =====
  const header = (titulo: string) => {
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, W, 14, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(titulo, MARGIN, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${imobiliaria.nome} · ${protocolo}`, W - MARGIN, 9, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  const footer = (pageLabel: string) => {
    doc.setDrawColor(220);
    doc.line(MARGIN, H - 10, W - MARGIN, H - 10);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Documento gerado em ${new Date().toLocaleString("pt-BR")} · ${pageLabel}`, MARGIN, H - 5);
    doc.text(versao, W - MARGIN, H - 5, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  const newPage = (titulo: string, pageLabel: string) => {
    doc.addPage();
    header(titulo);
    footer(pageLabel);
  };

  // ----- Página: Dados do imóvel -----
  newPage("1. Dados do imóvel", "Página 2");
  let cy = 22;
  doc.setFontSize(10);
  const pairs: Array<[string, string]> = [
    ["Tipo", imovel.tipo], ["Finalidade", imovel.finalidade],
    ["Padrão construtivo", imovel.padrao_construtivo], ["Conservação", imovel.estado_conservacao],
    ["Endereço", imovel.endereco || "—"], ["CEP", imovel.cep || "—"],
    ["Bairro", imovel.bairro || "—"], ["Cidade/UF", `${imovel.cidade}/${imovel.estado}`],
    ["Área construída", `${imovel.area_construida || "—"} m²`],
    ["Área do terreno", `${imovel.area_terreno || "—"} m²`],
    ["Idade", `${imovel.idade || "—"} anos`],
    ["Quartos / Suítes", `${imovel.quartos || 0} / ${imovel.suites || 0}`],
    ["Banheiros / Garagens", `${imovel.banheiros || 0} / ${imovel.garagens || 0}`],
    ["Área de lazer", `${imovel.area_lazer || "—"} m²`],
  ];
  pairs.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (W / 2 - MARGIN);
    const py = cy + row * 7;
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, x, py);
    doc.setFont("helvetica", "normal");
    doc.text(String(v).slice(0, 50), x + 38, py);
  });
  cy += Math.ceil(pairs.length / 2) * 7 + 4;

  if (imovel.caracteristicas) {
    doc.setFont("helvetica", "bold");
    doc.text("Características especiais:", MARGIN, cy); cy += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(imovel.caracteristicas, W - 2 * MARGIN);
    doc.text(lines, MARGIN, cy);
  }

  // ----- Página: Comparáveis -----
  newPage("2. Pesquisa de mercado", "Página 3");
  cy = 22;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  ["#", "Endereço/Bairro", "Área", "V.Anunc.", "V.Negoc.", "R$/m²"].forEach((h, i) => {
    const xs = [MARGIN, MARGIN + 10, MARGIN + 95, MARGIN + 115, MARGIN + 145, MARGIN + 170];
    doc.text(h, xs[i], cy);
  });
  cy += 4;
  doc.setDrawColor(200);
  doc.line(MARGIN, cy, W - MARGIN, cy);
  cy += 3;
  doc.setFont("helvetica", "normal");
  state.comparaveis.forEach((c, i) => {
    if (cy > H - 20) { newPage("2. Pesquisa de mercado (cont.)", "Página 3+"); cy = 22; }
    const v = c.valor_negociado || c.valor_anunciado;
    const pm2 = c.area > 0 ? v / c.area : 0;
    const xs = [MARGIN, MARGIN + 10, MARGIN + 95, MARGIN + 115, MARGIN + 145, MARGIN + 170];
    doc.text(String(i + 1), xs[0], cy);
    doc.text((c.endereco || c.bairro || "—").slice(0, 50), xs[1], cy);
    doc.text(`${c.area}m²`, xs[2], cy);
    doc.text(fmt(c.valor_anunciado), xs[3], cy);
    doc.text(c.valor_negociado ? fmt(c.valor_negociado) : "—", xs[4], cy);
    doc.text(fmtM2(pm2), xs[5], cy);
    cy += 5;
  });

  // ----- Página: Homogeneização -----
  if (state.resultado) {
    newPage("3. Memória de cálculo (homogeneização)", "Página 4");
    cy = 22;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("# | Bruto R$/m² | Fator | Hom. R$/m² | V. total hom.", MARGIN, cy); cy += 5;
    doc.setFont("helvetica", "normal");
    state.resultado.comparaveis.forEach((h, i) => {
      if (cy > H - 20) { newPage("3. Memória de cálculo (cont.)", "Página 4+"); cy = 22; }
      doc.text(
        `${i + 1} | ${fmtM2(h.preco_m2_bruto)} | ${h.fator_total.toFixed(3)} | ${fmtM2(h.preco_m2_homogeneizado)} | ${fmt(h.valor_total_homogeneizado)}`,
        MARGIN, cy,
      );
      cy += 4;
    });

    // ----- Página: Resultado -----
    newPage("4. Resultado da avaliação", "Página 5");
    cy = 24;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Estatísticas (R$/m²)", MARGIN, cy); cy += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const r = state.resultado.precoM2;
    [
      ["Média", fmtM2(r.media)],
      ["Mediana", fmtM2(r.mediana)],
      ["Mínimo", fmtM2(r.min)],
      ["Máximo", fmtM2(r.max)],
      ["Desvio padrão", fmtM2(r.desvioPadrao)],
      ["Coef. de variação", `${r.coeficienteVariacao.toFixed(1)}%`],
      ["IC 95% inferior", fmtM2(r.intervaloConfianca.inferior)],
      ["IC 95% superior", fmtM2(r.intervaloConfianca.superior)],
    ].forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MARGIN + col * (W / 2 - MARGIN);
      const py = cy + row * 6;
      doc.setFont("helvetica", "bold");
      doc.text(`${k}:`, x, py);
      doc.setFont("helvetica", "normal");
      doc.text(v, x + 38, py);
    });
    cy += Math.ceil(8 / 2) * 6 + 8;

    // Valor final - bloco destacado
    doc.setFillColor(59, 130, 246);
    doc.rect(MARGIN, cy, W - 2 * MARGIN, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("VALOR FINAL SUGERIDO", MARGIN + 4, cy + 7);
    doc.setFontSize(18);
    doc.text(fmt(state.resultado.valorFinal.sugerido), MARGIN + 4, cy + 17);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Faixa IC 95%: ${fmt(state.resultado.valorFinal.minimo)} — ${fmt(state.resultado.valorFinal.maximo)}`,
      MARGIN + 4, cy + 23,
    );
    doc.setTextColor(0, 0, 0);
    cy += 32;

    doc.setFontSize(9);
    doc.text(`Qualidade: ${state.resultado.qualidade.mensagem}`, MARGIN, cy);
  }

  // ----- Fundamentação e conclusão (IA) -----
  if (state.iaAnalise) {
    newPage("5. Fundamentação técnica", "Página 6");
    cy = 22;
    doc.setFontSize(10);
    const fund = doc.splitTextToSize(state.iaAnalise.fundamentacao || "—", W - 2 * MARGIN);
    doc.text(fund, MARGIN, cy);
    cy += fund.length * 5 + 6;

    if (cy > H - 60) { newPage("6. Conclusão", "Página 7"); cy = 22; }
    doc.setFont("helvetica", "bold");
    doc.text("Conclusão", MARGIN, cy); cy += 6;
    doc.setFont("helvetica", "normal");
    const conc = doc.splitTextToSize(state.iaAnalise.conclusao || "—", W - 2 * MARGIN);
    doc.text(conc, MARGIN, cy);
  }

  // ----- Assinatura + QR -----
  newPage("7. Assinatura e validação", "Página final");
  cy = 30;
  doc.setFontSize(10);
  doc.text("Avaliador responsável", MARGIN, cy); cy += 6;
  doc.line(MARGIN, cy + 12, MARGIN + 90, cy + 12);
  doc.text(usuario.nome || imobiliaria.nome, MARGIN, cy + 18);
  if (imobiliaria.creci) doc.text(`CRECI: ${imobiliaria.creci}`, MARGIN, cy + 24);

  try {
    const qrData = await QRCode.toDataURL(
      `${typeof window !== "undefined" ? window.location.origin : ""}/avaliacao/validar/${protocolo}`,
      { width: 200, margin: 1 },
    );
    doc.addImage(qrData, "PNG", W - MARGIN - 35, cy, 35, 35);
    doc.setFontSize(8);
    doc.text("Validação", W - MARGIN - 35, cy + 40);
    doc.text(protocolo, W - MARGIN - 35, cy + 44);
  } catch { /* ignore */ }

  doc.save(`laudo-${protocolo}.pdf`);
}
