import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type AvaliacaoLayoutOption = "gamma" | "executivo" | "compacto" | "premium" | "clean_light" | "estudo_completo";

interface ExportOptions {
  imovel: any;
  avaliacao: any;
  comparaveis: any[];
  brandName: string;
  corretorInfo?: { creci?: string; telefone?: string; email?: string };
  logoUrl?: string;
  layout?: AvaliacaoLayoutOption;
  skipSave?: boolean;
  /** Máximo de comparáveis listados na tabela de amostragem (padrão 10). */
  maxComparaveis?: number;
  /** Texto de ajuda explicando como as referências da amostragem foram escolhidas. */
  notaAmostragem?: string;
  /** Critérios e filtros aplicados na amostragem (exibidos em seção própria). */
  criteriosAmostragem?: { label: string; detalhe: string }[];
  /** Motivo de entrada de cada referência na seleção. */
  motivosSelecao?: { titulo: string; motivo: string }[];
  /** Parâmetros exatos da amostragem (auditoria/rastreabilidade). */
  parametrosAmostragem?: { label: string; valor: string }[];
  /** Referências descartadas (fallback) com o motivo, listadas após a tabela de amostragem. */
  descartados?: { titulo?: string | null; motivo?: string | null; fonte?: string | null; url?: string | null }[];

}

const formatBRL = (v: number) =>
  v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "R$ 0";

const formatK = (v: number) => {
  if (!v) return "R$ 0";
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
  return formatBRL(v);
};

