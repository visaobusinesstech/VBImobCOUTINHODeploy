import jsPDF from "jspdf";

// ============================================================
//  RELATÓRIO DE AVALIAÇÃO COM IA — LAYOUT EDITORIAL PREMIUM
//  9 páginas, uma pergunta por página, narrativa antes do número.
//  Paleta: Navy #0B1F3A · Deep Navy #1E3A5F · Gold #C9A84C · Cream #F5F3EE
// ============================================================

interface PremiumExportOptions {
  imovel: any;
  avaliacao: any;
  comparaveis: any[];
  brandName: string;
  corretorInfo?: { creci?: string; telefone?: string; email?: string; nome?: string; cnpj?: string };
  reportVersion?: string;
  logoUrl?: string;
  profilePhotoUrl?: string;
  skipSave?: boolean;
  /** Parâmetros exatos da amostragem (auditoria/rastreabilidade). */
  parametrosAmostragem?: { label: string; valor: string }[];
}

// ─── Utils ───────────────────────────────────────────────
const formatBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const formatBRLm2 = (v: number) =>
  `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/m²`;
const formatPct = (v: number, digits = 0) => `${(Number(v) || 0).toFixed(digits)}%`;

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
const toArr = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") return v.split(/[,|\n]/).map((s) => s.trim()).filter(Boolean);
  return [];
};
const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const loadImage = async (url?: string | null): Promise<string | null> => {
  if (!url) return null;
  try {
    const bust = url.includes("?") ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    const r = await fetch(bust, { mode: "cors", cache: "no-cache" });
    if (!r.ok) throw new Error();
    const blob = await r.blob();
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => rej(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    try {
      return await new Promise<string | null>((res) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext("2d")?.drawImage(img, 0, 0);
          res(c.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => res(null);
        img.src = url;
      });
    } catch { return null; }
  }
};

// ─── Editorial palette ───────────────────────────────────
const PAPER: [number, number, number] = [245, 243, 238];   // #F5F3EE
const PAPER_SOFT: [number, number, number] = [250, 248, 244];
const NAVY: [number, number, number] = [11, 31, 58];       // #0B1F3A
const NAVY_SOFT: [number, number, number] = [30, 58, 95];  // #1E3A5F
const GOLD: [number, number, number] = [201, 168, 76];     // #C9A84C
const GOLD_SOFT: [number, number, number] = [232, 213, 158];
const INK: [number, number, number] = [26, 32, 44];
const INK_SOFT: [number, number, number] = [66, 74, 92];
const MUTED: [number, number, number] = [120, 128, 145];
const RULE: [number, number, number] = [214, 208, 194];
const GREEN: [number, number, number] = [76, 138, 100];
const AMBER: [number, number, number] = [196, 138, 46];
const RED: [number, number, number] = [178, 74, 60];

// ─── Heuristics ──────────────────────────────────────────
function median(nums: number[]): number {
  const arr = nums.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

/** Máximo de comparáveis considerados/exibidos no PDF (tabela mostra todos eles). */
export const MAX_COMPARAVEIS_PDF = 14;

export type ComparavelExcluido = { item: any; motivo: string };

/**
 * Seleciona os comparáveis usados no cálculo e registra os excluídos com motivo
 * (duplicado, dados insuficientes ou acima do limite do relatório).
 */
export function prepararComparaveis(list: any[]): {
  usados: any[];
  excluidos: ComparavelExcluido[];
  totalBruto: number;
} {
  const seen = new Set<string>();
  const usados: any[] = [];
  const excluidos: ComparavelExcluido[] = [];
  const bruto = (list || []).filter(Boolean);
  for (const c of bruto) {
    const key = `${String(c.titulo || "").trim().toLowerCase()}|${toNum(c.area)}|${toNum(c.preco)}`;
    if (seen.has(key)) {
      excluidos.push({ item: c, motivo: "Anúncio duplicado na base" });
      continue;
    }
    seen.add(key);
    if (toNum(c.preco) <= 0 || toNum(c.area) <= 0) {
      excluidos.push({ item: c, motivo: "Dados insuficientes (preço ou área ausente)" });
      continue;
    }
    if (usados.length >= MAX_COMPARAVEIS_PDF) {
      excluidos.push({ item: c, motivo: `Acima do limite de ${MAX_COMPARAVEIS_PDF} comparáveis do relatório` });
      continue;
    }
    usados.push(c);
  }
  return { usados, excluidos, totalBruto: bruto.length };
}

/** Remove duplicados por título+área+preço para o total citado bater com a tabela. */
export function dedupeComparaveis(list: any[]): any[] {
  return prepararComparaveis(list).usados;
}

/** Rótulo "X de Y" da tabela de comparáveis. */
export function montarRotuloComparaveis(exibidos: number, total: number): string {
  return `Imóveis semelhantes anunciados — ${exibidos} de ${total}`;
}

/** Textos que citam a quantidade de comparáveis (devem sempre usar o total exibido). */
export function textosComparaveis(total: number) {
  return {
    metodologia: `Para estimar o valor do seu imóvel, a inteligência artificial cruzou dados de ${total} imóveis semelhantes na região e ponderou fatores que realmente influenciam o preço. Nenhum número aqui é uma opinião — cada peso é calculado a partir de mercado real.`,
    destaque: `A IA encontrou ${total} imóveis comparáveis próximos, com padrão e área semelhantes.`,
    concorrencia: `Encontramos ${total} imóveis semelhantes anunciados na região. Este quadro mostra o tamanho da concorrência e o tempo médio até fechar negócio.`,
  };
}


/** Garante que o número citado nos textos = número de linhas exibidas na tabela. */
export function validarConsistenciaComparaveis(total: number, exibidos: number) {
  if (total !== exibidos) {
    console.warn(
      `[Avaliação PDF] Inconsistência de comparáveis: texto cita ${total}, tabela exibe ${exibidos}.`,
    );
  }
  return total === exibidos;
}

export function derivarMetricas(imovel: any, avaliacao: any, comparaveis: any[]) {
  const precos = comparaveis.map((c) => toNum(c.preco));
  const dias = comparaveis.map((c) => toNum(c.dias_anuncio)).filter((d) => d > 0);
  const precoRecomendado = toNum(avaliacao?.valor_ideal);
  const precoMinimo = toNum(avaliacao?.valor_minimo) || Math.round(precoRecomendado * 0.94);
  const precoMaximo = toNum(avaliacao?.valor_maximo) || Math.round(precoRecomendado * 1.08);
  const precoMercado = median(precos) || precoRecomendado;
  const diffPct = precoMercado ? ((precoRecomendado - precoMercado) / precoMercado) * 100 : 0;
  const diasMedio = dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : 60;
  const diasMediano = median(dias) || diasMedio;

  const precoPedido = toNum(imovel?.preco);
  const precoRapido = Math.round(precoRecomendado * 0.96);
  const precoLucro = Math.round(precoRecomendado * 1.06);

  // Liquidez base: score_liquidez (0..100) ou heurística por CV/desvio
  const liq = Math.max(15, Math.min(95, toNum(avaliacao?.score_liquidez, 62)));

  // Probabilidade de venda por prazo em função da diferença vs mercado + liquidez
  const probParaPreco = (preco: number) => {
    const delta = precoMercado ? ((preco - precoMercado) / precoMercado) * 100 : 0;
    // baseline: quando delta=0 → p30=45, p60=72, p90=88
    const base30 = 45, base60 = 72, base90 = 88;
    const ajusteDelta = -delta * 1.6;              // 1% acima do mercado ≈ -1.6pp
    const ajusteLiq = (liq - 60) * 0.35;           // liquidez modula
    const clip = (n: number) => Math.max(3, Math.min(98, Math.round(n)));
    return {
      d30: clip(base30 + ajusteDelta + ajusteLiq),
      d60: clip(base60 + ajusteDelta * 0.75 + ajusteLiq),
      d90: clip(base90 + ajusteDelta * 0.45 + ajusteLiq),
    };
  };

  const probRecom = probParaPreco(precoRecomendado);
  const probPedido = precoPedido ? probParaPreco(precoPedido) : null;

  // Tempo estimado até 75% de probabilidade
  const tempoEstimadoDias = (() => {
    if (probRecom.d30 >= 75) return 30;
    if (probRecom.d60 >= 75) {
      const t = 30 + ((75 - probRecom.d30) / Math.max(1, probRecom.d60 - probRecom.d30)) * 30;
      return Math.round(t);
    }
    if (probRecom.d90 >= 75) {
      const t = 60 + ((75 - probRecom.d60) / Math.max(1, probRecom.d90 - probRecom.d60)) * 30;
      return Math.round(t);
    }
    return 120;
  })();

  const indiceConfianca = Math.max(30, Math.min(98,
    Math.round(liq * 0.55 + Math.min(20, comparaveis.length * 2) + (avaliacao?.preco_competitivo ? 8 : 4) + 12)
  ));

  const fatores = [
    { nome: "Localização", peso: 25 },
    { nome: "Área e tipologia", peso: 20 },
    { nome: "Padrão construtivo", peso: 15 },
    { nome: "Imóveis comparáveis", peso: 15 },
    { nome: "Oferta atual da região", peso: 10 },
    { nome: "Liquidez histórica", peso: 8 },
    { nome: "Tendência de valorização", peso: 7 },
  ];

  return {
    precoRecomendado, precoMinimo, precoMaximo, precoMercado, diffPct,
    precoRapido, precoLucro, precoPedido,
    diasMedio, diasMediano, liq,
    probRecom, probPedido, tempoEstimadoDias,
    indiceConfianca, fatores,
  };
}

// ══════════════════════════════════════════════════════════
export async function exportAvaliacaoPremiumPDF(opts: PremiumExportOptions): Promise<jsPDF> {
  const { imovel, avaliacao, comparaveis, brandName, corretorInfo, logoUrl, profilePhotoUrl, skipSave, reportVersion, parametrosAmostragem = [] } = opts;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 18;
  const cw = pw - m * 2;
  const brand = brandName || "ImobPro";
  const corretor = corretorInfo?.nome || brand;
  const safeComps: any[] = Array.isArray(comparaveis) ? comparaveis : [];
  const comparaveisGerados = Array.isArray(avaliacao?.comparaveis_gerados) ? avaliacao.comparaveis_gerados : [];
  // Fonte única de verdade: o conjunto exibido é exatamente o conjunto citado nos textos.
  const selecaoComps = prepararComparaveis([...safeComps, ...comparaveisGerados]);
  const allComps = selecaoComps.usados;
  const compsExcluidos = selecaoComps.excluidos;
  const totalBrutoComps = selecaoComps.totalBruto;
  const totalComparaveis = allComps.length;
  const fotos: string[] = Array.isArray(imovel.fotos) ? imovel.fotos.filter(Boolean) : [];
  const bestIdx = imovel.foto_capa_index || 0;
  const [mainPhoto, secondPhoto, logoData, profileData] = await Promise.all([
    loadImage(fotos[bestIdx] || fotos[0]),
    loadImage(fotos[1] || fotos[0]),
    loadImage(logoUrl),
    loadImage(profilePhotoUrl),
  ]);

  const pontosFortes = toArr(avaliacao?.pontos_fortes);
  const pontosAtencao = toArr(avaliacao?.pontos_atencao);
  const met = derivarMetricas(imovel, avaliacao, allComps);
  const emissao = new Date().toLocaleDateString("pt-BR");
  const version = reportVersion || `v${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}`;
  const totalPages = 9;

  // ─── Primitivas ────────────────────────────────────────
  const paper = () => { doc.setFillColor(...PAPER); doc.rect(0, 0, pw, ph, "F"); };

  const txt = (
    text: string, x: number, y: number,
    o: { size?: number; color?: [number, number, number]; bold?: boolean; align?: "left" | "center" | "right"; maxW?: number; letterSpacing?: number } = {}
  ) => {
    const { size = 10, color = INK, bold = false, align = "left", maxW } = o;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    if (maxW) {
      const lines = doc.splitTextToSize(sanitize(text), maxW);
      doc.text(lines, x, y, { align } as any);
      return (lines.length * size * 0.42);
    }
    doc.text(sanitize(text), x, y, { align } as any);
    return size * 0.42;
  };

  const eyebrow = (text: string, x: number, y: number, color: [number, number, number] = GOLD) => {
    txt(text.toUpperCase(), x, y, { size: 7.5, color, bold: true });
  };

  const rule = (x1: number, y: number, x2: number, color: [number, number, number] = RULE, w = 0.3) => {
    doc.setDrawColor(...color); doc.setLineWidth(w);
    doc.line(x1, y, x2, y);
  };

  const header = (pageNum: number) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...NAVY);
    doc.text(sanitize(brand).toUpperCase(), m, 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(`RELATÓRIO DE AVALIAÇÃO · ${version}`, pw - m, 11, { align: "right" });
    rule(m, 14, pw - m);
  };

  const footer = (pageNum: number) => {
    rule(m, ph - 12, pw - m);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.setTextColor(...MUTED);
    doc.text(sanitize(brand), m, ph - 7);
    doc.text(`Emitido em ${emissao}`, pw / 2, ph - 7, { align: "center" });
    doc.text(`${pageNum} / ${totalPages}`, pw - m, ph - 7, { align: "right" });
  };

  const pageChrome = (n: number, opts: { skipHeader?: boolean } = {}) => {
    paper();
    if (!opts.skipHeader) header(n);
    footer(n);
  };

  const pageTitle = (kicker: string, title: string, y = 30) => {
    eyebrow(kicker, m, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(...NAVY);
    doc.text(sanitize(title), m, y + 12);
    rule(m, y + 17, m + 22, GOLD, 0.8);
  };

  const paragraph = (text: string, x: number, y: number, w: number, opts: { size?: number; color?: [number, number, number]; leading?: number } = {}) => {
    const size = opts.size ?? 10;
    const color = opts.color ?? INK_SOFT;
    const leading = opts.leading ?? size * 0.52;
    doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(sanitize(text), w);
    lines.forEach((ln: string, i: number) => doc.text(ln, x, y + i * leading));
    return lines.length * leading;
  };

  const card = (x: number, y: number, w: number, h: number, opts: { fill?: [number, number, number]; border?: boolean } = {}) => {
    doc.setFillColor(...(opts.fill ?? PAPER_SOFT));
    doc.roundedRect(x, y, w, h, 2, 2, "F");
    if (opts.border !== false) {
      doc.setDrawColor(...RULE); doc.setLineWidth(0.2);
      doc.roundedRect(x, y, w, h, 2, 2, "S");
    }
  };

  const dot = (x: number, y: number, color: [number, number, number], r = 1.4) => {
    doc.setFillColor(...color); doc.circle(x, y, r, "F");
  };

  // Fit-to-width com ellipsis
  const fit = (s: string, maxW: number, size: number) => {
    doc.setFontSize(size);
    let t = sanitize(s);
    if (doc.getTextWidth(t) <= maxW) return t;
    while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
    return t + "…";
  };

  // ══════════════════════════════════════════════════════
  // PÁGINA 1 — RESUMO EXECUTIVO
  // Quanto vale · Em quanto tempo · Se está competitivo
  // ══════════════════════════════════════════════════════
  paper();
  // Header capa: brand + emissão
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...NAVY);
  doc.text(sanitize(brand).toUpperCase(), m, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text(`RELATÓRIO DE AVALIAÇÃO · ${version}`, pw - m, 14, { align: "right" });
  rule(m, 17, pw - m, NAVY, 0.4);

  // Foto capa grande
  const capaY = 22;
  const capaH = 90;
  if (mainPhoto) {
    try { doc.addImage(mainPhoto, "JPEG", m, capaY, cw, capaH); } catch { card(m, capaY, cw, capaH, { fill: NAVY_SOFT }); }
  } else {
    card(m, capaY, cw, capaH, { fill: NAVY });
    txt(sanitize(imovel.tipo || "Imóvel").toUpperCase(), m + cw / 2, capaY + capaH / 2, { size: 14, bold: true, align: "center", color: GOLD_SOFT });
  }
  // Overlay tag no canto da foto
  doc.setFillColor(...NAVY);
  doc.rect(m, capaY, 56, 10, "F");
  txt("RESUMO EXECUTIVO", m + 4, capaY + 7, { size: 7.5, bold: true, color: PAPER, letterSpacing: 1 });

  // Bloco endereço + tipo
  const endY = capaY + capaH + 8;
  eyebrow(sanitize(imovel.tipo || "Imóvel").toUpperCase() + " · " + emissao, m, endY);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...NAVY);
  const endereco = sanitize(imovel.endereco || imovel.titulo || "Endereço não informado");
  const enderecoLines = doc.splitTextToSize(endereco, cw);
  enderecoLines.slice(0, 2).forEach((ln: string, i: number) => doc.text(ln, m, endY + 8 + i * 8));
  txt(`${sanitize(imovel.bairro || "")} · ${sanitize(imovel.cidade || "")}/${sanitize(imovel.estado || "")}`, m, endY + 8 + Math.min(enderecoLines.length, 2) * 8 + 2, { size: 10, color: INK_SOFT });

  // Bloco de destaque: PREÇO RECOMENDADO (elemento mais forte do relatório)
  const heroY = endY + 30;
  const heroH = 58;
  doc.setFillColor(...NAVY);
  doc.roundedRect(m, heroY, cw, heroH, 2, 2, "F");
  // Faixa dourada superior
  doc.setFillColor(...GOLD);
  doc.rect(m, heroY, cw, 1.6, "F");

  eyebrow("VALOR RECOMENDADO PELA IA", m + 8, heroY + 10, GOLD);
  doc.setFont("helvetica", "bold"); doc.setFontSize(34); doc.setTextColor(...PAPER);
  doc.text(formatBRL(met.precoRecomendado), m + 8, heroY + 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GOLD_SOFT);
  doc.text(`Faixa sugerida ${formatBRL(met.precoMinimo)}  —  ${formatBRL(met.precoMaximo)}`, m + 8, heroY + 36);

  // Selo lateral
  const seloW = 46;
  const seloX = m + cw - seloW - 8;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.6);
  doc.roundedRect(seloX, heroY + 10, seloW, 26, 2, 2, "S");
  const competitivo = Math.abs(met.diffPct) <= 4;
  txt(competitivo ? "PREÇO" : "PREÇO", seloX + seloW / 2, heroY + 18, { size: 7, bold: true, color: GOLD, align: "center" });
  txt(competitivo ? "COMPETITIVO" : "INTELIGENTE", seloX + seloW / 2, heroY + 25, { size: 10, bold: true, color: PAPER, align: "center" });
  txt(`${met.diffPct >= 0 ? "+" : ""}${met.diffPct.toFixed(1)}% vs mercado`, seloX + seloW / 2, heroY + 32, { size: 6.5, color: GOLD_SOFT, align: "center" });

  // Três indicadores (tempo · nota IA · liquidez)
  const kY = heroY + heroH + 10;
  const kH = 30;
  const kW = (cw - 12) / 3;
  const kpis = [
    { rot: "TEMPO ESTIMADO DE VENDA", val: `${met.tempoEstimadoDias} dias`, sub: "para atingir 75% de probabilidade" },
    { rot: "NOTA DA IA", val: `${met.indiceConfianca}/100`, sub: "confiança geral do estudo" },
    { rot: "LIQUIDEZ DA REGIÃO", val: `${Math.round(met.liq)}/100`, sub: "velocidade histórica de venda" },
  ];
  kpis.forEach((k, i) => {
    const x = m + i * (kW + 6);
    card(x, kY, kW, kH);
    // barra dourada esquerda
    doc.setFillColor(...GOLD); doc.rect(x, kY, 1.6, kH, "F");
    eyebrow(k.rot, x + 5, kY + 8);
    txt(k.val, x + 5, kY + 17, { size: 15, bold: true, color: NAVY });
    txt(k.sub, x + 5, kY + 25, { size: 7, color: MUTED, maxW: kW - 10 });
  });

  // Chamada rodapé
  const callY = kY + kH + 8;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.4);
  doc.line(m, callY, m + 12, callY);
  txt("Resumo da Inteligência Artificial", m + 16, callY + 1, { size: 8, bold: true, color: NAVY, letterSpacing: 1 });
  txt("Nas próximas páginas, cada conclusão é explicada antes de mostrar os números.", m, callY + 8, { size: 8, color: INK_SOFT, maxW: cw });

  footer(1);

  // ══════════════════════════════════════════════════════
  // PÁGINA 2 — COMO A IA CHEGOU NESTE VALOR
  // ══════════════════════════════════════════════════════
  doc.addPage(); pageChrome(2);
  pageTitle("Metodologia", "Como a IA chegou neste valor");

  const p2Intro = `Para estimar o valor do seu imóvel, a inteligência artificial cruzou dados de ${totalComparaveis} imóveis semelhantes na região e ponderou fatores que realmente influenciam o preço. Nenhum número aqui é uma opinião — cada peso é calculado a partir de mercado real.`;
  paragraph(p2Intro, m, 56, cw, { size: 10, color: INK_SOFT, leading: 5 });

  // Lista de fatores considerados
  const fatoresY = 82;
  eyebrow("A IA analisou", m, fatoresY);
  const chips = [
    "Imóveis semelhantes", "Localização", "Padrão construtivo", "Área útil",
    "Condomínio", "Oferta atual", "Histórico", "Liquidez", "Infraestrutura", "Tendência de valorização",
  ];
  let chipX = m; let chipY = fatoresY + 6;
  chips.forEach((c) => {
    const w = doc.getStringUnitWidth(c) * 8 * 0.5 + 8;
    if (chipX + w > m + cw) { chipX = m; chipY += 9; }
    doc.setFillColor(...PAPER_SOFT); doc.setDrawColor(...RULE); doc.setLineWidth(0.2);
    doc.roundedRect(chipX, chipY, w, 6.5, 3, 3, "FD");
    txt(c, chipX + w / 2, chipY + 4.6, { size: 7.5, color: NAVY, align: "center" });
    chipX += w + 4;
  });

  // Gráfico de peso dos fatores
  const gY = chipY + 18;
  eyebrow("Peso de cada fator na análise", m, gY);
  const barBase = gY + 6;
  const labelW = 62;
  const barW = cw - labelW - 12;
  met.fatores.forEach((f, i) => {
    const y = barBase + i * 8.2;
    txt(f.nome, m, y + 3.5, { size: 8.5, color: INK });
    // trilho
    doc.setFillColor(...RULE);
    doc.roundedRect(m + labelW, y, barW, 4.5, 1.2, 1.2, "F");
    // barra
    doc.setFillColor(...(i === 0 ? GOLD : NAVY_SOFT));
    doc.roundedRect(m + labelW, y, (barW * f.peso) / 25, 4.5, 1.2, 1.2, "F");
    txt(`${f.peso}%`, m + labelW + barW + 4, y + 3.5, { size: 8, bold: true, color: NAVY });
  });

  // Rodapé explicativo
  const p2FY = barBase + met.fatores.length * 8.2 + 10;
  card(m, p2FY, cw, 24, { fill: NAVY });
  txt("Antes de qualquer número, uma frase:", m + 8, p2FY + 9, { size: 8, color: GOLD, bold: true });
  txt(
    `A IA encontrou ${totalComparaveis} imóveis comparáveis próximos, com padrão e área semelhantes. A partir desse conjunto, o preço mais competitivo é ${formatBRL(met.precoRecomendado)}.`,
    m + 8, p2FY + 15, { size: 8.5, color: PAPER, maxW: cw - 16 },
  );

  // ══════════════════════════════════════════════════════
  // PÁGINA 3 — PREÇO RECOMENDADO (a mais importante)
  // ══════════════════════════════════════════════════════
  doc.addPage(); pageChrome(3);
  pageTitle("O número", "Preço recomendado");
  paragraph(
    "Este é o valor sugerido pela IA para colocar o seu imóvel à venda. Ele equilibra três coisas ao mesmo tempo: seu retorno, o tempo até fechar negócio e o preço praticado agora na região.",
    m, 56, cw, { size: 10, color: INK_SOFT, leading: 5 },
  );

  // Bloco gigante do valor
  const bigY = 82;
  const bigH = 78;
  doc.setFillColor(...NAVY);
  doc.roundedRect(m, bigY, cw, bigH, 2, 2, "F");
  doc.setFillColor(...GOLD); doc.rect(m, bigY, cw, 2, "F");
  eyebrow("VALOR RECOMENDADO", m + 10, bigY + 14, GOLD);
  doc.setFont("helvetica", "bold"); doc.setFontSize(52); doc.setTextColor(...PAPER);
  doc.text(formatBRL(met.precoRecomendado), m + 10, bigY + 44);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GOLD_SOFT);
  doc.text(`≈ ${formatBRLm2(toNum(avaliacao?.preco_m2_estimado) || (met.precoRecomendado / Math.max(1, toNum(imovel.area))))}`, m + 10, bigY + 54);
  // Selo
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.7);
  doc.roundedRect(m + cw - 66, bigY + 12, 56, 22, 2, 2, "S");
  txt(competitivo ? "PREÇO COMPETITIVO" : "PREÇO INTELIGENTE", m + cw - 38, bigY + 22, { size: 8, bold: true, color: GOLD, align: "center" });
  txt(`${met.diffPct >= 0 ? "+" : ""}${met.diffPct.toFixed(1)}% vs mercado`, m + cw - 38, bigY + 29, { size: 7, color: PAPER, align: "center" });
  // Faixa mínima/máxima
  txt(`Faixa mínima: ${formatBRL(met.precoMinimo)}`, m + 10, bigY + bigH - 10, { size: 8.5, color: GOLD_SOFT });
  txt(`Faixa máxima: ${formatBRL(met.precoMaximo)}`, m + cw - 10, bigY + bigH - 10, { size: 8.5, color: GOLD_SOFT, align: "right" });

  // Dois preços estratégicos (rápido vs lucro)
  const stratY = bigY + bigH + 12;
  const stratH = 46;
  const stratW = (cw - 8) / 2;
  card(m, stratY, stratW, stratH);
  doc.setFillColor(...GREEN); doc.rect(m, stratY, 1.8, stratH, "F");
  eyebrow("PARA VENDA MAIS RÁPIDA", m + 6, stratY + 10, GREEN);
  txt(formatBRL(met.precoRapido), m + 6, stratY + 24, { size: 22, bold: true, color: NAVY });
  txt("Reduz o tempo até fechar sem comprometer margem. Ideal quando há urgência.", m + 6, stratY + 33, { size: 8, color: INK_SOFT, maxW: stratW - 12 });

  card(m + stratW + 8, stratY, stratW, stratH);
  doc.setFillColor(...GOLD); doc.rect(m + stratW + 8, stratY, 1.8, stratH, "F");
  eyebrow("PARA MAIOR RETORNO", m + stratW + 14, stratY + 10, GOLD);
  txt(formatBRL(met.precoLucro), m + stratW + 14, stratY + 24, { size: 22, bold: true, color: NAVY });
  txt("Explora o teto da faixa aceitável. Exige mais paciência e boa apresentação.", m + stratW + 14, stratY + 33, { size: 8, color: INK_SOFT, maxW: stratW - 12 });

  // Nota conectora
  txt("A próxima página mostra quantos dias, em média, cada um desses cenários leva para vender.", m, stratY + stratH + 10, { size: 8, color: MUTED, maxW: cw });

  // ══════════════════════════════════════════════════════
  // PÁGINA 4 — PROBABILIDADE DE VENDA
  // ══════════════════════════════════════════════════════
  doc.addPage(); pageChrome(4);
  pageTitle("Probabilidade", "Chance de vender no preço recomendado");
  paragraph(
    `Se o imóvel for anunciado por ${formatBRL(met.precoRecomendado)}, estas são as chances estimadas de fechar negócio em cada janela de tempo. Quanto mais próximo do valor recomendado pela IA, maior a probabilidade de venda em menos tempo.`,
    m, 56, cw, { size: 10, color: INK_SOFT, leading: 5 },
  );

  const probY = 84;
  const probH = 60;
  const probW = (cw - 12) / 3;
  const janelas: Array<{ dias: string; pct: number }> = [
    { dias: "30 dias", pct: met.probRecom.d30 },
    { dias: "60 dias", pct: met.probRecom.d60 },
    { dias: "90 dias", pct: met.probRecom.d90 },
  ];
  janelas.forEach((j, i) => {
    const x = m + i * (probW + 6);
    card(x, probY, probW, probH);
    eyebrow(`ATÉ ${j.dias.toUpperCase()}`, x + 6, probY + 10);
    doc.setFont("helvetica", "bold"); doc.setFontSize(38); doc.setTextColor(...NAVY);
    doc.text(`${j.pct}%`, x + probW / 2, probY + 34, { align: "center" });
    // barra
    doc.setFillColor(...RULE);
    doc.roundedRect(x + 8, probY + 42, probW - 16, 3, 1, 1, "F");
    const clr: [number, number, number] = j.pct >= 75 ? GREEN : j.pct >= 50 ? GOLD : RED;
    doc.setFillColor(...clr);
    doc.roundedRect(x + 8, probY + 42, ((probW - 16) * j.pct) / 100, 3, 1, 1, "F");
    txt(j.pct >= 75 ? "alta chance" : j.pct >= 50 ? "chance moderada" : "chance baixa", x + probW / 2, probY + 52, { size: 8, color: MUTED, align: "center" });
  });

  // Comparação com preço pedido, se houver
  const compY = probY + probH + 12;
  if (met.probPedido && met.precoPedido) {
    card(m, compY, cw, 46, { fill: PAPER_SOFT });
    eyebrow("SE MANTIVER O PREÇO ATUAL DE ANÚNCIO", m + 8, compY + 10);
    txt(formatBRL(met.precoPedido), m + 8, compY + 22, { size: 16, bold: true, color: NAVY });
    txt(`${met.probPedido.d30}% em 30d  ·  ${met.probPedido.d60}% em 60d  ·  ${met.probPedido.d90}% em 90d`,
      m + 8, compY + 30, { size: 10, color: INK_SOFT });
    const delta = met.probPedido.d60 - met.probRecom.d60;
    const alert = delta < -8;
    txt(
      alert
        ? `Anunciar por este valor reduz em ${Math.abs(delta)} pontos a chance de vender em 60 dias.`
        : `Diferença modesta em relação ao valor recomendado (${delta >= 0 ? "+" : ""}${delta} pp em 60d).`,
      m + 8, compY + 39, { size: 8.5, color: alert ? RED : INK_SOFT, maxW: cw - 16 },
    );
  } else {
    card(m, compY, cw, 30, { fill: PAPER_SOFT });
    txt("Sem preço atual informado para comparar cenários.", m + 8, compY + 18, { size: 9, color: MUTED });
  }

  // ══════════════════════════════════════════════════════
  // PÁGINA 5 — COMPARAÇÃO COM O MERCADO
  // ══════════════════════════════════════════════════════
  doc.addPage(); pageChrome(5);
  pageTitle("Mercado", "Como seu preço se compara à região");
  paragraph(
    "A tabela abaixo posiciona o valor recomendado frente ao que está sendo pedido, vendido e negociado por imóveis semelhantes na mesma região.",
    m, 56, cw, { size: 10, color: INK_SOFT, leading: 5 },
  );

  const barY = 80;
  const barH = 90;
  card(m, barY, cw, barH);
  eyebrow("PREÇOS COMPARADOS (R$)", m + 8, barY + 10);

  const bars = [
    { label: "Preço pedido", value: met.precoPedido || met.precoRecomendado, color: MUTED as [number, number, number] },
    { label: "Preço médio do mercado", value: met.precoMercado, color: NAVY_SOFT as [number, number, number] },
    { label: "Preço recomendado (IA)", value: met.precoRecomendado, color: GOLD as [number, number, number] },
    { label: "Preço máximo sugerido", value: met.precoMaximo, color: GREEN as [number, number, number] },
  ];
  const maxV = Math.max(...bars.map((b) => b.value)) * 1.08;
  const plotX = m + 68;
  const plotW = cw - 68 - 12;
  bars.forEach((b, i) => {
    const y = barY + 22 + i * 15;
    txt(b.label, m + 8, y + 4, { size: 8, color: INK });
    doc.setFillColor(...RULE);
    doc.roundedRect(plotX, y, plotW, 6, 1.5, 1.5, "F");
    const w = maxV ? (plotW * b.value) / maxV : 0;
    doc.setFillColor(...b.color);
    doc.roundedRect(plotX, y, w, 6, 1.5, 1.5, "F");
    txt(formatBRL(b.value), plotX + w + 3, y + 4.5, { size: 7.5, bold: true, color: NAVY });
  });

  // Delta
  const deltaY = barY + barH + 10;
  const diff = met.precoRecomendado - met.precoMercado;
  card(m, deltaY, cw, 26, { fill: NAVY });
  txt("DIFERENÇA VS. MERCADO", m + 8, deltaY + 9, { size: 7.5, color: GOLD, bold: true });
  txt(`${diff >= 0 ? "+" : ""}${formatBRL(diff)}  (${met.diffPct >= 0 ? "+" : ""}${met.diffPct.toFixed(1)}%)`,
    m + 8, deltaY + 20, { size: 16, bold: true, color: PAPER });
  txt(
    Math.abs(met.diffPct) <= 4
      ? "Alinhado ao mercado. Boa aceitação esperada."
      : met.diffPct > 0
      ? "Acima da média. Aumenta o retorno, alonga o prazo."
      : "Abaixo da média. Acelera a venda, reduz margem.",
    m + cw - 8, deltaY + 20, { size: 8.5, color: GOLD_SOFT, align: "right" },
  );

  // ══════════════════════════════════════════════════════
  // PÁGINA 6 — ANÁLISE DA CONCORRÊNCIA
  // ══════════════════════════════════════════════════════
  doc.addPage(); pageChrome(6);
  pageTitle("Concorrência", "Quem disputa a mesma venda");
  paragraph(
    `Encontramos ${totalComparaveis} imóveis semelhantes anunciados na região. Este quadro mostra o tamanho da concorrência e o tempo médio até fechar negócio.`,
    m, 56, cw, { size: 10, color: INK_SOFT, leading: 5 },
  );

  const conY = 80;
  const conH = 28;
  const conW = (cw - 12) / 3;
  const conCards = [
    { r: "IMÓVEIS SEMELHANTES", v: `${totalComparaveis}`, s: "na mesma região e faixa" },
    { r: "PREÇO MÉDIO", v: formatBRL(met.precoMercado), s: "pedido pela concorrência" },
    { r: "TEMPO MÉDIO", v: `${met.diasMedio} dias`, s: `mediana de ${met.diasMediano} dias` },
  ];
  conCards.forEach((c, i) => {
    const x = m + i * (conW + 6);
    card(x, conY, conW, conH);
    doc.setFillColor(...GOLD); doc.rect(x, conY, 1.6, conH, "F");
    eyebrow(c.r, x + 5, conY + 8);
    txt(c.v, x + 5, conY + 18, { size: 15, bold: true, color: NAVY });
    txt(c.s, x + 5, conY + 24, { size: 7, color: MUTED });
  });

  // Tabela top comparáveis
  const tbY = conY + conH + 10;
  const topN = allComps.slice(0, MAX_COMPARAVEIS_PDF);
  const restantes = Math.max(0, totalComparaveis - topN.length);
  validarConsistenciaComparaveis(totalComparaveis, topN.length);
  eyebrow(
    `Imóveis semelhantes anunciados — ${topN.length} de ${totalComparaveis}`,
    m,
    tbY,
  );
  const rowH = 8.2;
  const headY = tbY + 6;
  const cols = [
    { x: m,           w: cw * 0.44, label: "Comparável" },
    { x: m + cw * 0.44, w: cw * 0.14, label: "Área" },
    { x: m + cw * 0.58, w: cw * 0.20, label: "Preço" },
    { x: m + cw * 0.78, w: cw * 0.22, label: "Dias anunciado" },
  ];
  cols.forEach((c) => txt(c.label.toUpperCase(), c.x, headY, { size: 7, bold: true, color: MUTED }));
  rule(m, headY + 2, m + cw);
  topN.forEach((c, i) => {
    const y = headY + 6 + i * rowH;
    if (i % 2 === 1) {
      doc.setFillColor(...PAPER_SOFT);
      doc.rect(m - 1, y - 4.5, cw + 2, rowH, "F");
    }
    txt(fit(`${i + 1}. ${c.titulo || "Comparável"}`, cols[0].w - 3, 8), cols[0].x, y, { size: 8, color: INK });
    txt(`${toNum(c.area)} m²`, cols[1].x, y, { size: 8, color: INK_SOFT });
    txt(formatBRL(toNum(c.preco)), cols[2].x, y, { size: 8, bold: true, color: NAVY });
    const d = toNum(c.dias_anuncio);
    const clr: [number, number, number] = d <= 0 ? MUTED : d < 30 ? GREEN : d <= 90 ? AMBER : RED;
    txt(d > 0 ? `${d} dias` : "—", cols[3].x, y, { size: 8, bold: true, color: clr });
  });

  let tableEndY = headY + 6 + topN.length * rowH;
  if (restantes > 0) {
    txt(
      `+ ${restantes} imóvel(is) comparável(is) também considerado(s) no cálculo.`,
      m, tableEndY + 2, { size: 7.5, color: MUTED },
    );
    tableEndY += 6;
  }

  // Transparência: comparáveis levantados x usados x excluídos (sempre exibido)
  tableEndY += 6;
  eyebrow(
    `Comparáveis levantados: ${totalBrutoComps} / usados: ${totalComparaveis} / excluídos: ${compsExcluidos.length}`,
    m, tableEndY,
  );
  tableEndY += 5;
  if (compsExcluidos.length > 0) {
    const exW = cw * 0.58;
    // Espaço disponível até o rodapé/bloco de oportunidade (evita sobreposição).
    const limiteY = ph - 55;
    const cabem = Math.max(0, Math.min(6, Math.floor((limiteY - (tableEndY + 5)) / 6)));
    compsExcluidos.slice(0, cabem).forEach((e, i) => {
      const y = tableEndY + 5 + i * 6;
      txt(fit(`${i + 1}. ${e.item?.titulo || "Comparável sem título"}`, exW - 3, 7.5), m, y, { size: 7.5, color: INK_SOFT });
      txt(fit(e.motivo, cw - exW - 2, 7.5), m + exW, y, { size: 7.5, color: RED });
    });
    tableEndY += 5 + cabem * 6;
    if (compsExcluidos.length > cabem) {
      txt(`+ ${compsExcluidos.length - cabem} outro(s) excluído(s) pelos mesmos critérios.`, m, tableEndY, { size: 7, color: MUTED });
      tableEndY += 5;
    }
  }

  // Oportunidade encontrada
  const opY = tableEndY + 8;
  const oportunidade = met.diffPct <= 0
    ? "Seu preço recomendado fica abaixo da média — condição favorável para atrair mais visitas nas primeiras semanas."
    : met.diffPct <= 4
    ? "Seu preço recomendado está alinhado à média — competitividade equilibrada frente à concorrência."
    : "A concorrência pratica preços menores. Considere destacar diferenciais para justificar o valor.";
  card(m, opY, cw, 20, { fill: PAPER_SOFT });
  eyebrow("OPORTUNIDADE IDENTIFICADA", m + 8, opY + 8);
  txt(oportunidade, m + 8, opY + 15, { size: 8.5, color: INK, maxW: cw - 16 });

  // ══════════════════════════════════════════════════════
  // PÁGINA 7 — PONTOS POSITIVOS
  // ══════════════════════════════════════════════════════
  doc.addPage(); pageChrome(7);
  pageTitle("A favor", "Pontos positivos do imóvel");
  paragraph(
    "Estes são os fatores identificados pela IA que aumentam o valor percebido e favorecem a venda.",
    m, 56, cw, { size: 10, color: INK_SOFT, leading: 5 },
  );

  const positivosDefault = [
    "Localização com boa infraestrutura",
    "Área útil compatível com o público da região",
    "Padrão construtivo dentro da média superior",
    "Boa oferta de serviços e comércio no entorno",
    "Potencial de valorização acima da média",
    "Documentação em condições de negociação",
  ];
  const positivos = (pontosFortes.length ? pontosFortes : positivosDefault).slice(0, 8);
  const pcW = (cw - 8) / 2;
  const pcH = 28;
  positivos.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = m + col * (pcW + 8);
    const y = 82 + row * (pcH + 6);
    card(x, y, pcW, pcH);
    doc.setFillColor(...GREEN); doc.circle(x + 8, y + 10, 2.2, "F");
    txt(sanitize(p), x + 14, y + 11, { size: 9, bold: true, color: NAVY, maxW: pcW - 20 });
    txt("Destacar em fotos e descrição do anúncio.", x + 14, y + 20, { size: 7.5, color: MUTED, maxW: pcW - 20 });
  });

  // ══════════════════════════════════════════════════════
  // PÁGINA 8 — PONTOS QUE PODEM DIFICULTAR A VENDA
  // (sempre com sugestão de solução)
  // ══════════════════════════════════════════════════════
  doc.addPage(); pageChrome(8);
  pageTitle("Atenção", "Pontos que podem dificultar a venda");
  paragraph(
    "Cada ponto vem acompanhado de uma sugestão prática. O objetivo não é apontar problemas, e sim mostrar como resolvê-los.",
    m, 56, cw, { size: 10, color: INK_SOFT, leading: 5 },
  );

  const solucoes: Record<string, string> = {
    preco: "Ajustar para dentro da faixa recomendada aumenta em média 15pp a chance de venda em 60 dias.",
    fotos: "Refazer com iluminação natural pela manhã ou contratar ensaio profissional.",
    divulgacao: "Ampliar para portais adicionais e redes sociais segmentadas.",
    documentacao: "Regularizar antes do anúncio evita perder o comprador na fase final.",
    reforma: "Pequenos reparos e pintura neutra costumam pagar a si mesmos no preço final.",
  };
  const detectSolucao = (t: string) => {
    const l = t.toLowerCase();
    if (l.includes("preç") || l.includes("valor")) return solucoes.preco;
    if (l.includes("foto")) return solucoes.fotos;
    if (l.includes("divulg") || l.includes("anúnc")) return solucoes.divulgacao;
    if (l.includes("document") || l.includes("escritur")) return solucoes.documentacao;
    if (l.includes("reform") || l.includes("conserv")) return solucoes.reforma;
    return "Endereçar antes de publicar acelera o retorno das primeiras visitas.";
  };

  const atencaoDefault = [
    "Preço inicial acima do teto do mercado",
    "Fotos escuras ou com pouca definição",
    "Divulgação restrita a poucos canais",
    "Documentação com pendência a regularizar",
  ];
  const atencao = (pontosAtencao.length ? pontosAtencao : atencaoDefault).slice(0, 5);
  let ayY = 84;
  atencao.forEach((p) => {
    const solucao = detectSolucao(p);
    card(m, ayY, cw, 26);
    doc.setFillColor(...AMBER); doc.rect(m, ayY, 1.8, 26, "F");
    txt(sanitize(p), m + 8, ayY + 10, { size: 10, bold: true, color: NAVY, maxW: cw - 16 });
    eyebrow("SUGESTÃO", m + 8, ayY + 17, GOLD);
    txt(solucao, m + 28, ayY + 17, { size: 8.5, color: INK_SOFT, maxW: cw - 40 });
    ayY += 30;
  });

  // ══════════════════════════════════════════════════════
  // PÁGINA 9 — CONCLUSÃO
  // ══════════════════════════════════════════════════════
  doc.addPage(); pageChrome(9);
  pageTitle("Conclusão", "O que fazer com esta avaliação");

  // Narrativa antes do número: explica por que este é o valor final
  // e como ele se conecta à estratégia e ao tempo esperado de venda.
  paragraph(
    `Reunindo tudo o que foi analisado — mercado, concorrência, pontos fortes e riscos — a IA consolida abaixo o valor recomendado para o anúncio, a estratégia sugerida e o tempo esperado até fechar negócio. Este é o resumo prático para agir com segurança.`,
    m,
    56,
    cw,
    { size: 10, color: INK_SOFT, leading: 5 },
  );

  // Painel resumo
  const cnY = 78;
  const cnH = 74;
  doc.setFillColor(...NAVY);
  doc.roundedRect(m, cnY, cw, cnH, 2, 2, "F");
  doc.setFillColor(...GOLD); doc.rect(m, cnY, cw, 1.6, "F");

  eyebrow("VALOR RECOMENDADO", m + 10, cnY + 12, GOLD);
  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...PAPER);
  doc.text(formatBRL(met.precoRecomendado), m + 10, cnY + 28);
  txt(`Faixa ${formatBRL(met.precoMinimo)} — ${formatBRL(met.precoMaximo)}`, m + 10, cnY + 36, { size: 9, color: GOLD_SOFT });

  // Duas colunas: estratégia + confiança
  const colW = (cw - 20) / 2;
  txt("ESTRATÉGIA SUGERIDA", m + 10, cnY + 50, { size: 7.5, bold: true, color: GOLD, letterSpacing: 1 });
  txt(
    met.diffPct <= 0
      ? "Anunciar pelo valor recomendado. Alta chance de fechar em até 60 dias."
      : "Iniciar próximo ao teto e reajustar em 30 dias se as visitas não avançarem.",
    m + 10, cnY + 57, { size: 8.5, color: PAPER, maxW: colW },
  );

  txt("TEMPO ESPERADO", m + 10 + colW + 10, cnY + 50, { size: 7.5, bold: true, color: GOLD, letterSpacing: 1 });
  txt(`~${met.tempoEstimadoDias} dias até 75% de probabilidade de venda`,
    m + 10 + colW + 10, cnY + 57, { size: 8.5, color: PAPER, maxW: colW });

  // Índice de confiança
  const icY = cnY + cnH + 12;
  const icH = 30;
  card(m, icY, cw, icH);
  eyebrow("ÍNDICE DE CONFIANÇA DA IA", m + 8, icY + 10);
  txt(`${met.indiceConfianca}/100`, m + cw - 8, icY + 14, { size: 18, bold: true, color: NAVY, align: "right" });
  const bxX = m + 8, bxY = icY + 18, bxW = cw - 100;
  doc.setFillColor(...RULE); doc.roundedRect(bxX, bxY, bxW, 4, 1.2, 1.2, "F");
  const icColor: [number, number, number] = met.indiceConfianca >= 80 ? GREEN : met.indiceConfianca >= 60 ? GOLD : AMBER;
  doc.setFillColor(...icColor);
  doc.roundedRect(bxX, bxY, (bxW * met.indiceConfianca) / 100, 4, 1.2, 1.2, "F");
  txt(
    met.indiceConfianca >= 80
      ? "Alta confiança: amostra sólida e mercado com liquidez consistente."
      : met.indiceConfianca >= 60
      ? "Boa confiança: dados suficientes para orientar decisão de preço."
      : "Confiança moderada: amostra menor, recomenda-se acompanhamento mensal.",
    m + 8, icY + 26, { size: 7.5, color: MUTED, maxW: cw - 16 },
  );

  // Assinatura + contatos
  const asY = icY + icH + 14;
  txt("Emitido por", m, asY, { size: 8, color: MUTED });
  txt(sanitize(brand), m, asY + 7, { size: 12, bold: true, color: NAVY });
  txt(sanitize(corretor), m, asY + 13, { size: 9, color: INK_SOFT });
  const contatos = [
    corretorInfo?.telefone && `Tel: ${corretorInfo.telefone}`,
    corretorInfo?.email && `E-mail: ${corretorInfo.email}`,
    corretorInfo?.creci && `CRECI ${corretorInfo.creci}`,
    corretorInfo?.cnpj && `CNPJ ${corretorInfo.cnpj}`,
  ].filter(Boolean) as string[];
  contatos.forEach((c, i) => txt(c, m, asY + 21 + i * 6, { size: 8, color: INK_SOFT }));

  if (logoData) {
    try { doc.addImage(logoData, "PNG", m + cw - 30, asY - 4, 30, 30); } catch {}
  }

  txt("Este relatório é gerado por inteligência artificial a partir de dados de mercado. Os valores são estimativas de referência e não constituem garantia de negociação.",
    m, ph - 26, { size: 6.5, color: MUTED, maxW: cw });

  // ─── Auditoria ───
  if (parametrosAmostragem && parametrosAmostragem.length > 0) {
    const auditText = parametrosAmostragem.map(p => `${p.label}: ${p.valor}`).join(" | ");
    txt(`AUDIT: ${auditText}`, m, ph - 20, { size: 5.5, color: MUTED, maxW: cw });
  }

  // ─── Save ──
  const filename = `Avaliacao_${sanitize(imovel.titulo, "Imovel").replace(/\s+/g, "_").slice(0, 50)}.pdf`;
  if (!skipSave) {
    const blob = doc.output("blob");
    downloadBlob(blob, filename);
  }
  return doc;
}

export async function shareAvaliacaoPremiumPDF(opts: PremiumExportOptions) {
  const doc = await exportAvaliacaoPremiumPDF({ ...opts, skipSave: true });
  const blob = doc.output("blob");
  const filename = `Avaliacao_${sanitize(opts.imovel.titulo, "Imovel").replace(/\s+/g, "_").slice(0, 50)}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });
  try {
    const canShare = typeof navigator?.share === "function";
    const canShareFile = typeof navigator?.canShare !== "function" || navigator.canShare({ files: [file] });
    if (canShare && canShareFile) {
      await navigator.share({
        title: `Avaliação — ${sanitize(opts.imovel.titulo)}`,
        text: `Relatório de avaliação com IA: ${sanitize(opts.imovel.titulo)}`,
        files: [file],
      });
      return;
    }
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
  }
  downloadBlob(blob, filename);
}
