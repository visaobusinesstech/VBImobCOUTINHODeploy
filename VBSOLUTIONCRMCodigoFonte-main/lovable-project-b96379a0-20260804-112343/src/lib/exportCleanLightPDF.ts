import jsPDF from "jspdf";

export interface CleanLightExportOptions {
  imovel: any;
  avaliacao: any;
  comparaveis: any[];
  brandName: string;
  corretorInfo?: { creci?: string; telefone?: string; email?: string; nome?: string };
  logoUrl?: string;
  profilePhotoUrl?: string;
  skipSave?: boolean;
}

const formatBRL = (v: number) =>
  v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "R$ 0";

const sanitize = (value: unknown, fallback = "—") => {
  const text = String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[•●▪▫◦]/g, "-")
    .replace(/[^\u0020-\u00FF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
};

const toArr = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") return value.split(/[,|\n]/).map((v) => v.trim()).filter(Boolean);
  return [];
};

const toNum = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// ─── Clean Light Palette ───
const WHITE: [number, number, number] = [255, 255, 255];
const BG_SOFT: [number, number, number] = [248, 250, 253];
const CARD_BG: [number, number, number] = [255, 255, 255];
const CARD_ACCENT: [number, number, number] = [240, 245, 255];
const TEXT_PRIMARY: [number, number, number] = [25, 35, 60];
const TEXT_SECONDARY: [number, number, number] = [70, 80, 105];
const TEXT_MUTED: [number, number, number] = [140, 150, 170];
const ACCENT_BLUE: [number, number, number] = [50, 100, 200];
const ACCENT_LIGHT_BLUE: [number, number, number] = [220, 232, 252];
const ACCENT_GREEN: [number, number, number] = [40, 170, 100];
const ACCENT_GOLD: [number, number, number] = [210, 165, 40];
const ACCENT_RED: [number, number, number] = [220, 70, 60];
const BORDER: [number, number, number] = [225, 230, 240];
const HEADER_BG: [number, number, number] = [35, 55, 100];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const loadImage = async (url: string): Promise<string | null> => {
  if (!url) return null;
  // Approach 1: fetch with CORS + cache-busting
  try {
    const fetchUrl = url.includes("?") ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    const resp = await fetch(fetchUrl, { mode: "cors", cache: "no-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    // Approach 2: simple fetch without CORS options
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("fetch failed");
      const blob = await resp.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      // Approach 3: Image element with crossOrigin
      try {
        return await new Promise<string | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      } catch { return null; }
    }
  }
};

export async function exportCleanLightPDF(opts: CleanLightExportOptions): Promise<jsPDF> {
  const { imovel, avaliacao, comparaveis, brandName, corretorInfo, logoUrl, profilePhotoUrl, skipSave } = opts;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 18;
  const cw = pw - margin * 2;
  const brand = brandName || "ImobPro";
  const location = [imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", ");
  const pontosFortes = toArr(avaliacao?.pontos_fortes);
  const pontosAtencao = toArr(avaliacao?.pontos_atencao);
  const safeComps = Array.isArray(comparaveis) ? comparaveis : [];

  let logoData: string | null = null;
  if (logoUrl) logoData = await loadImage(logoUrl);
  
  let profileData: string | null = null;
  if (profilePhotoUrl) profileData = await loadImage(profilePhotoUrl);

  // Load best photo (prefer foto_capa_index, then first photo)
  const fotos: string[] = Array.isArray(imovel.fotos) ? imovel.fotos.filter(Boolean) : [];
  let bestPhotoData: string | null = null;
  if (fotos.length > 0) {
    const bestIdx = imovel.foto_capa_index || 0;
    const photoUrl = fotos[bestIdx] || fotos[0];
    bestPhotoData = await loadImage(photoUrl);
  }

  // ─── Helpers ───
  const pageBg = () => {
    doc.setFillColor(...BG_SOFT);
    doc.rect(0, 0, pw, ph, "F");
  };

  const drawCard = (x: number, y: number, w: number, h: number, bg = CARD_BG, radius = 6) => {
    doc.setFillColor(...bg);
    doc.roundedRect(x, y, w, h, radius, radius, "F");
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, radius, radius, "S");
  };

  const sectionHeader = (title: string, x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(sanitize(title), x, y);
    // Underline accent
    const tw = doc.getTextWidth(sanitize(title));
    doc.setDrawColor(...ACCENT_BLUE);
    doc.setLineWidth(1.2);
    doc.line(x, y + 2, x + Math.min(tw, 50), y + 2);
    doc.setLineWidth(0.3);
  };

  const footer = (pageNum: number, total: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${pageNum}/${total}`, pw - margin, ph - 8, { align: "right" });
    doc.text(sanitize(brand), margin, ph - 8);
    doc.text(new Date().toLocaleDateString("pt-BR"), pw / 2, ph - 8, { align: "center" });
  };

  const totalPages = 5;

  // ════════════════════════════════════════
  // PAGE 1 - CAPA CLEAN
  // ════════════════════════════════════════
  pageBg();

  // Top header bar
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, pw, 45, "F");

  // Logo
  if (logoData) {
    try { doc.addImage(logoData, "PNG", margin, 8, 28, 28); } catch {}
  }

  // Brand name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(sanitize(brand).toUpperCase(), logoData ? margin + 34 : margin, 22);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 230);
  doc.text("Avaliacao Profissional de Imovel", logoData ? margin + 34 : margin, 32);

  // Main photo
  const photoY = 52;
  const photoH = 100;
  if (bestPhotoData) {
    try {
      doc.addImage(bestPhotoData, "JPEG", margin, photoY, cw, photoH);
      // Soft overlay at bottom for text (solid dark)
      doc.setFillColor(10, 14, 24);
      doc.rect(margin, photoY + photoH - 30, cw, 30, "F");
    } catch {}
  } else {
    drawCard(margin, photoY, cw, photoH, CARD_ACCENT);
  }

  // Title over photo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text(sanitize(imovel.titulo || "Imovel").slice(0, 40), margin + 8, photoY + photoH - 14);
  doc.setFontSize(10);
  doc.setTextColor(220, 225, 240);
  doc.text(sanitize(location, ""), margin + 8, photoY + photoH - 6);

  // Property specs row
  const specY = photoY + photoH + 8;
  const specs = [
    { label: "Tipo", value: sanitize(imovel.tipo) },
    { label: "Quartos", value: String(toNum(imovel.quartos)) },
    { label: "Area", value: `${toNum(imovel.area)} m2` },
    { label: "Vagas", value: String(toNum(imovel.vagas)) },
    { label: "Operacao", value: sanitize(imovel.operacao) },
  ];
  const specW = cw / specs.length;
  specs.forEach((s, i) => {
    const sx = margin + i * specW;
    drawCard(sx + 1, specY, specW - 2, 24, CARD_BG);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...ACCENT_BLUE);
    doc.text(s.value, sx + specW / 2, specY + 10, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(s.label, sx + specW / 2, specY + 18, { align: "center" });
  });

  // Value highlight
  const valY = specY + 32;
  drawCard(margin, valY, cw, 30, ACCENT_LIGHT_BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...ACCENT_BLUE);
  doc.text(formatBRL(toNum(avaliacao?.valor_ideal)), pw / 2, valY + 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text(`Faixa: ${formatBRL(toNum(avaliacao?.valor_minimo))} a ${formatBRL(toNum(avaliacao?.valor_maximo))}`, pw / 2, valY + 23, { align: "center" });

  // Broker info at bottom
  const brokerY = valY + 38;
  drawCard(margin, brokerY, cw, 30, CARD_BG);
  
  let bx = margin + 8;
  if (profileData) {
    try {
      doc.addImage(profileData, "JPEG", bx, brokerY + 3, 24, 24);
      bx += 30;
    } catch {}
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(sanitize(corretorInfo?.nome || brand), bx, brokerY + 10);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_SECONDARY);
  const contactParts: string[] = [];
  if (corretorInfo?.creci) contactParts.push(`CRECI: ${corretorInfo.creci}`);
  if (corretorInfo?.telefone) contactParts.push(corretorInfo.telefone);
  if (corretorInfo?.email) contactParts.push(corretorInfo.email);
  doc.text(contactParts.join("  |  "), bx, brokerY + 18);

  if (logoData && !profileData) {
    try { doc.addImage(logoData, "PNG", pw - margin - 22, brokerY + 3, 20, 20); } catch {}
  }

  footer(1, totalPages);

  // ════════════════════════════════════════
  // PAGE 2 - ANALISE DE MERCADO
  // ════════════════════════════════════════
  doc.addPage();
  pageBg();

  sectionHeader("Analise de Mercado", margin, 22);

  // M2 comparison
  const m2Y = 32;
  const m2W = (cw - 6) / 2;
  const m2Regiao = toNum(avaliacao?.preco_m2_regiao);
  const m2Imovel = toNum(avaliacao?.preco_m2_estimado);

  drawCard(margin, m2Y, m2W, 40, CARD_BG);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Preco/m2 do Imovel", margin + m2W / 2, m2Y + 10, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...ACCENT_BLUE);
  doc.text(`R$ ${m2Imovel.toFixed(0)}`, margin + m2W / 2, m2Y + 25, { align: "center" });

  drawCard(margin + m2W + 6, m2Y, m2W, 40, CARD_BG);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Media da Regiao", margin + m2W + 6 + m2W / 2, m2Y + 10, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(`R$ ${m2Regiao.toFixed(0)}`, margin + m2W + 6 + m2W / 2, m2Y + 25, { align: "center" });

  // Score & Probabilities
  const scoreY = m2Y + 48;
  const score = toNum(avaliacao?.score_liquidez);
  const scoreColor: [number, number, number] = score >= 70 ? ACCENT_GREEN : score >= 40 ? ACCENT_GOLD : ACCENT_RED;

  drawCard(margin, scoreY, cw / 3 - 4, 50, CARD_BG);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Score de Liquidez", margin + (cw / 3 - 4) / 2, scoreY + 10, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...scoreColor);
  doc.text(`${score}`, margin + (cw / 3 - 4) / 2, scoreY + 30, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`/100 - ${sanitize(avaliacao?.classificacao_liquidez || "media")}`, margin + (cw / 3 - 4) / 2, scoreY + 40, { align: "center" });

  // Probability bars
  const probs = [
    { label: "30 dias", value: toNum(avaliacao?.probabilidade_venda_30dias) },
    { label: "60 dias", value: toNum(avaliacao?.probabilidade_venda_60dias) },
    { label: "90 dias", value: toNum(avaliacao?.probabilidade_venda_90dias) },
  ];

  const probX = margin + cw / 3 + 2;
  const probW = cw * 2 / 3 - 2;
  drawCard(probX, scoreY, probW, 50, CARD_BG);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text("Probabilidade de Venda", probX + 8, scoreY + 10);

  probs.forEach((p, i) => {
    const py = scoreY + 16 + i * 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(p.label, probX + 8, py + 4);
    
    // Bar background
    const barX = probX + 30;
    const barW = probW - 60;
    doc.setFillColor(235, 238, 245);
    doc.roundedRect(barX, py, barW, 5, 2.5, 2.5, "F");
    
    // Fill
    const fillW = Math.max(2, (p.value / 100) * barW);
    const fillColor: [number, number, number] = p.value >= 60 ? ACCENT_GREEN : p.value >= 30 ? ACCENT_GOLD : ACCENT_RED;
    doc.setFillColor(...fillColor);
    doc.roundedRect(barX, py, fillW, 5, 2.5, 2.5, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(`${p.value}%`, barX + barW + 4, py + 4);
  });

  // Comparables table
  const compY = scoreY + 58;
  sectionHeader("Imoveis Comparaveis", margin, compY);

  if (safeComps.length > 0) {
    let cy = compY + 8;
    // Header
    drawCard(margin, cy, cw, 10, [240, 242, 248], 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text("Imovel", margin + 4, cy + 7);
    doc.text("Valor", margin + cw * 0.4, cy + 7);
    doc.text("R$/m2", margin + cw * 0.58, cy + 7);
    doc.text("Area", margin + cw * 0.74, cy + 7);
    doc.text("Tempo", margin + cw * 0.88, cy + 7);
    cy += 12;

    safeComps.slice(0, 8).forEach((c, idx) => {
      if (cy + 10 > ph - 20) return;
      const rowBg: [number, number, number] = idx % 2 === 0 ? [252, 253, 255] : [245, 247, 252];
      doc.setFillColor(...rowBg);
      doc.rect(margin, cy, cw, 9, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_PRIMARY);
      doc.text(sanitize(c.titulo).slice(0, 28), margin + 4, cy + 6);
      
      doc.setFont("helvetica", "bold");
      doc.text(formatBRL(toNum(c.preco)), margin + cw * 0.4, cy + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_SECONDARY);
      const pm2 = toNum(c.area) > 0 ? toNum(c.preco) / toNum(c.area) : 0;
      doc.text(pm2 > 0 ? `R$ ${pm2.toFixed(0)}` : "—", margin + cw * 0.58, cy + 6);
      doc.text(`${toNum(c.area)} m2`, margin + cw * 0.74, cy + 6);
      
      const dias = c.dias_anuncio;
      const diasColor: [number, number, number] = dias && dias > 60 ? ACCENT_RED : dias && dias > 30 ? ACCENT_GOLD : ACCENT_GREEN;
      doc.setTextColor(...diasColor);
      doc.text(dias ? `${dias}d` : "—", margin + cw * 0.88, cy + 6);
      
      cy += 10;
    });
  }

  footer(2, totalPages);

  // ════════════════════════════════════════
  // PAGE 3 - PONTOS & ESTRATEGIA
  // ════════════════════════════════════════
  doc.addPage();
  pageBg();

  sectionHeader("Pontos Fortes & Consideracoes", margin, 22);

  const colW = (cw - 8) / 2;
  let py = 30;

  // Pontos Fortes
  drawCard(margin, py, colW, 80, CARD_BG);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT_GREEN);
  doc.text("Pontos Fortes", margin + 8, py + 12);

  let fy = py + 20;
  pontosFortes.slice(0, 6).forEach((p) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_SECONDARY);
    const lines = doc.splitTextToSize("+ " + sanitize(p), colW - 16);
    doc.text(lines[0], margin + 8, fy);
    fy += 9;
  });

  // Pontos de Atencao
  drawCard(margin + colW + 8, py, colW, 80, CARD_BG);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT_GOLD);
  doc.text("Consideracoes", margin + colW + 16, py + 12);

  let ay = py + 20;
  pontosAtencao.slice(0, 6).forEach((p) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_SECONDARY);
    const lines = doc.splitTextToSize("- " + sanitize(p), colW - 16);
    doc.text(lines[0], margin + colW + 16, ay);
    ay += 9;
  });

  // Estrategia
  py += 88;
  if (avaliacao?.estrategia_venda) {
    sectionHeader("Estrategia de Venda", margin, py);
    py += 8;
    drawCard(margin, py, cw, 50, CARD_BG);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    const stratLines = doc.splitTextToSize(sanitize(avaliacao.estrategia_venda), cw - 16);
    doc.text(stratLines.slice(0, 6), margin + 8, py + 12);
    py += 58;
  }

  // Analise resumo
  if (avaliacao?.analise_resumo) {
    sectionHeader("Analise do Mercado", margin, py);
    py += 8;
    drawCard(margin, py, cw, 60, CARD_BG);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    const resumoLines = doc.splitTextToSize(sanitize(avaliacao.analise_resumo), cw - 16);
    doc.text(resumoLines.slice(0, 8), margin + 8, py + 12);
  }

  footer(3, totalPages);

  // ════════════════════════════════════════
  // PAGE 4 - FAIXAS DE PRECO
  // ════════════════════════════════════════
  doc.addPage();
  pageBg();

  sectionHeader("Faixas de Preco Sugeridas", margin, 22);

  const tiers = [
    { label: "Preco Minimo", value: toNum(avaliacao?.valor_minimo), desc: "Piso de mercado considerando comparaveis e condicoes do imovel", color: ACCENT_RED },
    { label: "Preco Ideal", value: toNum(avaliacao?.valor_ideal), desc: "Valor justo baseado em analise comparativa de mercado", color: ACCENT_BLUE },
    { label: "Sugestao de Preco", value: toNum(avaliacao?.sugestao_preco_inicial || avaliacao?.valor_ideal), desc: "Recomendacao para inicio de anuncio com margem para negociacao", color: ACCENT_GREEN },
    { label: "Preco Maximo", value: toNum(avaliacao?.valor_maximo), desc: "Teto considerando diferenciais e demanda da regiao", color: ACCENT_GOLD },
  ];

  let ty = 32;
  tiers.forEach((tier) => {
    drawCard(margin, ty, cw, 32, CARD_BG);
    // Color accent left
    doc.setFillColor(...tier.color);
    doc.roundedRect(margin, ty, 4, 32, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(tier.label, margin + 12, ty + 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...tier.color);
    doc.text(formatBRL(tier.value), margin + cw - 8, ty + 12, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(tier.desc, margin + 12, ty + 24);

    ty += 38;
  });

  // Recommendation
  ty += 4;
  drawCard(margin, ty, cw, 28, ACCENT_LIGHT_BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT_BLUE);
  doc.text("Recomendacao", margin + 8, ty + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text("Sugerimos comecar o anuncio entre 5-10% acima do valor ideal para margem de negociacao.", margin + 8, ty + 20);

  footer(4, totalPages);

  // ════════════════════════════════════════
  // PAGE 5 - CONTATO / CORRETOR
  // ════════════════════════════════════════
  doc.addPage();
  pageBg();

  // Centered layout
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...ACCENT_BLUE);
  doc.text("Obrigado!", pw / 2, 50, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text("Estamos a disposicao para auxiliar em todo o processo.", pw / 2, 62, { align: "center" });

  // Broker card
  const bcY = 80;
  drawCard(margin + 20, bcY, cw - 40, 80, CARD_BG);

  // Profile photo
  let infoX = margin + 30;
  if (profileData) {
    try {
      doc.addImage(profileData, "JPEG", pw / 2 - 18, bcY + 8, 36, 36);
    } catch {}
  } else if (logoData) {
    try {
      doc.addImage(logoData, "PNG", pw / 2 - 15, bcY + 8, 30, 30);
    } catch {}
  }

  const infoY = profileData || logoData ? bcY + 50 : bcY + 16;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(sanitize(corretorInfo?.nome || brand), pw / 2, infoY, { align: "center" });

  let contactY = infoY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_SECONDARY);

  if (corretorInfo?.creci) {
    doc.text(`CRECI: ${corretorInfo.creci}`, pw / 2, contactY, { align: "center" });
    contactY += 6;
  }
  if (corretorInfo?.telefone) {
    doc.text(`WhatsApp: ${corretorInfo.telefone}`, pw / 2, contactY, { align: "center" });
    contactY += 6;
  }
  if (corretorInfo?.email) {
    doc.text(corretorInfo.email, pw / 2, contactY, { align: "center" });
  }

  // Footer brand
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`${brand} - Avaliacao gerada em ${new Date().toLocaleDateString("pt-BR")}`, pw / 2, ph - 30, { align: "center" });
  doc.text("Laudo Profissional de Avaliacao Imobiliaria", pw / 2, ph - 24, { align: "center" });

  footer(5, totalPages);

  // ─── Save ───
  const filename = `Avaliacao_Clean_${sanitize(imovel.titulo, "Imovel").replace(/\s+/g, "_").slice(0, 50)}.pdf`;
  if (!skipSave) {
    const blob = doc.output("blob");
    downloadBlob(blob, filename);
  }

  return doc;
}

export async function shareCleanLightPDF(opts: CleanLightExportOptions) {
  const doc = await exportCleanLightPDF({ ...opts, skipSave: true });
  const blob = doc.output("blob");
  const filename = `Avaliacao_Clean_${sanitize(opts.imovel.titulo, "Imovel").replace(/\s+/g, "_").slice(0, 50)}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });

  try {
    const canShare = typeof navigator?.share === "function";
    const canShareFile = typeof navigator?.canShare !== "function" || navigator.canShare({ files: [file] });
    if (canShare && canShareFile) {
      await navigator.share({
        title: `Avaliacao - ${sanitize(opts.imovel.titulo)}`,
        text: `Avaliacao Profissional: ${sanitize(opts.imovel.titulo)}`,
        files: [file],
      });
      return;
    }
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
  }

  downloadBlob(blob, filename);
}
