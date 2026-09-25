import { useState, useRef, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, X, Download, FileSpreadsheet, Filter } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useLeads, ESTAGIOS, type Lead } from "@/hooks/useLeads";
import { useFollowups } from "@/hooks/useFollowups";
import { useToast } from "@/hooks/use-toast";
import { CANAIS_ORIGEM } from "@/lib/canaisOrigem";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { read, utils, writeFile } from "xlsx";


interface ParsedLead {
  nome: string;
  telefone?: string;
  email?: string;
  interesse?: string;
  valor?: number;
  tipo_operacao?: string;
  canal_origem?: string;
  estagio?: string;
  corretor?: string;
  observacoes?: string;
}

interface ImportExportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  defaultTab?: "import" | "export";
}

/**
 * Ordem canônica compartilhada por Template / Exportação / Importação.
 * Garante que planilhas exportadas de uma conta possam ser reimportadas
 * em outra sem embaralhar campos (fallback posicional usa esta ordem).
 */
const CANONICAL_COLUMNS: Array<{ key: keyof ParsedLead; header: string }> = [
  { key: "nome", header: "nome" },
  { key: "telefone", header: "telefone" },
  { key: "email", header: "email" },
  { key: "interesse", header: "interesse" },
  { key: "valor", header: "valor" },
  { key: "tipo_operacao", header: "tipo_operacao" },
  { key: "canal_origem", header: "canal_origem" },
  { key: "estagio", header: "estagio" },
  { key: "corretor", header: "corretor" },
  { key: "observacoes", header: "observacoes" },
];

const COLUMN_MAP: Record<string, keyof ParsedLead> = {
  nome: "nome", name: "nome", cliente: "nome", nome_completo: "nome", cliente_nome: "nome", contato: "nome",
  telefone: "telefone", phone: "telefone", tel: "telefone", celular: "telefone", whatsapp: "telefone", fone: "telefone",
  email: "email", "e_mail": "email", "e-mail": "email",
  interesse: "interesse", interest: "interesse", imovel_interesse: "interesse",
  valor: "valor", value: "valor", price: "valor", valor_imovel: "valor", preco: "valor",
  tipo_operacao: "tipo_operacao", tipo: "tipo_operacao", operacao: "tipo_operacao",
  canal_origem: "canal_origem", canal: "canal_origem", origem: "canal_origem",
  estagio: "estagio", stage: "estagio", etapa: "estagio", fase: "estagio",
  corretor: "corretor", responsavel: "corretor", corretor_nome: "corretor", agent: "corretor",
  observacoes: "observacoes", obs: "observacoes", notas: "observacoes", notes: "observacoes", observacao: "observacoes",
};

function normalizeColumn(col: string): keyof ParsedLead | null {
  const clean = col
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return COLUMN_MAP[clean] || null;
}