const sanitizePdfText = (value: unknown, fallback = "—") => {
  const text = String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[•●▪▫◦]/g, "-")
    .replace(/[^\u0020-\u00FF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
};

const sanitizeFilenamePart = (value: unknown) => {
  const text = sanitizePdfText(value, "Imovel")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return text || "Imovel";
};

function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const joinPdfMeta = (...parts: unknown[]) => parts
  .map((part) => sanitizePdfText(part, ""))
  .filter(Boolean)
  .join(" - ");

// ─── Gamma-style Light Palette ───
const BG_WHITE: [number, number, number] = [250, 251, 254];
const BG_PAGE: [number, number, number] = [244, 246, 252];
const BG_CARD: [number, number, number] = [218, 224, 248];
const BG_CARD_ALT: [number, number, number] = [228, 232, 250];
const BG_TABLE_HEADER: [number, number, number] = [240, 242, 248];
const BG_TABLE_ROW_EVEN: [number, number, number] = [248, 249, 253];
const BG_TABLE_ROW_ODD: [number, number, number] = [240, 242, 248];
const BLUE_ACCENT: [number, number, number] = [66, 99, 235];
const BLUE_LIGHT: [number, number, number] = [100, 130, 255];
const BLUE_HEADING: [number, number, number] = [55, 85, 210];
const TEXT_DARK: [number, number, number] = [30, 35, 55];
const TEXT_BODY: [number, number, number] = [60, 68, 95];
const TEXT_MUTED: [number, number, number] = [130, 140, 165];
const TEXT_LABEL: [number, number, number] = [90, 100, 130];
const WHITE: [number, number, number] = [255, 255, 255];
const GREEN: [number, number, number] = [34, 170, 100];
const RED: [number, number, number] = [220, 65, 55];
const GOLD: [number, number, number] = [200, 155, 30];
const ORANGE: [number, number, number] = [230, 140, 30];
const BORDER_LIGHT: [number, number, number] = [210, 216, 235];
const DIVIDER: [number, number, number] = [220, 225, 240];

export async function exportAvaliacaoPDF({
  imovel,
  avaliacao,
  comparaveis,
  brandName,
  corretorInfo,
  logoUrl,
  layout = "gamma",
  skipSave = false,
  maxComparaveis = 10,
  notaAmostragem,
  criteriosAmostragem = [],
  motivosSelecao = [],
  parametrosAmostragem = [],
  descartados = [],

}: ExportOptions): Promise<jsPDF> {
  if (layout === "executivo") {
    return exportExecutivoLayout({ imovel, avaliacao, comparaveis, brandName, corretorInfo, logoUrl, skipSave });
  }
  if (layout === "compacto") {
    return exportCompactoLayout({ imovel, avaliacao, comparaveis, brandName, corretorInfo, logoUrl, skipSave });
  }
  if (layout === "premium") {
    // @ts-ignore - avoiding cyclic or complex import if needed, but we can call it directly
    const { exportAvaliacaoPremiumPDF } = await import("./exportAvaliacaoPremiumPDF");
    return exportAvaliacaoPremiumPDF({
      imovel,
      avaliacao,
      comparaveis,
      brandName,
      corretorInfo: { ...corretorInfo, nome: brandName },
      logoUrl,
      profilePhotoUrl: logoUrl,
      skipSave
    });
  }
}

async function exportGammaLayout({

  imovel,
  avaliacao,
  comparaveis,
  brandName,
  corretorInfo,
  logoUrl,
  skipSave,
  maxComparaveis,
  notaAmostragem,
  criteriosAmostragem,
  motivosSelecao,
  parametrosAmostragem,
  descartados
}: ExportOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [254, 190.5] });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const brand = brandName || "ImobPro";
  const margin = 14;
  const contentW = pw - margin * 2;

  const toNumber = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };



  const toStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value === "string") return value.split(/[,|\n]/).map((v) => v.trim()).filter(Boolean);
    return [];
  };

  const safeComparaveis = Array.isArray(comparaveis) ? comparaveis : [];
  const pontosFortes = toStringArray(avaliacao?.pontos_fortes);
  const pontosAtencao = toStringArray(avaliacao?.pontos_atencao);
  const portaisRecomendados = toStringArray(avaliacao?.portais_recomendados);
  const destaquesLocalizacao = toStringArray(avaliacao?.destaques_localizacao);
  const comparativoPortais = Array.isArray(avaliacao?.comparativo_portais) ? avaliacao.comparativo_portais : [];
  const location = [imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", ");

  // ─── Helpers ───
  const pageBg = () => {
    // Soft gradient from top-left
    doc.setFillColor(...BG_PAGE);
    doc.rect(0, 0, pw, ph, "F");
    // Subtle lighter area top-right
    doc.setGState(new (doc as any).GState({ opacity: 0.5 }));
    doc.setFillColor(255, 255, 255);
    doc.rect(pw * 0.4, 0, pw * 0.6, ph * 0.5, "F");
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  };

  const checkPage = (y: number, needed = 30) => {
    if (y + needed > ph - 16) {
      doc.addPage();
      pageBg();
      return 20;
    }
    return y;
  };

  const sectionTitle = (title: string, y: number, subtitle?: string) => {
    y = checkPage(y, 22);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bolditalic");
    doc.setTextColor(...BLUE_HEADING);
    doc.text(title, margin, y + 8);
    doc.setFont("helvetica", "normal");
    if (subtitle) {
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(subtitle, margin, y + 16);
      return y + 24;
    }
    return y + 16;
  };

  const drawCard = (x: number, y: number, w: number, h: number, bg: [number, number, number] = BG_CARD, radius = 8) => {
    doc.setFillColor(...bg);
    doc.roundedRect(x, y, w, h, radius, radius, "F");
    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, radius, radius, "S");
  };

  const drawBadge = (x: number, y: number, text: string, bg: [number, number, number] = BG_CARD, textColor: [number, number, number] = TEXT_DARK) => {
    doc.setFontSize(8);
    const tw = doc.getTextWidth(text) + 12;
    doc.setFillColor(...bg);
    doc.roundedRect(x, y, tw, 10, 5, 5, "F");
    doc.setTextColor(...textColor);
    doc.text(text, x + 6, y + 7);
    return tw;
  };

  // ─── Load image helper ───
  const loadImageAsDataURL = async (url: string): Promise<string | null> => {
    if (!url) return null;
    try {
      // Use cache busting to avoid stale browser cache or CORS issues with cached responses
      const fetchUrl = url.includes("?") ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
      const resp = await fetch(fetchUrl, { mode: "cors", cache: "no-cache" });
      if (!resp.ok) {
        // Fallback for some CDNs that might block cache-busting params
        const simpleResp = await fetch(url);
        if (!simpleResp.ok) return null;
        const blob = await simpleResp.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Falha ao ler imagem"));
          reader.readAsDataURL(blob);
        });
      }
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Falha ao ler imagem"));
        reader.readAsDataURL(blob);
      });
    } catch (err) { 
      console.warn(`[exportAvaliacaoPDF] Failed to load image: ${url}`, err);
      return null; 
    }
  };

  let logoData: string | null = null;
  if (logoUrl) logoData = await loadImageAsDataURL(logoUrl);

  const fotos: string[] = Array.isArray(imovel.fotos) ? imovel.fotos : [];
  const fotoCapa = fotos.length > 0 ? fotos[imovel.foto_capa_index || 0] || fotos[0] : null;
  const fotoDataCache: Map<string, string> = new Map();
  const photosToLoad = fotos.slice(0, 6);
  const photoResults = await Promise.all(photosToLoad.map(url => loadImageAsDataURL(url)));
  photosToLoad.forEach((url, i) => { if (photoResults[i]) fotoDataCache.set(url, photoResults[i]!); });

  const liqLabel = avaliacao.classificacao_liquidez === "alta" ? "Alta" : avaliacao.classificacao_liquidez === "media" ? "Média" : "Baixa";

  // ═══════════════════════════════════════════════════
  // SLIDE 1: CAPA — Foto esquerda, título direita (Gamma style)
  // ═══════════════════════════════════════════════════
  pageBg();

  const capaData = fotoCapa ? fotoDataCache.get(fotoCapa) : null;
  if (capaData) {
    try {
      const imgW = pw * 0.42;
      doc.addImage(capaData, "JPEG", 0, 0, imgW, ph);
    } catch { /* skip */ }
  }

  const textStartX = capaData ? pw * 0.48 : margin + 10;
  const textMaxW = capaData ? pw - textStartX - margin : contentW - 20;

  // Logo
  if (logoData) {
    try { doc.addImage(logoData, "PNG", textStartX, 12, 20, 20); } catch { /* skip */ }
  }

  let y = ph * 0.35;
  doc.setFontSize(30);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...BLUE_HEADING);
  const titleLines = doc.splitTextToSize(imovel.titulo || "Imóvel", textMaxW);
  doc.text(titleLines, textStartX, y);
  y += titleLines.length * 12 + 6;

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_BODY);
  const subtitleText = `Imóvel ${imovel.tipo || ""} - ${imovel.operacao || ""} em ${location}`;
  const subLines = doc.splitTextToSize(subtitleText, textMaxW);
  doc.text(subLines, textStartX, y);

  // Footer badge
  doc.setFontSize(7);
  doc.setFillColor(25, 30, 50);
  doc.roundedRect(pw - 50, ph - 14, 44, 10, 5, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(`Gerado por ${brand}`, pw - 48, ph - 8);

  // ═══════════════════════════════════════════════════
  // SLIDE 2: GALERIA DE FOTOS
  // ═══════════════════════════════════════════════════
  const loadedPhotos = fotos.slice(0, 6).filter(url => fotoDataCache.has(url));
  if (loadedPhotos.length > 1) {
    doc.addPage();
    pageBg();
    y = 14;
    y = sectionTitle(imovel.titulo || "Imóvel", y, `${imovel.tipo || ""} — ${location}`);
    y += 4;

    if (loadedPhotos.length <= 3) {
      const mainW = contentW * 0.6;
      const sideW = contentW - mainW - 4;
      const mainH = 120;
      const sideH = (mainH - 4) / 2;
      const mainData = fotoDataCache.get(loadedPhotos[0]);
      if (mainData) { try { doc.addImage(mainData, "JPEG", margin, y, mainW, mainH); } catch {} }
      for (let i = 1; i < Math.min(3, loadedPhotos.length); i++) {
        const sData = fotoDataCache.get(loadedPhotos[i]);
        if (sData) { try { doc.addImage(sData, "JPEG", margin + mainW + 4, y + (i - 1) * (sideH + 4), sideW, sideH); } catch {} }
      }
    } else {
      const mainH = 85;
      const mainData = fotoDataCache.get(loadedPhotos[0]);
      if (mainData) { try { doc.addImage(mainData, "JPEG", margin, y, contentW, mainH); } catch {} }
      y += mainH + 4;
      const gridPhotos = loadedPhotos.slice(1, 6);
      const gridCols = Math.min(gridPhotos.length, 3);
      const gridW = (contentW - (gridCols - 1) * 4) / gridCols;
      const gridH = 50;
      for (let i = 0; i < gridPhotos.length; i++) {
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);
        const gData = fotoDataCache.get(gridPhotos[i]);
        if (gData) { try { doc.addImage(gData, "JPEG", margin + col * (gridW + 4), y + row * (gridH + 4), gridW, gridH); } catch {} }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // SLIDE 3: CARACTERÍSTICAS DO IMÓVEL (Gamma style cards)
  // ═══════════════════════════════════════════════════
  doc.addPage();
  pageBg();
  y = 14;

  // Location badges
  let bx = margin;
  if (imovel.bairro) { bx += drawBadge(bx, y, imovel.bairro.toUpperCase(), [200, 210, 235], TEXT_DARK) + 4; }
  if (imovel.cidade) { drawBadge(bx, y, imovel.cidade, WHITE, TEXT_MUTED); }
  y += 16;

  y = sectionTitle("Características do Imóvel", y);
  y += 4;

  // 3 feature cards (Gamma style: light blue rounded cards)
  const card3W = (contentW - 12) / 3;
  const card3H = 50;

  const featureCards = [
    { title: "Estrutura", desc: `${imovel.quartos || 0} quartos, ${imovel.banheiros || 0} banheiros e ${imovel.vagas || 0} vagas de garagem` },
    { title: "Área", desc: `${imovel.area || 0}m² de área${imovel.tipo?.toLowerCase().includes("casa") || imovel.tipo?.toLowerCase().includes("sobrado") ? " construída" : ""}` },
    { title: "Estado", desc: imovel.descricao ? imovel.descricao.substring(0, 100) : "Bom estado de conservação" },
  ];

  featureCards.forEach((card, idx) => {
    const cx = margin + idx * (card3W + 6);
    drawCard(cx, y, card3W, card3H, BG_CARD);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(card.title, cx + 10, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_BODY);
    const lines = doc.splitTextToSize(card.desc, card3W - 20);
    doc.text(lines.slice(0, 3), cx + 10, y + 24);
  });
  y += card3H + 12;

  // Additional info sections (Renda, Documentação, Badges)
  const halfW = (contentW - 8) / 2;

  // Documentação
  const docBadges: string[] = [];
  if (imovel.tem_escritura) docBadges.push("Escriturado");
  if (imovel.aceita_financiamento) docBadges.push("Aceita Financiamento");
  if (imovel.aceita_permuta) docBadges.push("Aceita Permuta");
  if (imovel.exclusivo) docBadges.push("Exclusivo");
  if (imovel.aceita_fgts) docBadges.push("Aceita FGTS");

  if (imovel.valor_condominio > 0 || imovel.valor_iptu > 0 || docBadges.length) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bolditalic");
    doc.setTextColor(...BLUE_HEADING);
    doc.text("Documentação", margin, y + 4);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_BODY);
    const docParts: string[] = [];
    if (imovel.tem_escritura) docParts.push("Escriturado");
    if (imovel.valor_iptu > 0) docParts.push(`IPTU: ${formatBRL(imovel.valor_iptu)}`);
    if (imovel.valor_condominio > 0) docParts.push(`Condomínio: ${formatBRL(imovel.valor_condominio)}`);
    if (!imovel.aceita_financiamento) docParts.push("Não aceita financiamento");
    doc.text(docParts.join(". "), margin, y + 4);
    y += 14;
  }

  // ─── Distribuição dos Pavimentos ───
  const comodos: { nome: string; qtd: number }[] = [];
  if (imovel.quartos > 0) comodos.push({ nome: "Quartos", qtd: imovel.quartos });
  if (imovel.suites > 0) comodos.push({ nome: "Suítes", qtd: imovel.suites });
  if (imovel.banheiros > 0) comodos.push({ nome: "Banheiros", qtd: imovel.banheiros });
  if (imovel.vagas > 0) comodos.push({ nome: "Vagas", qtd: imovel.vagas });
  const desc = (imovel.descricao || "").toLowerCase();
  if (/sala/.test(desc)) comodos.push({ nome: "Sala", qtd: 1 });
  if (/cozinha/.test(desc)) comodos.push({ nome: "Cozinha", qtd: 1 });
  if (/varanda|sacada/.test(desc)) comodos.push({ nome: "Varanda", qtd: 1 });
  if (/churrasqueira|gourmet/.test(desc)) comodos.push({ nome: "Churrasqueira", qtd: 1 });

  if (comodos.length > 0) {
    doc.addPage();
    pageBg();
    y = 14;
    const comodoTitle = imovel.tipo?.toLowerCase().includes("sobrado") || imovel.tipo?.toLowerCase().includes("casa")
      ? "Distribuição dos Pavimentos" : "Distribuição dos Cômodos";
    y = sectionTitle(comodoTitle, y);
    y += 4;

    const cCols = Math.min(comodos.length, 4);
    const cRows = Math.ceil(comodos.length / cCols);
    const cW = (contentW - (cCols - 1) * 6) / cCols;
    const cH = 40;

    for (let i = 0; i < comodos.length; i++) {
      const col = i % cCols;
      const row = Math.floor(i / cCols);
      const cx = margin + col * (cW + 6);
      const cy = y + row * (cH + 6);
      const c = comodos[i];

      drawCard(cx, cy, cW, cH, BG_CARD);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLUE_HEADING);
      doc.text(String(c.qtd), cx + cW / 2, cy + 18, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_BODY);
      doc.text(c.nome, cx + cW / 2, cy + 30, { align: "center" });
    }
    y += cRows * (cH + 6) + 10;
  }

  // ═══════════════════════════════════════════════════
  // SLIDE: SOBRE A REGIÃO
  // ═══════════════════════════════════════════════════
  if (destaquesLocalizacao.length > 0) {
    doc.addPage();
    pageBg();
    y = 14;
    y = sectionTitle(`Sobre ${imovel.bairro || "a Região"}`, y);
    y += 4;

    const locCols = Math.min(3, destaquesLocalizacao.length);
    const locW = (contentW - (locCols - 1) * 6) / locCols;
    const locH = 40;

    for (let i = 0; i < destaquesLocalizacao.length; i++) {
      const col = i % locCols;
      const row = Math.floor(i / locCols);
      if (row > 0 && col === 0) y = checkPage(y, locH + 6);

      const cx = margin + col * (locW + 6);
      const cy = y + row * (locH + 6);
      drawCard(cx, cy, locW, locH, WHITE, 8);

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLUE_HEADING);
      const locLines = doc.splitTextToSize(destaquesLocalizacao[i], locW - 16);
      doc.text(locLines[0] || "", cx + 8, cy + 16);
      if (locLines[1]) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...TEXT_BODY);
        doc.text(doc.splitTextToSize(locLines.slice(1).join(" "), locW - 16).slice(0, 2), cx + 8, cy + 26);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // SLIDE: ANÁLISE COMPARATIVA DE MERCADO
  // ═══════════════════════════════════════════════════
  doc.addPage();
  pageBg();
  y = 14;

  const compCount = safeComparaveis.length || comparativoPortais.length;
  y = sectionTitle("Imóveis Semelhantes Anunciados", y, `Avaliação baseada em ${compCount || "N/A"} imóveis similares na região de ${imovel.bairro || location}`);
  y += 6;

  if (safeComparaveis.length > 0) {
    // Table header
    drawCard(margin, y, contentW, 12, BG_TABLE_HEADER, 4);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_LABEL);
    const cols = [margin + 6, margin + contentW * 0.38, margin + contentW * 0.54, margin + contentW * 0.70, margin + contentW * 0.85];
    doc.text("Comparável", cols[0], y + 8);
    doc.text("Preço", cols[1], y + 8);
    doc.text("R$/m²", cols[2], y + 8);
    doc.text("Dias", cols[3], y + 8);
    doc.text("Anunciado", cols[4], y + 8);
    doc.setFont("helvetica", "normal");
    y += 14;

    safeComparaveis.slice(0, Math.max(1, maxComparaveis)).forEach((c: any, idx: number) => {
      y = checkPage(y, 14);
      const rowBg = idx % 2 === 0 ? BG_TABLE_ROW_EVEN : BG_TABLE_ROW_ODD;
      doc.setFillColor(...rowBg);
      doc.rect(margin, y, contentW, 12, "F");

      doc.setFontSize(8);
      doc.setTextColor(...TEXT_DARK);
      const ehForcada = Boolean(c.forcada || c.forcada_manual);
      doc.text(`${ehForcada ? "* " : ""}${(c.titulo || "Imóvel").substring(0, ehForcada ? 30 : 32)}`, cols[0], y + 8);
      if (ehForcada) {
        doc.setFontSize(6);
        doc.setTextColor(...BLUE_ACCENT);
        doc.text(
          sanitizePdfText(`Forcada: ${c.motivo_forcada || c.motivoDescarte || "inclusao manual"}`, "").substring(0, 60),
          cols[0],
          y + 11.4,
        );
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_DARK);
      }

      doc.setFont("helvetica", "bold");
      doc.text(formatBRL(c.preco || 0), cols[1], y + 8);
      doc.setFont("helvetica", "normal");

      const pm2 = c.area > 0 ? c.preco / c.area : 0;
      doc.setTextColor(...TEXT_BODY);
      doc.text(pm2 > 0 ? formatBRL(pm2) : "—", cols[2], y + 8);

      // Tempo de anúncio
      const dias = c.dias_anuncio || null;
      const diasColor: [number, number, number] = dias && dias > 60 ? RED : dias && dias > 30 ? ORANGE : GREEN;
      doc.setTextColor(...diasColor);
      doc.text(dias ? `${dias} dias` : "—", cols[3], y + 8);

      // Portal/Link
      doc.setTextColor(...BLUE_ACCENT);
      if (typeof c.url_anuncio === "string" && c.url_anuncio.trim()) {
        try { doc.textWithLink(c.portal || "Ver", cols[4], y + 8, { url: c.url_anuncio }); } catch { doc.text(c.portal || "Ver", cols[4], y + 8); }
      } else {
        doc.text(c.portal || "Mercado", cols[4], y + 8);
      }
      y += 13;
    });
  } else {
    drawCard(margin, y, contentW, 30, WHITE);
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Nenhum imóvel comparável disponível.", margin + 10, y + 18);
    y += 36;
  }

  // ─── Nota explicativa da amostragem ───
  if (notaAmostragem && notaAmostragem.trim()) {
    const notaLinhas = doc.splitTextToSize(sanitizePdfText(notaAmostragem, ""), contentW - 20) as string[];
    const notaH = notaLinhas.length * 4.6 + 16;
    y = checkPage(y, notaH + 8);
    drawCard(margin, y, contentW, notaH, WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BLUE_HEADING);
    doc.text("Como esta amostragem foi montada", margin + 10, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(notaLinhas, margin + 10, y + 14);
    y += notaH + 8;
  }

  // ─── Critérios e filtros aplicados na amostragem ───
  if (criteriosAmostragem.length > 0 || motivosSelecao.length > 0) {
    y = checkPage(y, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BLUE_HEADING);
    doc.text("Critérios e filtros da amostragem", margin, y + 4);
    y += 10;

    if (criteriosAmostragem.length > 0) {
      criteriosAmostragem.forEach((c) => {
        const label = sanitizePdfText(c.label, "");
        const detalhe = sanitizePdfText(c.detalhe, "");
        const linhas = doc.splitTextToSize(`• ${label}: ${detalhe}`, contentW - 8) as string[];
        const h = linhas.length * 4.4 + 1.5;
        y = checkPage(y, h + 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(linhas, margin + 4, y);
        y += h;
      });
      y += 4;
    }

    if (motivosSelecao.length > 0) {
      y = checkPage(y, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...BLUE_HEADING);
      doc.text("Por que cada referência entrou na seleção", margin, y + 3);
      y += 8;
      motivosSelecao.slice(0, 30).forEach((m, i) => {
        const titulo = sanitizePdfText(m.titulo, "Imóvel sem título");
        const motivo = sanitizePdfText(m.motivo, "Selecionada pelo critério configurado.");
        const linhas = doc.splitTextToSize(`${i + 1}. ${titulo} — ${motivo}`, contentW - 8) as string[];
        const h = linhas.length * 4.4 + 2;
        y = checkPage(y, h + 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(linhas, margin + 4, y);
        y += h;
      });
      y += 4;
    }
  }

  // ─── Parâmetros exatos da amostragem (auditoria) ───
  if (parametrosAmostragem.length > 0) {
    const linhasParam = parametrosAmostragem.map(
      (p) => `${sanitizePdfText(p.label, "")}: ${sanitizePdfText(p.valor, "")}`,
    );
    const colW = (contentW - 20) / 2;
    const rows = Math.ceil(linhasParam.length / 2);
    const boxH = rows * 4.8 + 18;
    y = checkPage(y, boxH + 8);
    drawCard(margin, y, contentW, boxH, WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BLUE_HEADING);
    doc.text("Parâmetros da amostragem (auditoria e rastreabilidade)", margin + 10, y + 8);
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    linhasParam.forEach((linha, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      doc.text(
        doc.splitTextToSize(linha, colW - 4)[0] as string,
        margin + 10 + col * colW,
        y + 15 + row * 4.8,
      );
    });
    y += boxH + 8;
  }




  // ─── Fallback: referências descartadas e motivos ───
  if (Array.isArray(descartados) && descartados.length > 0) {
    y = checkPage(y, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BLUE_HEADING);
    doc.text(`Referências descartadas e motivos (${descartados.length})`, margin, y + 4);
    y += 9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    descartados.slice(0, 20).forEach((d, i) => {
      const titulo = sanitizePdfText(d.titulo, "Imóvel sem título");
      const motivo = sanitizePdfText(d.motivo, "Motivo não informado");
      const fonte = d.fonte ? ` · fonte: ${sanitizePdfText(d.fonte, "")}` : "";
      const linhas = doc.splitTextToSize(`${i + 1}. ${titulo} — ${motivo}${fonte}`, contentW - 8) as string[];
      const h = linhas.length * 4.4 + 2;
      y = checkPage(y, h + 4);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(linhas, margin + 4, y);
      y += h;
    });
    if (descartados.length > 20) {
      doc.text(`+ ${descartados.length - 20} referência(s) descartada(s) adicionais registradas no log.`, margin + 4, y);
      y += 6;
    }
    y += 4;
  }

  // ─── Comparativo por Portal (tempo médio) ───
  if (comparativoPortais.length > 0) {
    y = checkPage(y, 50);
    y += 6;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bolditalic");
    doc.setTextColor(...BLUE_HEADING);
    doc.text("Tempo Médio de Anúncio por Portal", margin, y + 4);
    y += 12;

    const portalColW = contentW / Math.min(comparativoPortais.length, 4);
    comparativoPortais.slice(0, 4).forEach((p: any, idx: number) => {
      const px = margin + idx * portalColW;
      drawCard(px + 2, y, portalColW - 4, 42, BG_CARD);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_DARK);
      doc.text(p.portal || "Portal", px + portalColW / 2, y + 10, { align: "center" });

      doc.setFontSize(16);
      doc.setTextColor(...BLUE_HEADING);
      doc.text(p.tempo_medio_venda || "—", px + portalColW / 2, y + 22, { align: "center" });

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`R$/m²: ${p.preco_medio_m2 ? formatBRL(p.preco_medio_m2) : "—"}`, px + portalColW / 2, y + 30, { align: "center" });
      doc.text(`Volume: ${p.volume_anuncios || "—"}`, px + portalColW / 2, y + 36, { align: "center" });
    });
    y += 50;
  }

  // ═══════════════════════════════════════════════════
  // SLIDE: ANÁLISE DE VALOR POR M²
  // ═══════════════════════════════════════════════════
  doc.addPage();
  pageBg();
  y = 14;
  y = sectionTitle("Análise de Valor por m²", y);
  y += 6;

  const m2Regiao = toNumber(avaliacao.preco_m2_regiao);
  const m2Imovel = toNumber(avaliacao.preco_m2_estimado);
  const premiumPct = m2Regiao > 0 ? ((m2Imovel - m2Regiao) / m2Regiao * 100) : 0;
  const premiumLabel = premiumPct >= 0 ? `+${premiumPct.toFixed(0)}%` : `${premiumPct.toFixed(0)}%`;

  const metricW = (contentW - 16) / 3;
  const metricH = 50;

  // 3 metric cards
  const metrics = [
    { value: `R$ ${m2Regiao.toFixed(0)}`, label: "Média do Mercado", desc: `Valor médio por m² dos imóveis comparáveis na região (${formatK(avaliacao.valor_minimo)} a ${formatK(avaliacao.valor_maximo)})` },
    { value: `R$ ${m2Imovel.toFixed(0)}`, label: "Valor do Imóvel", desc: `Preço por m² considerando área de ${imovel.area || 0}m² e avaliação partindo de ${formatK(avaliacao.valor_ideal)}` },
    { value: premiumLabel, label: "Premium", desc: premiumPct >= 0 ? "Diferencial justificado pelos diferenciais do imóvel" : "Imóvel abaixo da média - oportunidade de mercado" },
  ];

  metrics.forEach((m, idx) => {
    const mx = margin + idx * (metricW + 8);
    drawCard(mx, y, metricW, metricH, BG_CARD);
    doc.setDrawColor(...BLUE_ACCENT);
    doc.setLineWidth(1.5);
    doc.line(mx, y + 1, mx, y + metricH - 1);
    doc.setLineWidth(0.3);

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(m.value, mx + metricW / 2, y + 16, { align: "center" });

    doc.setFontSize(8);
    doc.setTextColor(...TEXT_LABEL);
    doc.text(m.label, mx + metricW / 2, y + 24, { align: "center" });

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    const dLines = doc.splitTextToSize(m.desc, metricW - 16);
    doc.text(dLines.slice(0, 3), mx + 8, y + 32);
  });
  y += metricH + 10;

  // Explanation text
  if (avaliacao.analise_resumo) {
    y = checkPage(y, 30);
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_BODY);
    const analiseLines = doc.splitTextToSize(avaliacao.analise_resumo, contentW - 4);
    doc.text(analiseLines.slice(0, 6), margin, y + 4);
    y += analiseLines.slice(0, 6).length * 4.5 + 8;
  }

  // ═══════════════════════════════════════════════════
  // SLIDE: GRÁFICOS VISUAIS — Bar Chart + Gauge + Progress Bars
  // ═══════════════════════════════════════════════════
  doc.addPage();
  pageBg();
  y = 14;
  y = sectionTitle("Análise Visual de Mercado", y, "Comparativo gráfico de preços, liquidez e probabilidade de venda");
  y += 6;

  // ─── BAR CHART: R$/m² dos comparáveis ───
  const chartComps = safeComparaveis.slice(0, 8).filter((c: any) => c.area > 0 && c.preco > 0);
  if (chartComps.length > 0) {
    const chartX = margin;
    const chartW = contentW * 0.62;
    const chartH = 65;
    const barMaxVal = Math.max(...chartComps.map((c: any) => c.preco / c.area), m2Regiao, m2Imovel);

    drawCard(chartX, y, chartW, chartH + 20, WHITE, 6);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text("R$/m² — Comparáveis vs Imóvel", chartX + 8, y + 12);

    const barAreaX = chartX + 12;
    const barAreaW = chartW - 24;
    const barAreaY = y + 18;
    const barAreaH = chartH - 6;
    const barCount = chartComps.length;
    const barGap = 3;
    const barW = Math.min(18, (barAreaW - barGap * barCount) / barCount);

    // Y-axis reference lines
    for (let tick = 0; tick <= 4; tick++) {
      const tickVal = (barMaxVal / 4) * tick;
      const tickY = barAreaY + barAreaH - (tickVal / barMaxVal) * barAreaH;
      doc.setDrawColor(230, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(barAreaX, tickY, barAreaX + barAreaW, tickY);
      doc.setFontSize(5.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`R$${Math.round(tickVal)}`, barAreaX - 2, tickY + 1, { align: "right" });
    }

    // Bars
    chartComps.forEach((c: any, idx: number) => {
      const pm2 = c.preco / c.area;
      const barH = (pm2 / barMaxVal) * barAreaH;
      const bx = barAreaX + idx * (barW + barGap);
      const by = barAreaY + barAreaH - barH;

      // Bar color: blue for normal, green if below average, orange if above
      const barColor: [number, number, number] = pm2 > m2Regiao * 1.1 ? ORANGE : pm2 < m2Regiao * 0.9 ? GREEN : BLUE_ACCENT;
      doc.setFillColor(...barColor);
      doc.roundedRect(bx, by, barW, barH, 1.5, 1.5, "F");

      // Value on top
      doc.setFontSize(5);
      doc.setTextColor(...TEXT_DARK);
      doc.text(`R$${Math.round(pm2)}`, bx + barW / 2, by - 2, { align: "center" });

      // Label below
      doc.setFontSize(4.5);
      doc.setTextColor(...TEXT_MUTED);
      const label = (c.titulo || "Comp").substring(0, 8);
      doc.text(label, bx + barW / 2, barAreaY + barAreaH + 5, { align: "center" });
    });

    // Reference line for region average
    const avgLineY = barAreaY + barAreaH - (m2Regiao / barMaxVal) * barAreaH;
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(barAreaX, avgLineY, barAreaX + barAreaW, avgLineY);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(5.5);
    doc.setTextColor(...RED);
    doc.text(`Média R$${Math.round(m2Regiao)}/m²`, barAreaX + barAreaW + 2, avgLineY + 1);

    // ─── GAUGE: Score de Liquidez (right side) ───
    const gaugeX = chartX + chartW + 10;
    const gaugeW = contentW - chartW - 10;
    const gaugeH = chartH + 20;
    drawCard(gaugeX, y, gaugeW, gaugeH, WHITE, 6);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text("Liquidez", gaugeX + gaugeW / 2, y + 12, { align: "center" });

    // Draw circular gauge
    const gaugeCX = gaugeX + gaugeW / 2;
    const gaugeCY = y + 42;
    const gaugeR = 18;
    const scoreLiq = toNumber(avaliacao.score_liquidez);

    // Background arc
    doc.setDrawColor(225, 228, 240);
    doc.setLineWidth(4);
    for (let angle = -210; angle <= 30; angle += 2) {
      const rad = (angle * Math.PI) / 180;
      const x1 = gaugeCX + gaugeR * Math.cos(rad);
      const y1 = gaugeCY + gaugeR * Math.sin(rad);
      const x2 = gaugeCX + gaugeR * Math.cos(rad + 0.04);
      const y2 = gaugeCY + gaugeR * Math.sin(rad + 0.04);
      doc.line(x1, y1, x2, y2);
    }

    // Score arc
    const scoreAngle = -210 + (scoreLiq / 100) * 240;
    const scoreColor: [number, number, number] = scoreLiq >= 70 ? GREEN : scoreLiq >= 40 ? GOLD : RED;
    doc.setDrawColor(...scoreColor);
    doc.setLineWidth(4);
    for (let angle = -210; angle <= scoreAngle; angle += 2) {
      const rad = (angle * Math.PI) / 180;
      const x1 = gaugeCX + gaugeR * Math.cos(rad);
      const y1 = gaugeCY + gaugeR * Math.sin(rad);
      const x2 = gaugeCX + gaugeR * Math.cos(rad + 0.04);
      const y2 = gaugeCY + gaugeR * Math.sin(rad + 0.04);
      doc.line(x1, y1, x2, y2);
    }
    doc.setLineWidth(0.3);

    // Score text in center
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...scoreColor);
    doc.text(`${scoreLiq}`, gaugeCX, gaugeCY + 2, { align: "center" });
    doc.setFontSize(6);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("/100", gaugeCX + 10, gaugeCY + 2, { align: "center" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_BODY);
    doc.text(liqLabel, gaugeCX, gaugeCY + 12, { align: "center" });

    y += gaugeH + 8;
  }

  // ─── PROGRESS BARS: Probabilidade de Venda ───
  y = checkPage(y, 50);
  drawCard(margin, y, contentW, 48, WHITE, 6);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text("Probabilidade de Venda", margin + 8, y + 12);

  const probData = [
    { label: "30 dias", value: toNumber(avaliacao.probabilidade_venda_30dias) },
    { label: "60 dias", value: toNumber(avaliacao.probabilidade_venda_60dias) },
    { label: "90 dias", value: toNumber(avaliacao.probabilidade_venda_90dias) },
  ];

  const progBarY = y + 18;
  const progBarW = contentW - 60;
  probData.forEach((pb, idx) => {
    const pby = progBarY + idx * 10;
    // Label
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_LABEL);
    doc.text(pb.label, margin + 10, pby + 4);

    // Background bar
    doc.setFillColor(230, 232, 245);
    doc.roundedRect(margin + 35, pby, progBarW, 6, 3, 3, "F");

    // Fill bar
    const fillW = (pb.value / 100) * progBarW;
    const fillColor: [number, number, number] = pb.value >= 60 ? GREEN : pb.value >= 30 ? GOLD : RED;
    doc.setFillColor(...fillColor);
    doc.roundedRect(margin + 35, pby, Math.max(fillW, 3), 6, 3, 3, "F");

    // Percentage
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(`${pb.value}%`, margin + 37 + progBarW, pby + 4);
  });

  y += 56;

  // ─── MINI BAR: Comparação Preço Informado vs Sugestão IA ───
  const precoInformado = toNumber(imovel.preco);
  const precoSugestao = toNumber(avaliacao.sugestao_preco_inicial) || toNumber(avaliacao.valor_ideal);
  if (precoInformado > 0 && precoSugestao > 0) {
    y = checkPage(y, 40);
    drawCard(margin, y, contentW, 36, WHITE, 6);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text("Preço Informado vs Sugestão IA", margin + 8, y + 12);

    const maxPrice = Math.max(precoInformado, precoSugestao) * 1.1;
    const barY1 = y + 17;
    const compBarW = contentW - 80;

    // Informed price bar
    doc.setFillColor(230, 232, 245);
    doc.roundedRect(margin + 50, barY1, compBarW, 6, 3, 3, "F");
    const infW = (precoInformado / maxPrice) * compBarW;
    doc.setFillColor(...(precoInformado > precoSugestao * 1.1 ? RED : BLUE_ACCENT));
    doc.roundedRect(margin + 50, barY1, Math.max(infW, 3), 6, 3, 3, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_LABEL);
    doc.text("Informado", margin + 10, barY1 + 4);
    doc.setTextColor(...TEXT_DARK);
    doc.text(formatK(precoInformado), margin + 52 + compBarW, barY1 + 4);

    // Suggested price bar
    const barY2 = barY1 + 10;
    doc.setFillColor(230, 232, 245);
    doc.roundedRect(margin + 50, barY2, compBarW, 6, 3, 3, "F");
    const sugW = (precoSugestao / maxPrice) * compBarW;
    doc.setFillColor(...GREEN);
    doc.roundedRect(margin + 50, barY2, Math.max(sugW, 3), 6, 3, 3, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_LABEL);
    doc.text("Sugestão IA", margin + 10, barY2 + 4);
    doc.setTextColor(...TEXT_DARK);
    doc.text(formatK(precoSugestao), margin + 52 + compBarW, barY2 + 4);

    y += 42;
  }

  // ═══════════════════════════════════════════════════
  // SLIDE: AVALIAÇÃO FINAL DE VENDA — 4 Faixas (Gamma zigzag)
  // ═══════════════════════════════════════════════════
  doc.addPage();
  pageBg();
  y = 14;
  y = sectionTitle("Avaliação Final de Venda", y);
  y += 6;

  const precoIdealista = avaliacao.preco_idealista || avaliacao.valor_minimo;
  const precoRealista = avaliacao.preco_realista || avaliacao.valor_ideal;
  const precoProjetado = avaliacao.preco_projetado || Math.round((avaliacao.valor_ideal + avaliacao.valor_maximo) / 2);
  const precoOtimista = avaliacao.preco_otimista || avaliacao.valor_maximo;

  const tierData = [
    { label: "Preço Idealista", value: precoIdealista, desc: "Venda ideal podendo receber proposta de acordo com as opções de mercado" },
    { label: "Preço Realista", value: precoRealista, desc: "Valor justo considerando características, localização e renda" },
    { label: "Preço projetado", value: precoProjetado, desc: "Valorização pelo potencial de investimento e diferenciais do imóvel" },
    { label: "Preço otimista", value: precoOtimista, desc: "Expectativa inicial considerando investimento e reformas realizadas" },
  ];

  // Zigzag layout like Gamma: alternating left and right
  const tierCardW = contentW * 0.48;
  const tierCardH = 36;
  const tierGap = 6;

  tierData.forEach((tier, idx) => {
    y = checkPage(y, tierCardH + tierGap);
    const isRight = idx % 2 !== 0;
    const tx = isRight ? pw - margin - tierCardW : margin;

    drawCard(tx, y, tierCardW, tierCardH, BG_CARD);
    // Left blue accent line
    doc.setDrawColor(...BLUE_ACCENT);
    doc.setLineWidth(2);
    doc.line(tx, y + 3, tx, y + tierCardH - 3);
    doc.setLineWidth(0.3);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(tier.label, tx + 10, y + 12);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(formatBRL(tier.value), tx + 10, y + 22);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_BODY);
    const descLines = doc.splitTextToSize("- " + tier.desc, tierCardW - 20);
    doc.text(descLines[0], tx + 10, y + 30);

    y += tierCardH + tierGap;
  });

  // ═══════════════════════════════════════════════════
  // SLIDE: JUSTIFICATIVA DO PREÇO
  // ═══════════════════════════════════════════════════
  if (pontosFortes.length || pontosAtencao.length) {
    doc.addPage();
    pageBg();
    y = 14;
    y = sectionTitle("Justificativa do Preço", y);
    y += 4;

    const colW2 = (contentW - 8) / 2;

    // Table header
    drawCard(margin, y, contentW, 12, BG_TABLE_HEADER, 4);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text("Pontos Fortes", margin + colW2 / 2, y + 8, { align: "center" });
    doc.text("Considerações", margin + colW2 + 8 + colW2 / 2, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    y += 14;

    const maxRows = Math.max(pontosFortes.length, pontosAtencao.length);
    for (let i = 0; i < maxRows; i++) {
      y = checkPage(y, 14);
      const rowBg = i % 2 === 0 ? BG_TABLE_ROW_EVEN : BG_TABLE_ROW_ODD;

      doc.setFillColor(...rowBg);
      doc.rect(margin, y, colW2, 12, "F");
      doc.rect(margin + colW2 + 8, y, colW2, 12, "F");

      doc.setFontSize(8.5);
      if (pontosFortes[i]) {
        doc.setTextColor(...TEXT_DARK);
        const fl = doc.splitTextToSize(pontosFortes[i], colW2 - 8);
        doc.text(fl[0], margin + 4, y + 8);
      }
      if (pontosAtencao[i]) {
        doc.setTextColor(...TEXT_DARK);
        const al = doc.splitTextToSize(pontosAtencao[i], colW2 - 8);
        doc.text(al[0], margin + colW2 + 12, y + 8);
      }
      y += 13;
    }

    // Recommendation row
    y += 4;
    y = checkPage(y, 14);
    drawCard(margin, y, contentW, 12, BG_CARD);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(`Recomendação: ${formatBRL(precoRealista)}`, margin + 8, y + 8);
    doc.setFont("helvetica", "normal");
    y += 18;
  }

  // ═══════════════════════════════════════════════════
  // SLIDE: LOCALIZAÇÃO + TRANSPORTE
  // ═══════════════════════════════════════════════════
  if (avaliacao.estrategia_venda || portaisRecomendados.length) {
    doc.addPage();
    pageBg();
    y = 14;
    y = sectionTitle("Localização Privilegiada", y);
    y += 4;

    const locSections = [
      { title: "Transporte", desc: "Terminal do metrô e linhas de ônibus facilitam deslocamento. Fácil acesso à avenida comercial." },
      { title: "Acesso", desc: "Próximo a comércios, transporte e vias principais." },
      { title: "Infraestrutura", desc: "Bancos, escolas, supermercados e serviços variados nas proximidades." },
    ];

    locSections.forEach((sec) => {
      y = checkPage(y, 30);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bolditalic");
      doc.setTextColor(...BLUE_HEADING);
      doc.text(sec.title, margin, y + 4);
      y += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_BODY);
      const lines = doc.splitTextToSize(sec.desc, contentW - 4);
      doc.text(lines, margin, y + 4);
      y += lines.length * 5 + 10;
    });

    // Strategy
    if (avaliacao.estrategia_venda) {
      y = checkPage(y, 30);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bolditalic");
      doc.setTextColor(...BLUE_HEADING);
      doc.text("Estratégia de Venda", margin, y + 4);
      y += 10;
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_BODY);
      const stratLines = doc.splitTextToSize(avaliacao.estrategia_venda, contentW - 4);
      doc.text(stratLines.slice(0, 6), margin, y + 4);
      y += stratLines.slice(0, 6).length * 4.5 + 10;
    }

    // Portais
    if (portaisRecomendados.length) {
      y = checkPage(y, 20);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLUE_HEADING);
      doc.text("Portais Recomendados", margin, y + 4);
      y += 10;

      let px = margin;
      portaisRecomendados.forEach(p => {
        const tw = doc.getTextWidth(p) + 14;
        if (px + tw > pw - margin) { px = margin; y += 14; }
        drawCard(px, y, tw + 2, 10, BG_CARD, 5);
        doc.setFontSize(8);
        doc.setTextColor(...BLUE_ACCENT);
        doc.text(p, px + 7, y + 7);
        px += tw + 6;
      });
      y += 16;
    }
  }

  // ═══════════════════════════════════════════════════
  // SLIDE: ROI
  // ═══════════════════════════════════════════════════
  if (avaliacao.rentabilidade_mensal || avaliacao.rentabilidade_percentual) {
    doc.addPage();
    pageBg();
    y = 14;
    y = sectionTitle("Retorno sobre Investimento", y);
    y += 6;

    const roiW = (contentW - 12) / 3;
    const roiH = 45;
    const roiData = [
      { value: avaliacao.rentabilidade_mensal ? formatBRL(toNumber(avaliacao.rentabilidade_mensal)) : "N/A", label: "Aluguel/Mês" },
      { value: toNumber(avaliacao.rentabilidade_percentual) > 0 ? `${toNumber(avaliacao.rentabilidade_percentual).toFixed(2)}%` : "N/A", label: "Rentabilidade/Mês" },
      { value: avaliacao.sugestao_preco_inicial ? formatBRL(toNumber(avaliacao.sugestao_preco_inicial)) : "N/A", label: "Sugestão de Preço" },
    ];

    roiData.forEach((r, idx) => {
      const rx = margin + idx * (roiW + 6);
      drawCard(rx, y, roiW, roiH, BG_CARD);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLUE_HEADING);
      doc.text(r.value, rx + roiW / 2, y + 20, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_LABEL);
      doc.text(r.label, rx + roiW / 2, y + 32, { align: "center" });
    });
    y += roiH + 10;

    if (avaliacao.analise_investimento) {
      doc.setFontSize(9.5);
      doc.setTextColor(...TEXT_BODY);
      const invLines = doc.splitTextToSize(avaliacao.analise_investimento, contentW - 4);
      doc.text(invLines.slice(0, 5), margin, y + 4);
    }
  }

  // ═══════════════════════════════════════════════════
  // SLIDE FINAL: INFORMAÇÕES DO CORRETOR
  // ═══════════════════════════════════════════════════
  const hasCorretorInfo = corretorInfo?.creci || corretorInfo?.telefone || corretorInfo?.email;
  if (hasCorretorInfo) {
    doc.addPage();
    pageBg();

    // Optional: darken right side for photo placeholder
    doc.setFillColor(60, 65, 80);
    doc.rect(pw * 0.6, 0, pw * 0.4, ph, "F");

    y = 20;
    const infoW = pw * 0.55;

    doc.setFontSize(24);
    doc.setFont("helvetica", "bolditalic");
    doc.setTextColor(...BLUE_HEADING);
    doc.text("Informações do Corretor", margin, y + 8);
    y += 22;

    // Corretor card
    drawCard(margin, y, infoW - margin, 50, WHITE);
    let cy = y + 12;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(brand, margin + 10, cy);
    cy += 8;

    if (corretorInfo?.creci) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_DARK);
      doc.text(`CRECI: `, margin + 10, cy);
      doc.setFont("helvetica", "normal");
      doc.text(corretorInfo.creci, margin + 28, cy);
      cy += 7;
    }
    if (corretorInfo?.telefone) {
      doc.setFont("helvetica", "bold");
      doc.text(`WhatsApp: `, margin + 10, cy);
      doc.setFont("helvetica", "normal");
      doc.text(corretorInfo.telefone, margin + 34, cy);
      cy += 7;
    }
    if (corretorInfo?.email) {
      doc.setFont("helvetica", "bold");
      doc.text(`E-mail: `, margin + 10, cy);
      doc.setFont("helvetica", "normal");
      doc.text(corretorInfo.email, margin + 28, cy);
    }
    y += 58;

    // Company card
    drawCard(margin, y, infoW - margin, 40, WHITE);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(brand, margin + 10, y + 14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Data da Avaliação: ", margin + 10, y + 24);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("pt-BR"), margin + 48, y + 24);
    y += 48;

    // Proprietário info badge
    drawCard(margin, y, infoW - margin, 14, BG_CARD);
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_DARK);
    doc.text("Laudo Profissional de Avaliação Imobiliária", margin + 10, y + 9);

    // Logo on right side
    if (logoData) {
      try { doc.addImage(logoData, "PNG", pw * 0.65, 30, 40, 40); } catch {}
    }
  }

  // ═══════════════════════════════════════════════════
  // FOOTER ON ALL PAGES
  // ═══════════════════════════════════════════════════
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Small brand badge bottom-right
    if (i > 1) {
      doc.setFontSize(7);
      doc.setFillColor(25, 30, 50);
      doc.roundedRect(pw - 50, ph - 12, 44, 8, 4, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(`Gerado por ${brand}`, pw - 48, ph - 7);
    }
    // Page number
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${i}/${pageCount}`, margin, ph - 6);
  }

  // ─── Save ───
  if (!skipSave) {
    savePDF(doc, imovel, "Gamma");
  }

  return doc;
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT: EXECUTIVO — Portrait, formal, corporate style
// ═══════════════════════════════════════════════════════════════
function exportExecutivoLayout({ imovel, avaliacao, comparaveis, brandName, corretorInfo, logoUrl, skipSave }: Omit<ExportOptions, "layout">): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const brand = sanitizePdfText(brandName || "ImobPro", "ImobPro");
  const m = 16;
  const cw = pw - m * 2;
  const safeComparaveis = Array.isArray(comparaveis) ? comparaveis : [];

  const toNumber = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
  const toStringArray = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
  const loc = sanitizePdfText([imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", "), "—");

  // ─── Cover ───
  doc.setFillColor(30, 40, 70);
  doc.rect(0, 0, pw, ph, "F");
  doc.setFillColor(55, 85, 210);
  doc.rect(0, 0, pw, 6, "F");

  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("AVALIAÇÃO DE MERCADO", m, 60);

  doc.setFontSize(14);
  doc.setTextColor(180, 195, 255);
   const executiveTitle = doc.splitTextToSize(sanitizePdfText(imovel.titulo, "Imóvel"), cw);
   doc.text(executiveTitle, m, 75);

  doc.setFontSize(10);
  doc.setTextColor(160, 175, 220);
   if (loc) doc.text(doc.splitTextToSize(loc, cw), m, 88);

  // Value highlight
  doc.setFillColor(55, 85, 210);
  doc.roundedRect(m, 110, cw, 40, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(200, 215, 255);
  doc.text("VALOR IDEAL DE MERCADO", m + 10, 124);
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(formatBRL(toNumber(avaliacao.valor_ideal)), m + 10, 140);

  // Brand
  doc.setFontSize(11);
  doc.setTextColor(130, 145, 185);
  doc.text(brand, m, ph - 30);
  if (corretorInfo?.creci) {
    doc.setFontSize(8);
    doc.text(`CRECI: ${sanitizePdfText(corretorInfo.creci)}`, m, ph - 22);
  }
  doc.setFontSize(7);
  doc.setTextColor(100, 115, 155);
  doc.text(new Date().toLocaleDateString("pt-BR"), m, ph - 14);

  // ─── Page 2: Details ───
  doc.addPage();
  let y = 20;

  const drawSection = (title: string) => {
    if (y > ph - 30) { doc.addPage(); y = 20; }
    doc.setFillColor(...BLUE_ACCENT);
    doc.rect(m, y, 3, 8, "F");
    doc.setFontSize(13);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(title, m + 8, y + 6);
    y += 14;
  };

  const drawRow = (label: string, value: string) => {
    const safeValue = sanitizePdfText(value);
    const valueLines = doc.splitTextToSize(safeValue, cw - 70);
    const rowHeight = Math.max(7, valueLines.length * 4.6 + 1);
    if (y > ph - rowHeight - 10) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_LABEL);
    doc.text(sanitizePdfText(label, ""), m + 8, y);
    doc.setTextColor(...TEXT_DARK);
    doc.text(valueLines, m + 70, y);
    y += rowHeight;
  };

  const drawBulletListItem = (text: string, color: [number, number, number]) => {
    const lines = doc.splitTextToSize(sanitizePdfText(text), cw - 24);
    const itemHeight = Math.max(6, lines.length * 4.6);
    if (y > ph - itemHeight - 10) { doc.addPage(); y = 20; }
    doc.setFillColor(...color);
    doc.circle(m + 10, y - 1.3, 1.2, "F");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_BODY);
    doc.text(lines, m + 14, y);
    y += itemHeight + 1;
  };

  drawSection("Dados do Imóvel");
  drawRow("Tipo:", imovel.tipo || "—");
  drawRow("Operação:", imovel.operacao || "—");
  drawRow("Área:", `${toNumber(imovel.area)} m²`);
  drawRow("Quartos:", String(toNumber(imovel.quartos)));
  drawRow("Suítes:", String(toNumber(imovel.suites)));
  drawRow("Banheiros:", String(toNumber(imovel.banheiros)));
  drawRow("Vagas:", String(toNumber(imovel.vagas)));
  drawRow("Localização:", loc || "—");
  y += 6;

  drawSection("Faixas de Valor");
  const faixas = [
    { label: "Valor Mínimo", val: toNumber(avaliacao.valor_minimo) },
    { label: "Valor Ideal", val: toNumber(avaliacao.valor_ideal) },
    { label: "Valor Máximo", val: toNumber(avaliacao.valor_maximo) },
    { label: "Sugestão Inicial", val: toNumber(avaliacao.sugestao_preco_inicial) },
  ];
  faixas.forEach(f => { if (f.val) drawRow(f.label + ":", formatBRL(f.val)); });
  y += 6;

  drawSection("Métricas");
  drawRow("Preço/m² Estimado:", formatBRL(toNumber(avaliacao.preco_m2_estimado)));
  drawRow("Preço/m² Região:", formatBRL(toNumber(avaliacao.preco_m2_regiao)));
  drawRow("Score Liquidez:", `${toNumber(avaliacao.score_liquidez)}/100`);
  drawRow("Prob. Venda 30d:", `${toNumber(avaliacao.probabilidade_venda_30dias)}%`);
  drawRow("Prob. Venda 60d:", `${toNumber(avaliacao.probabilidade_venda_60dias)}%`);
  drawRow("Prob. Venda 90d:", `${toNumber(avaliacao.probabilidade_venda_90dias)}%`);
  y += 6;

  if (avaliacao.analise_resumo) {
    drawSection("Análise");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_BODY);
    const lines = doc.splitTextToSize(sanitizePdfText(avaliacao.analise_resumo), cw - 16);
    lines.forEach((line: string) => {
      if (y > ph - 15) { doc.addPage(); y = 20; }
      doc.text(line, m + 8, y);
      y += 5;
    });
    y += 6;
  }

  const pontosFortes = toStringArray(avaliacao.pontos_fortes);
  if (pontosFortes.length) {
    drawSection("Pontos Fortes");
    pontosFortes.forEach((p) => drawBulletListItem(p, GREEN));
    y += 4;
  }

  const pontosAtencao = toStringArray(avaliacao.pontos_atencao);
  if (pontosAtencao.length) {
    drawSection("Pontos de Atenção");
    pontosAtencao.forEach((p) => drawBulletListItem(p, ORANGE));
    y += 4;
  }

  // Comparables table
  if (safeComparaveis.length) {
    if (y > ph - 60) { doc.addPage(); y = 20; }
    drawSection("Comparáveis de Mercado");
    autoTable(doc, {
      startY: y,
      head: [["Imóvel", "Preço", "Área", "R$/m²", "Tempo Anúncio", "Fonte"]],
      body: safeComparaveis.map(c => [
        sanitizePdfText(c.titulo).substring(0, 28),
        formatBRL(toNumber(c.preco)),
        `${toNumber(c.area)} m²`,
        formatBRL(toNumber(c.area) > 0 ? toNumber(c.preco) / toNumber(c.area) : 0),
        c.dias_anuncio ? `${c.dias_anuncio} dias` : "—",
        sanitizePdfText(c.fonte || c.portal || "—"),
      ]),
      theme: "grid",
      headStyles: { fillColor: [55, 85, 210], textColor: 255, fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 6.5, textColor: [50, 55, 75] },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      margin: { left: m, right: m },
      styles: { cellPadding: 2.5 },
    });

    // Comparativo por Portal (tempo médio de venda)
    const compPortais = Array.isArray(avaliacao?.comparativo_portais) ? avaliacao.comparativo_portais : [];
    if (compPortais.length > 0) {
      y = (doc as any).lastAutoTable?.finalY || y + 40;
      y += 8;
      if (y > ph - 50) { doc.addPage(); y = 20; }
      drawSection("Tempo Médio por Portal");
      autoTable(doc, {
        startY: y,
        head: [["Portal", "R$/m² Médio", "Volume", "Tempo Médio Venda", "Observação"]],
        body: compPortais.map((p: any) => [
          sanitizePdfText(p.portal || "—"),
          p.preco_medio_m2 ? formatBRL(p.preco_medio_m2) : "—",
          p.volume_anuncios || "—",
          sanitizePdfText(p.tempo_medio_venda || "—"),
          sanitizePdfText(p.observacao || "—").substring(0, 40),
        ]),
        theme: "grid",
        headStyles: { fillColor: [55, 85, 210], textColor: 255, fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 6.5, textColor: [50, 55, 75] },
        alternateRowStyles: { fillColor: [245, 247, 252] },
        margin: { left: m, right: m },
        styles: { cellPadding: 2.5 },
      });
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(150, 155, 175);
    doc.text(joinPdfMeta(brand, new Date().toLocaleDateString("pt-BR"), `${i}/${pageCount}`), pw / 2, ph - 6, { align: "center" });
  }

  if (!skipSave) {
    savePDF(doc, imovel, "Executivo");
  }

  return doc;
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT: COMPACTO — Single-page summary, portrait A4
// ═══════════════════════════════════════════════════════════════
function exportCompactoLayout({ imovel, avaliacao, comparaveis, brandName, corretorInfo, skipSave }: Omit<ExportOptions, "layout">): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const brand = sanitizePdfText(brandName || "ImobPro", "ImobPro");
  const m = 14;
  const cw = pw - m * 2;
  const safeComparaveis = Array.isArray(comparaveis) ? comparaveis : [];

  const toNumber = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
  const ensurePageSpace = (needed: number, resetHeader = false) => {
    if (y + needed <= ph - 12) return;
    doc.addPage();
    y = 18;

    if (resetHeader) {
      doc.setFontSize(12);
      doc.setTextColor(...TEXT_DARK);
      doc.setFont("helvetica", "bold");
      doc.text(sanitizePdfText(imovel.titulo, "Imóvel"), m, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_MUTED);
      const meta = doc.splitTextToSize(joinPdfMeta(imovel.tipo, imovel.operacao, `${toNumber(imovel.area)}m²`, `${toNumber(imovel.quartos)}q`, [imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", ")), cw);
      doc.text(meta, m, y);
      y += meta.length * 4 + 4;
    }
  };

  let y = 14;

  // Header bar
  doc.setFillColor(...BLUE_ACCENT);
  doc.rect(0, 0, pw, 28, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("AVALIAÇÃO DE MERCADO", m, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 215, 255);
  doc.text(joinPdfMeta(brand, new Date().toLocaleDateString("pt-BR")), m, 20);
  if (corretorInfo?.creci) doc.text(`CRECI: ${sanitizePdfText(corretorInfo.creci)}`, pw - m, 20, { align: "right" });

  y = 36;

  // Property info
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_DARK);
  doc.setFont("helvetica", "bold");
  const compactTitle = doc.splitTextToSize(sanitizePdfText(imovel.titulo, "Imóvel"), cw);
  doc.text(compactTitle, m, y);
  y += compactTitle.length * 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  const loc = sanitizePdfText([imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", "), "—");
  const compactMeta = doc.splitTextToSize(joinPdfMeta(imovel.tipo, imovel.operacao, `${toNumber(imovel.area)}m²`, `${toNumber(imovel.quartos)}q`, loc), cw);
  doc.text(compactMeta, m, y);
  y += compactMeta.length * 4 + 6;

  // Value cards row
  ensurePageSpace(30);
  const cardW = (cw - 6) / 3;
  const values = [
    { label: "MÍNIMO", val: toNumber(avaliacao.valor_minimo), color: ORANGE },
    { label: "IDEAL", val: toNumber(avaliacao.valor_ideal), color: BLUE_ACCENT },
    { label: "MÁXIMO", val: toNumber(avaliacao.valor_maximo), color: GREEN },
  ];
  values.forEach((v, i) => {
    const x = m + i * (cardW + 3);
    doc.setFillColor(245, 247, 252);
    doc.roundedRect(x, y, cardW, 20, 2, 2, "F");
    doc.setFillColor(...v.color);
    doc.rect(x, y, cardW, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_LABEL);
    doc.text(v.label, x + 4, y + 9);
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(formatK(v.val), x + 4, y + 17);
    doc.setFont("helvetica", "normal");
  });
  y += 28;

  // Metrics row
  ensurePageSpace(18);
  const metricW = (cw - 9) / 4;
  const metrics = [
    { label: "R$/m² Est.", val: formatBRL(toNumber(avaliacao.preco_m2_estimado)) },
    { label: "R$/m² Região", val: formatBRL(toNumber(avaliacao.preco_m2_regiao)) },
    { label: "Liquidez", val: `${toNumber(avaliacao.score_liquidez)}/100` },
    { label: "Venda 90d", val: `${toNumber(avaliacao.probabilidade_venda_90dias)}%` },
  ];
  metrics.forEach((mt, i) => {
    const x = m + i * (metricW + 3);
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_LABEL);
    doc.text(mt.label, x, y);
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(mt.val, x, y + 5.5);
    doc.setFont("helvetica", "normal");
  });
  y += 14;

  // Divider
  ensurePageSpace(10);
  doc.setDrawColor(...DIVIDER);
  doc.line(m, y, pw - m, y);
  y += 6;

  // Analysis summary
  if (avaliacao.analise_resumo) {
    ensurePageSpace(20, true);
    doc.setFontSize(9);
    doc.setTextColor(...BLUE_HEADING);
    doc.setFont("helvetica", "bold");
    doc.text("Análise", m, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_BODY);
    const lines = doc.splitTextToSize(sanitizePdfText(avaliacao.analise_resumo), cw);
    const maxLines = Math.min(lines.length, 8);
    for (let i = 0; i < maxLines; i++) {
      ensurePageSpace(6, true);
      doc.text(lines[i], m, y);
      y += 4;
    }
    y += 4;
  }

  // Comparables (compact table)
  if (safeComparaveis.length) {
    ensurePageSpace(50, true);
    doc.setFontSize(9);
    doc.setTextColor(...BLUE_HEADING);
    doc.setFont("helvetica", "bold");
    doc.text("Comparáveis", m, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Imóvel", "Preço", "Área", "R$/m²", "Tempo"]],
      body: safeComparaveis.slice(0, 6).map(c => [
        sanitizePdfText(c.titulo).substring(0, 22),
        formatK(toNumber(c.preco)),
        `${toNumber(c.area)}m²`,
        formatK(toNumber(c.area) > 0 ? toNumber(c.preco) / toNumber(c.area) : 0),
        sanitizePdfText(c.dias_anuncio ? `${c.dias_anuncio}d` : "—"),
      ]),
      theme: "plain",
      headStyles: { fillColor: [240, 242, 248], textColor: [60, 68, 95], fontSize: 6.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 6.5, textColor: [50, 55, 75] },
      margin: { left: m, right: m },
      styles: { cellPadding: 1.8 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(160, 165, 185);
    doc.text(joinPdfMeta(brand, `Avaliação gerada em ${new Date().toLocaleDateString("pt-BR")}`, `${i}/${pageCount}`), pw / 2, ph - 6, { align: "center" });
  }

  if (!skipSave) {
    savePDF(doc, imovel, "Compacto");
  }

  return doc;
}

// ─── Shared save helper ───
function savePDF(doc: jsPDF, imovel: any, suffix: string) {
  const filename = `Avaliacao_${suffix}_${sanitizeFilenamePart(imovel.titulo)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  try {
    doc.save(filename);
  } catch {
    const blob = doc.output("blob");
    downloadPdfBlob(blob, filename);
  }
}

// ─── Share PDF via Web Share API or fallback to download ───
export async function shareAvaliacaoPDF(options: ExportOptions) {
  const { imovel, layout = "gamma" } = options;
  const suffix = layout === "executivo" ? "Executivo" : layout === "compacto" ? "Compacto" : "Gamma";
  const filename = `Avaliacao_${suffix}_${sanitizeFilenamePart(imovel.titulo)}_${new Date().toISOString().slice(0, 10)}.pdf`;

  const doc = await exportAvaliacaoPDF({ ...options, layout, skipSave: true });
  const capturedBlob = doc.output("blob");

  const file = new File([capturedBlob], filename, { type: "application/pdf" });

  try {
    const canUseNavigatorShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
    const canShareFile = typeof navigator?.canShare !== "function" || navigator.canShare({ files: [file] });

    if (canUseNavigatorShare && canShareFile) {
      await navigator.share({
        title: `Avaliação - ${sanitizePdfText(imovel.titulo, "Imóvel")}`,
        text: `Avaliação Profissional: ${sanitizePdfText(imovel.titulo, "Imóvel")}`,
        files: [file],
      });
      return;
    }
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
  }

  downloadPdfBlob(capturedBlob, filename);
}
