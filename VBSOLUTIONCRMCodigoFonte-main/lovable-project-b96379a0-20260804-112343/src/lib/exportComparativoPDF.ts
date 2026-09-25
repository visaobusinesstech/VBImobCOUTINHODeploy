import jsPDF from "jspdf";
import "jspdf-autotable";
import type { Imovel } from "@/hooks/useImoveis";

interface ComparativoOptions {
  imoveis: Imovel[];
  brandName?: string;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const bool = (v: boolean | null | undefined) => (v ? "Sim" : "Não");

interface Row {
  label: string;
  values: (string | number | null | undefined)[];
}

function buildRows(imoveis: Imovel[]): Row[] {
  return [
    { label: "Tipo", values: imoveis.map((i) => i.tipo) },
    { label: "Operação", values: imoveis.map((i) => i.operacao) },
    { label: "Preço", values: imoveis.map((i) => fmt(i.preco)) },
    { label: "Área (m²)", values: imoveis.map((i) => i.area || "—") },
    {
      label: "Preço/m²",
      values: imoveis.map((i) =>
        i.area > 0 ? fmt(Math.round(i.preco / i.area)) : "—"
      ),
    },
    { label: "Quartos", values: imoveis.map((i) => i.quartos) },
    { label: "Suítes", values: imoveis.map((i) => i.suites) },
    { label: "Banheiros", values: imoveis.map((i) => i.banheiros) },
    { label: "Vagas", values: imoveis.map((i) => i.vagas) },
    { label: "Andar", values: imoveis.map((i) => i.andar || "—") },
    { label: "Posição Solar", values: imoveis.map((i) => i.posicao_solar || "—") },
    { label: "Bairro", values: imoveis.map((i) => i.bairro || "—") },
    { label: "Cidade", values: imoveis.map((i) => i.cidade || "—") },
    { label: "Condomínio", values: imoveis.map((i) => i.valor_condominio ? fmt(i.valor_condominio) : "—") },
    { label: "IPTU", values: imoveis.map((i) => i.valor_iptu ? fmt(i.valor_iptu) : "—") },
    {
      label: "Custo Total/mês",
      values: imoveis.map((i) => {
        if (i.operacao !== "Aluguel") return "N/A";
        return fmt(i.preco + (i.valor_condominio || 0) + (i.valor_iptu || 0));
      }),
    },
    { label: "Aceita Financiamento", values: imoveis.map((i) => bool(i.aceita_financiamento)) },
    { label: "Aceita FGTS", values: imoveis.map((i) => bool(i.aceita_fgts)) },
    { label: "Aceita Permuta", values: imoveis.map((i) => bool(i.aceita_permuta)) },
    { label: "Tem Escritura", values: imoveis.map((i) => bool(i.tem_escritura)) },
    { label: "Exclusivo", values: imoveis.map((i) => bool(i.exclusivo)) },
  ];
}

export function exportComparativoPDF({ imoveis, brandName }: ComparativoOptions) {
  if (imoveis.length < 2) return;

  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const brand = brandName || "ImobPro";

  // Header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(brand, 14, 16);

  doc.setFontSize(11);
  doc.text("Comparativo de Imóveis", pageWidth - 14, 16, { align: "right" });

  // Date
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    pageWidth - 14,
    24,
    { align: "right" }
  );

  // Property titles
  let y = 38;
  doc.setFontSize(10);
  doc.setTextColor(37, 99, 235);
  imoveis.forEach((im, idx) => {
    const col = idx + 1;
    doc.text(
      `Imóvel ${col}: ${im.titulo}`,
      14,
      y
    );
    y += 5;
  });

  y += 4;

  // Comparison table
  const rows = buildRows(imoveis);
  const head = [["Característica", ...imoveis.map((_, i) => `Imóvel ${i + 1}`)]];
  const body = rows.map((r) => [r.label, ...r.values.map((v) => String(v ?? "—"))]);

  (doc as any).autoTable({
    head,
    body,
    startY: y,
    theme: "striped",
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, halign: "left" },
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    didParseCell: (data: any) => {
      // Highlight price row
      if (data.row.index === 2 && data.column.index > 0) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [37, 99, 235];
      }
    },
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${brand} — Documento gerado automaticamente para fins de apresentação.`,
    pageWidth / 2,
    finalY,
    { align: "center" }
  );

  // Save with fallback
  const fileName = `comparativo_imoveis_${new Date().toISOString().slice(0, 10)}.pdf`;
  try {
    doc.save(fileName);
  } catch {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
