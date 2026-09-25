import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Contrato } from "@/hooks/useContratos";
import { parseContratoImportFile } from "@/lib/contratosSpreadsheet";

interface ImportContratosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contratos: Partial<Contrato>[]) => Promise<{ success: number; errors: number }>;
}

export function ImportContratosDialog({ open, onOpenChange, onImport }: ImportContratosDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Partial<Contrato>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setParsed([]);
    setErrors([]);
    setFileName("");
    setParsing(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setParsed([]);
    setErrors([]);

    try {
      const { items, errors: parseErrors } = await parseContratoImportFile(file);
      setParsed(items);
      setErrors(items.length === 0 ? [...parseErrors, ...(parseErrors.length === 0 ? ["Nenhum contrato válido encontrado"] : [])] : parseErrors);
    } catch (err: any) {
      console.error("[ImportContratos] Parse error:", err);
      setErrors([`Erro ao ler arquivo: ${err?.message || "Formato não suportado"}`]);
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    try {
      const { success, errors: importErrors } = await onImport(parsed);

      if (success === 0) {
        toast({
          title: "Nenhum contrato importado",
          description: importErrors > 0 ? `${importErrors} registro(s) com erro ou duplicado.` : "Verifique o arquivo e tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: `${success} contrato${success > 1 ? "s" : ""} importado${success > 1 ? "s" : ""}!`,
        description: importErrors > 0 ? `${importErrors} registro(s) com erro ou duplicado.` : undefined,
      });

      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[ImportContratos] Import error:", err);
      toast({ title: "Erro na importação", description: err?.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Importar Contratos</DialogTitle>
          <DialogDescription>Importe contratos a partir de Excel, CSV ou TXT tabulado. A exportação do módulo já sai compatível com essa importação.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.ods,.csv,.txt" onChange={handleFile} className="hidden" />
          <Button variant="outline" className="w-full h-20 border-dashed flex flex-col gap-2" onClick={() => fileRef.current?.click()} disabled={parsing}>
            {parsing ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <FileSpreadsheet className="w-6 h-6 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">{parsing ? "Lendo arquivo..." : fileName || "Clique para selecionar arquivo de contratos"}</span>
          </Button>

          {errors.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-1 max-h-32 overflow-auto">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />{e}
                </p>
              ))}
            </div>
          )}

          {parsed.length > 0 && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-3">
              <p className="text-sm font-medium text-success flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />{parsed.length} contratos prontos para importar
              </p>
              <div className="mt-2 max-h-40 overflow-auto space-y-1">
                {parsed.slice(0, 10).map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {c.titulo} · {c.cliente} · {c.tipo} · {c.valor ? `R$ ${c.valor.toLocaleString("pt-BR")}` : ""}
                  </p>
                ))}
                {parsed.length > 10 && <p className="text-xs text-muted-foreground">...e mais {parsed.length - 10}</p>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleImport} disabled={parsed.length === 0 || importing}>
            {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Importar {parsed.length > 0 ? `(${parsed.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