function parseCurrencyValue(value: string): number {
  const cleaned = value.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      const parsed = Number(cleaned.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = Number(cleaned.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(hasComma ? cleaned.replace(",", ".") : cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const POSITIONAL_COLUMN_MAP: Array<keyof ParsedLead> = CANONICAL_COLUMNS.map(c => c.key);


function mapRowsToLeads(rows: unknown[][]): ParsedLead[] {
  if (rows.length === 0) return [];

  const headers = (rows[0] ?? []).map(col => String(col ?? "").trim());
  let mappedHeaders = headers.map(h => normalizeColumn(h));
  const recognizedColumns = mappedHeaders.filter(Boolean).length;

  let dataRows = rows.slice(1);

  if (recognizedColumns === 0) {
    mappedHeaders = headers.map((_, index) => POSITIONAL_COLUMN_MAP[index] ?? null);
    dataRows = rows;
  } else if (!mappedHeaders.some(h => h === "nome") && mappedHeaders.length > 0) {
    mappedHeaders = mappedHeaders.map((header, index) => (index === 0 ? "nome" : header));
  }

  return dataRows
    .map((row) => {
      const lead: Partial<ParsedLead> = {};

      mappedHeaders.forEach((mapped, index) => {
        const raw = row?.[index];
        if (!mapped || raw === undefined || raw === null) return;

        const value = String(raw).trim();
        if (!value) return;

        (lead as any)[mapped] = mapped === "valor" ? parseCurrencyValue(value) : value;
      });

      return lead as ParsedLead;
    })
    .filter((lead) => Boolean(lead.nome?.trim()));
}

function parseTxt(text: string): ParsedLead[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : lines[0].includes(",") ? "," : null;
  if (!sep) {
    return lines.map((line) => ({ nome: line }));
  }

  const rows = lines.map((line) => line.split(sep).map((value) => value.trim()));
  return mapRowsToLeads(rows);
}

function parseSpreadsheet(buffer: ArrayBuffer): ParsedLead[] {
  const wb = read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][];

  return mapRowsToLeads(rows);
}

const ESTAGIO_LABELS: Record<string, string> = Object.fromEntries(ESTAGIOS.map(e => [e.id, e.title]));
const ESTAGIO_IDS = new Set<string>(ESTAGIOS.map(e => e.id as string));
const normStr = (s: string) =>
  s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const ESTAGIO_LABEL_TO_ID: Record<string, string> = Object.fromEntries(
  ESTAGIOS.map(e => [normStr(e.title), e.id]),
);
function resolveEstagio(raw?: string): string {
  if (!raw) return "novos";
  const v = normStr(raw);
  if (ESTAGIO_IDS.has(v)) return v;
  return ESTAGIO_LABEL_TO_ID[v] || "novos";
}
function resolveTipoOperacao(raw?: string): string {
  if (!raw) return "venda";
  const v = normStr(raw);
  if (v.startsWith("alug") || v === "locacao") return "aluguel";
  return "venda";
}


export function ImportExportLeadsDialog({ open, onOpenChange, leads, defaultTab = "import" }: ImportExportLeadsDialogProps) {
  const { createLead, corretores: leadsCorretores } = useLeads();
  const { createFollowup } = useFollowups();
  const { imobiliariaId, user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState(defaultTab);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedLead[]>([]);
  const [parsingFile, setParsingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number; duplicates?: number } | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("xlsx");
  const [filterEstagio, setFilterEstagio] = useState<string>("todos");
  const [filterCorretor, setFilterCorretor] = useState<string>("todos");
  const [importCanalOrigem, setImportCanalOrigem] = useState<string>("importacao");
  const [importCanalCustom, setImportCanalCustom] = useState<string>("");
  const [importCorretorId, setImportCorretorId] = useState<string>("");

  const corretorNames = [...new Set(leads.map(l => l.corretor_nome).filter(Boolean))] as string[];
  const filteredLeads = leads.filter(l => {
    if (filterEstagio !== "todos" && l.estagio !== filterEstagio) return false;
    if (filterCorretor !== "todos" && (l.corretor_nome || "") !== filterCorretor) return false;
    return true;
  });
  const reset = () => {
    setFileName("");
    setParsed([]);
    setParsingFile(false);
    setResult(null);
    setFilterEstagio("todos");
    setFilterCorretor("todos");
    setImportCanalOrigem("importacao");
    setImportCanalCustom("");
    setImportCorretorId("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const processFile = useCallback(async (file: File) => {
    setResult(null);
    setFileName(file.name);
    setParsingFile(true);
    setParsed([]);

    try {
      let parsedLeads: ParsedLead[] = [];
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isBinary = ["xlsx", "xls", "ods"].includes(ext);

      if (isBinary) {
        const buffer = await file.arrayBuffer();
        parsedLeads = parseSpreadsheet(buffer);
      } else {
        const text = await file.text();
        parsedLeads = parseTxt(text);
      }

      setParsed(parsedLeads);


      if (parsedLeads.length === 0) {
        toast({
          title: "Arquivo sem leads válidos",
          description: "Não reconheci linhas com nome. Baixe o modelo CSV e tente novamente.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("[ImportLeads] Error:", err);
      toast({ title: "Erro ao ler arquivo", description: String(err), variant: "destructive" });
      setParsed([]);
    } finally {
      setParsingFile(false);
    }
  }, [toast]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (parsingFile) {
      toast({ title: "Processando arquivo", description: "Aguarde a leitura terminar.", variant: "destructive" });
      return;
    }
    if (!fileName || parsed.length === 0) {
      toast({ title: "Nada para importar", description: "Selecione um arquivo com leads válidos.", variant: "destructive" });
      return;
    }

    setImporting(true);
    let excluded = 0;
    let duplicates = 0;

    // Build exclusion set: configured names + corretor names (normalized uppercase)
    const excludedNames = new Set<string>();

    // Fetch configured exclusion names
    if (user) {
      const { data: configData } = await supabase
        .from("imobiliaria_config")
        .select("nomes_excluidos_importacao")
        .eq("user_id", user.id)
        .maybeSingle();
      const configNames = (configData as any)?.nomes_excluidos_importacao || [];
      for (const name of configNames) {
        if (name) excludedNames.add(String(name).toUpperCase().trim());
      }
    }

    for (const c of leadsCorretores) {
      if (c.nome) excludedNames.add(c.nome.toUpperCase().trim());
    }

    // Build sets for duplicate detection
    const existingPhones = new Set(
      leads.filter(l => l.telefone).map(l => l.telefone!.replace(/\D/g, ""))
    );
    const existingEmails = new Set(
      leads.filter(l => l.email).map(l => l.email!.toLowerCase().trim())
    );

    // Filter leads
    const toImport: ParsedLead[] = [];
    for (const lead of parsed) {
      // Exclude by name (owner + corretores)
      if (excludedNames.has(lead.nome.toUpperCase().trim())) {
        excluded++;
        continue;
      }
      // Exclude duplicates
      const phone = lead.telefone?.replace(/\D/g, "") || "";
      const email = lead.email?.toLowerCase().trim() || "";
      if ((phone && existingPhones.has(phone)) || (email && existingEmails.has(email))) {
        duplicates++;
        continue;
      }
      toImport.push(lead);
      if (phone) existingPhones.add(phone);
      if (email) existingEmails.add(email);
    }

    

    if (toImport.length === 0) {
      setImporting(false);
      setResult({ success: 0, errors: 0, duplicates: duplicates + excluded });
      toast({ title: "Nenhum lead novo", description: `${excluded} excluído(s) por regra, ${duplicates} duplicado(s).` });
      return;
    }

    // Build corretor name → id lookup for match by name from imported file
    const corretorByName = new Map<string, string>();
    for (const c of leadsCorretores) {
      if (c.nome) corretorByName.set(normStr(c.nome), c.id);
    }

    // Batch insert directly into Supabase for speed
    const payloads = toImport.map((lead, i) => {
      const matchedCorretorId = lead.corretor ? corretorByName.get(normStr(lead.corretor)) : undefined;
      return {
        nome: lead.nome,
        telefone: lead.telefone || null,
        email: lead.email || null,
        interesse: lead.interesse || null,
        valor: lead.valor || 0,
        tipo_operacao: resolveTipoOperacao(lead.tipo_operacao),
        canal_origem: lead.canal_origem || (importCanalOrigem === "custom" ? (importCanalCustom || "importacao") : importCanalOrigem) || "importacao",
        observacoes: lead.observacoes || null,
        estagio: resolveEstagio(lead.estagio) as Lead["estagio"],
        posicao: i,
        imobiliaria_id: imobiliariaId,
        corretor_id: matchedCorretorId || importCorretorId || null,
      };
    });


    // Insert in chunks of 500 for max speed
    let success = 0;
    let errors = 0;
    const CHUNK = 500;
    setImportProgress({ current: 0, total: payloads.length });
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const chunk = payloads.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("leads")
        .insert(chunk as any)
        .select("id");

      if (error) {
        console.error("[ImportLeads] Batch error:", error.message);
        errors += chunk.length;
      } else {
        success += (data?.length ?? 0);
      }
      setImportProgress({ current: Math.min(i + chunk.length, payloads.length), total: payloads.length });
    }

    setImporting(false);
    setResult({ success, errors, duplicates: duplicates + excluded });
    const parts = [`${success} leads importados!`];
    if (excluded > 0) parts.push(`${excluded} excluído(s) (corretor/proprietário).`);
    if (duplicates > 0) parts.push(`${duplicates} duplicado(s).`);
    toast({ title: "Importação concluída", description: parts.join(" ") });
  };

  const downloadTemplate = () => {
    const headers = CANONICAL_COLUMNS.map(c => c.header);
    const sample1 = ["João Silva", "11999990000", "joao@email.com", "Apartamento 2 quartos", "500000", "venda", "indicacao", "novos", "", "Cliente VIP — retornar em 24h"];
    const sample2 = ["Maria Santos", "11988880000", "maria@email.com", "Casa em condomínio", "800000", "venda", "portal_imoveis", "qualificados", "", "Prefere contato à noite"];
    const csv = [headers.join(";"), sample1.join(";"), sample2.join(";")].join("\n") + "\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modelo_leads.csv";
    link.click();
  };

  const handleExport = () => {
    // Usa exatamente a mesma ordem/nomes de coluna do template e da importação
    // para permitir round-trip entre contas sem embaralhar campos.
    const data = filteredLeads.map(l => {
      const row: Record<string, string | number> = {};
      row["nome"] = l.nome;
      row["telefone"] = l.telefone || "";
      row["email"] = l.email || "";
      row["interesse"] = l.interesse || "";
      row["valor"] = l.valor ?? 0;
      row["tipo_operacao"] = l.tipo_operacao === "aluguel" ? "aluguel" : "venda";
      row["canal_origem"] = l.canal_origem || "";
      row["estagio"] = l.estagio || "";
      row["corretor"] = l.corretor_nome || "";
      row["observacoes"] = l.observacoes || "";
      return row;
    });


    if (exportFormat === "csv") {
      const headers = Object.keys(data[0] || {});
      const csvContent = [headers.join(";"), ...data.map(row => headers.map(h => `"${String((row as any)[h]).replace(/"/g, '""')}"`).join(";"))].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `leads_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } else {
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Leads");
      // Auto-width columns
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String((row as any)[key]).length)) + 2
      }));
      ws["!cols"] = colWidths;
      writeFile(wb, `leads_${new Date().toISOString().split("T")[0]}.xlsx`);
    }

    toast({ title: "Exportação concluída", description: `${filteredLeads.length} leads exportados com sucesso.` });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar & Exportar Leads
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as "import" | "export"); reset(); }}>
          <TabsList className="w-full">
            <TabsTrigger value="import" className="flex-1 gap-1.5">
              <Upload className="w-3.5 h-3.5" />Importar
            </TabsTrigger>
            <TabsTrigger value="export" className="flex-1 gap-1.5">
              <Download className="w-3.5 h-3.5" />Exportar
            </TabsTrigger>
          </TabsList>

          {/* === IMPORT TAB === */}
          <TabsContent value="import">
            {!result ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Leads importados vão direto para o estágio <span className="font-semibold text-primary">"Novos Leads"</span> (primeiro atendimento) com follow-up automático.
                </p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Arraste um arquivo ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">CSV, TXT, XLSX, XLS, ODS</p>
                  <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls,.ods" onChange={handleFile} className="hidden" />
                </div>

                {fileName && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">{fileName}</span>
                    <button onClick={reset} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                )}

                {fileName && parsed.length === 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Não encontrei linhas válidas com nome. Tente baixar e preencher o modelo CSV.
                  </p>
                )}

                {parsed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      {parsed.length} lead(s) encontrado(s)
                    </p>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left p-1.5 font-medium text-muted-foreground">Nome</th>
                            <th className="text-left p-1.5 font-medium text-muted-foreground">Telefone</th>
                            <th className="text-left p-1.5 font-medium text-muted-foreground">Email</th>
                            <th className="text-right p-1.5 font-medium text-muted-foreground">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.slice(0, 50).map((l, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="p-1.5 text-foreground">{l.nome}</td>
                              <td className="p-1.5 text-muted-foreground">{l.telefone || "—"}</td>
                              <td className="p-1.5 text-muted-foreground">{l.email || "—"}</td>
                              <td className="p-1.5 text-right text-muted-foreground">{l.valor ? `R$ ${l.valor.toLocaleString("pt-BR")}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsed.length > 50 && <p className="text-xs text-center text-muted-foreground p-1">...e mais {parsed.length - 50} leads</p>}
                    </div>
                  </div>
                )}

                <button onClick={downloadTemplate} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Download className="w-3 h-3" />Baixar modelo CSV de exemplo
                </button>

                {parsed.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Canal de Origem</label>
                      <select
                        value={importCanalOrigem}
                        onChange={e => { setImportCanalOrigem(e.target.value); if (e.target.value !== "custom") setImportCanalCustom(""); }}
                        className="h-8 px-2 rounded-md bg-background border border-border text-sm text-foreground"
                      >
                        <option value="importacao">Importação (padrão)</option>
                        {CANAIS_ORIGEM.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                        <option value="custom">✏️ Digitar nome do canal...</option>
                      </select>
                      {importCanalOrigem === "custom" && (
                        <input
                          type="text"
                          value={importCanalCustom}
                          onChange={e => setImportCanalCustom(e.target.value)}
                          placeholder="Ex: Chave na Mão, OLX..."
                          className="h-8 px-2 rounded-md bg-background border border-border text-sm text-foreground mt-1"
                          autoFocus
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Corretor Responsável</label>
                      <select
                        value={importCorretorId}
                        onChange={e => setImportCorretorId(e.target.value)}
                        className="h-8 px-2 rounded-md bg-background border border-border text-sm text-foreground"
                      >
                        <option value="">Sem corretor</option>
                        {leadsCorretores.map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {importing && importProgress.total > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Importando leads...</span>
                      <span className="font-medium text-foreground">{importProgress.current} / {importProgress.total}</span>
                    </div>
                    <Progress value={(importProgress.current / importProgress.total) * 100} className="h-2" />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }} disabled={importing}>Cancelar</Button>
                  <Button onClick={handleImport} disabled={importing || parsingFile}>
                    {(importing || parsingFile) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {parsingFile ? "Processando arquivo..." : `Importar ${parsed.length > 0 ? `${parsed.length} leads` : ""}`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
                <p className="text-lg font-semibold text-foreground">{result.success} leads importados!</p>
                <p className="text-sm text-muted-foreground">Todos no estágio "Novos Leads" com follow-up para amanhã.</p>
                {(result.duplicates ?? 0) > 0 && (
                  <p className="text-sm text-amber-500 flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" />{result.duplicates} duplicado(s) ignorado(s) (telefone/email já existente)
                  </p>
                )}
                {result.errors > 0 && (
                  <p className="text-sm text-destructive flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" />{result.errors} erro(s) na importação
                  </p>
                )}
                <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
              </div>
            )}
          </TabsContent>

          {/* === EXPORT TAB === */}
          <TabsContent value="export">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Exportar <span className="font-semibold text-foreground">{filteredLeads.length}</span> de {leads.length} leads do pipeline para um arquivo.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Estágio</label>
                  <Select value={filterEstagio} onValueChange={setFilterEstagio}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os estágios</SelectItem>
                      {ESTAGIOS.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Corretor</label>
                  <Select value={filterCorretor} onValueChange={setFilterCorretor}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os corretores</SelectItem>
                      {corretorNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportFormat("xlsx")}
                  className={`p-4 rounded-xl border-2 text-center transition-colors ${exportFormat === "xlsx" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium text-foreground">Excel (.xlsx)</p>
                  <p className="text-xs text-muted-foreground">Planilha formatada</p>
                </button>
                <button
                  onClick={() => setExportFormat("csv")}
                  className={`p-4 rounded-xl border-2 text-center transition-colors ${exportFormat === "csv" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">CSV (.csv)</p>
                  <p className="text-xs text-muted-foreground">Texto separado</p>
                </button>
              </div>

              <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-1.5 font-medium text-muted-foreground">Nome</th>
                      <th className="text-left p-1.5 font-medium text-muted-foreground">Estágio</th>
                      <th className="text-right p-1.5 font-medium text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.slice(0, 10).map(l => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="p-1.5 text-foreground">{l.nome}</td>
                        <td className="p-1.5 text-muted-foreground">{ESTAGIO_LABELS[l.estagio] || l.estagio}</td>
                        <td className="p-1.5 text-right text-muted-foreground">R$ {l.valor.toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLeads.length > 10 && <p className="text-xs text-center text-muted-foreground p-1">...e mais {filteredLeads.length - 10} leads</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={handleExport} disabled={filteredLeads.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar {filteredLeads.length} leads
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
