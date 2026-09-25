import jsPDF from "jspdf";

interface ExportConteudoSEOOptions {
  tipo: string;
  conteudo: any;
  brandName?: string;
}

export function exportConteudoSEOPDF({ tipo, conteudo, brandName }: ExportConteudoSEOOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const brand = brandName || "ImobPro";
  let y = 20;

  const addText = (text: string, size: number, color: number[] = [30, 30, 30], bold = false) => {
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    if (bold) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, pageWidth - 28);
    if (y + lines.length * (size * 0.5) > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, 14, y);
    y += lines.length * (size * 0.5) + 4;
  };

  // Header
  addText(brand, 18, [37, 99, 235], true);
  addText(getTipoLabel(tipo), 14, [30, 30, 30], true);
  addText(new Date().toLocaleDateString("pt-BR"), 9, [120, 120, 120]);
  y += 4;

  if (tipo === "descricao_imovel") {
    if (conteudo.titulo_seo) { addText("Título SEO", 11, [37, 99, 235], true); addText(conteudo.titulo_seo, 10); }
    if (conteudo.meta_description) { addText("Meta Description", 11, [37, 99, 235], true); addText(conteudo.meta_description, 10); }
    if (conteudo.headline_anuncio) { addText("Headline Anúncio", 11, [37, 99, 235], true); addText(conteudo.headline_anuncio, 10); }
    if (conteudo.descricao_curta) { addText("Descrição Curta", 11, [37, 99, 235], true); addText(conteudo.descricao_curta, 10); }
    if (conteudo.descricao_completa) { addText("Descrição Completa", 11, [37, 99, 235], true); addText(conteudo.descricao_completa, 10); }
    if (conteudo.palavras_chave?.length) { addText("Palavras-chave", 11, [37, 99, 235], true); addText(conteudo.palavras_chave.join(", "), 10); }
    if (conteudo.hashtags?.length) { addText("Hashtags", 11, [37, 99, 235], true); addText(conteudo.hashtags.join(" "), 10); }
  } else if (tipo === "post_blog") {
    if (conteudo.titulo) { addText(conteudo.titulo, 13, [30, 30, 30], true); }
    if (conteudo.meta_description) { addText("Meta: " + conteudo.meta_description, 9, [120, 120, 120]); }
    if (conteudo.introducao) { addText(conteudo.introducao, 10); }
    conteudo.secoes?.forEach((s: any) => {
      addText(s.subtitulo, 11, [37, 99, 235], true);
      addText(s.conteudo, 10);
    });
    if (conteudo.conclusao) { addText("Conclusão", 11, [37, 99, 235], true); addText(conteudo.conclusao, 10); }
  } else if (tipo === "meta_tags") {
    Object.entries(conteudo).forEach(([key, val]) => {
      if (typeof val === "string") { addText(key.replace(/_/g, " ").toUpperCase(), 11, [37, 99, 235], true); addText(val, 10); }
      if (Array.isArray(val)) { addText(key.toUpperCase(), 11, [37, 99, 235], true); addText((val as string[]).join(", "), 10); }
    });
  } else if (tipo === "texto_portal") {
    conteudo.portais?.forEach((p: any) => {
      addText(p.portal, 12, [37, 99, 235], true);
      addText("Título: " + p.titulo, 10, [30, 30, 30], true);
      addText(p.descricao, 10);
      y += 4;
    });
  }

  try {
    doc.save(`conteudo-seo-${tipo}-${Date.now()}.pdf`);
  } catch {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conteudo-seo-${tipo}-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function getTipoLabel(tipo: string) {
  const map: Record<string, string> = {
    descricao_imovel: "Descrição de Imóvel - SEO",
    post_blog: "Post para Blog - SEO",
    meta_tags: "Meta Tags - SEO",
    texto_portal: "Textos para Portais - SEO",
  };
  return map[tipo] || "Conteúdo SEO";
}
