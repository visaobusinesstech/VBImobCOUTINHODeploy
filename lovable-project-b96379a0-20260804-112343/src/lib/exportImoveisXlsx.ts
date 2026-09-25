import * as XLSX from "xlsx";

export type ImovelCaptado = {
  id: string;
  tipo_imovel: string | null;
  operacao: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  preco: number | null;
  condominio_valor: number | null;
  iptu_valor: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  area_util: number | null;
  area_total: number | null;
  andar: number | null;
  mobiliado: boolean | null;
  aceita_pet: boolean | null;
  aceita_financiamento: boolean | null;
  descricao: string | null;
  midias: any;
  contato: string | null;
  proprietario_nome: string | null;
  score: number | null;
  status: string | null;
  grupo_nome: string | null;
  grupo_invite_url: string | null;
  grupo_categoria: string | null;
  data_mensagem: string | null;
  mensagem_original: string | null;
  created_at: string;
};

const HEADERS: Array<[keyof ImovelCaptado | "midias_urls", string]> = [
  ["created_at", "Captado em"],
  ["tipo_imovel", "Tipo"],
  ["operacao", "Operação"],
  ["endereco", "Endereço"],
  ["bairro", "Bairro"],
  ["cidade", "Cidade"],
  ["uf", "UF"],
  ["preco", "Valor (R$)"],
  ["condominio_valor", "Condomínio (R$)"],
  ["iptu_valor", "IPTU (R$)"],
  ["quartos", "Quartos"],
  ["suites", "Suítes"],
  ["banheiros", "Banheiros"],
  ["vagas", "Vagas"],
  ["area_util", "Área útil (m²)"],
  ["area_total", "Área total (m²)"],
  ["andar", "Andar"],
  ["mobiliado", "Mobiliado"],
  ["aceita_pet", "Aceita pet"],
  ["aceita_financiamento", "Aceita financiamento"],
  ["proprietario_nome", "Proprietário"],
  ["contato", "Contato"],
  ["descricao", "Descrição"],
  ["midias_urls", "Mídias (URLs)"],
  ["grupo_nome", "Grupo de origem"],
  ["grupo_categoria", "Categoria do grupo"],
  ["grupo_invite_url", "Link do grupo"],
  ["data_mensagem", "Data da mensagem"],
  ["mensagem_original", "Mensagem original"],
  ["score", "Score"],
  ["status", "Status"],
];

function fmtBool(v: any) {
  if (v === true) return "Sim";
  if (v === false) return "Não";
  return "";
}

function midiasUrls(m: any): string {
  if (!Array.isArray(m)) return "";
  return m.map((x: any) => x?.url ?? "").filter(Boolean).join(" | ");
}

function toRow(i: ImovelCaptado) {
  const out: any = {};
  for (const [k, label] of HEADERS) {
    let v: any;
    if (k === "midias_urls") v = midiasUrls(i.midias);
    else v = (i as any)[k];
    if (k === "mobiliado" || k === "aceita_pet" || k === "aceita_financiamento") v = fmtBool(v);
    if (v === null || v === undefined) v = "";
    out[label] = v;
  }
  return out;
}

export function exportImoveisXlsx(imoveis: ImovelCaptado[], filename = "imoveis-captados.xlsx") {
  const ws = XLSX.utils.json_to_sheet(imoveis.map(toRow), {
    header: HEADERS.map(([, l]) => l),
  });
  ws["!cols"] = HEADERS.map(([k]) => {
    if (k === "descricao" || k === "mensagem_original") return { wch: 60 };
    if (k === "midias_urls" || k === "grupo_invite_url") return { wch: 40 };
    if (k === "endereco" || k === "grupo_nome") return { wch: 28 };
    return { wch: 16 };
  });
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as any;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Imóveis Captados");
  XLSX.writeFile(wb, filename);
}

export function exportImoveisCsv(imoveis: ImovelCaptado[], filename = "imoveis-captados.csv") {
  const rows = imoveis.map(toRow);
  const headers = HEADERS.map(([, l]) => l);
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(";") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(";")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
