import { useCallback, useEffect, useMemo, useState } from "react";

import { Check, FileText, Loader2, Receipt, Upload, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContratoFileViewerDialog } from "@/components/contratos/ContratoFileViewerDialog";
import { useContratoFileViewer } from "@/hooks/useContratoFileViewer";
import { DEFAULT_CONTRATO_FILE_ACCEPT, getSafeFileExtension } from "@/lib/contratoFilePreview";
import { uploadContratoFilePrivate } from "@/lib/contratosStorage";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Comprovante = {
  id: string;
  ano: number;
  mes: number;
  arquivo_url: string;
  label: string;
  recebido: boolean;
};

interface Props {
  contratoId?: string | null;
  startYear?: number | null;
}

export function ContratoComprovantesMensaisSection({ contratoId, startYear }: Props) {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const { viewerState, openContratoFileViewer, closeContratoFileViewer } = useContratoFileViewer();
  const [comprovantes, setComprovantes] = useState<Comprovante[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const anoBase = typeof startYear === "number" && Number.isFinite(startYear) ? startYear : currentYear;
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    for (let y = anoBase; y <= currentYear + 1; y++) anos.add(y);
    comprovantes.forEach((c) => anos.add(c.ano));
    return Array.from(anos).sort((a, b) => b - a);
  }, [anoBase, currentYear, comprovantes]);

  const [anoSelecionado, setAnoSelecionado] = useState<number>(currentYear);

  const fetchComprovantes = useCallback(async () => {
    if (!contratoId) { setComprovantes([]); return; }
    const { data, error } = await supabase
      .from("contrato_comprovantes_mensais" as any)
      .select("id, ano, mes, arquivo_url, label, recebido")
      .eq("contrato_id", contratoId)
      .order("ano", { ascending: true })
      .order("mes", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar comprovantes", description: error.message, variant: "destructive" });
      return;
    }
    setComprovantes(((data ?? []) as unknown as Comprovante[]) || []);
  }, [contratoId, toast]);

  useEffect(() => { void fetchComprovantes(); }, [fetchComprovantes]);

  const handleUpload = async (mes: number, file: File) => {
    if (!contratoId || !imobiliariaId) {
      toast({ title: "Salve o contrato antes de anexar comprovantes", variant: "destructive" });
      return;
    }
    const key = `${anoSelecionado}-${mes}`;
    setUploadingKey(key);
    try {
      const ext = getSafeFileExtension(file);
      const path = `${contratoId}/comprovantes/${anoSelecionado}_${mes}_${Date.now()}.${ext}`;
      const storedPath = await uploadContratoFilePrivate(file, path);
      if (!storedPath) throw new Error("Falha ao enviar arquivo");

      const existing = comprovantes.find((c) => c.ano === anoSelecionado && c.mes === mes);
      const payload = {
        contrato_id: contratoId,
        imobiliaria_id: imobiliariaId,
        ano: anoSelecionado,
        mes,
        label: `Comprovante ${MESES[mes - 1]} ${anoSelecionado}`,
        arquivo_url: storedPath,
      };

      if (existing) {
        const { error } = await supabase.from("contrato_comprovantes_mensais" as any).update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contrato_comprovantes_mensais" as any).insert(payload);
        if (error) throw error;
      }
      toast({ title: `Comprovante de ${MESES[mes - 1]}/${anoSelecionado} anexado!` });
      await fetchComprovantes();
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploadingKey(null);
    }
  };

  const handleToggleRecebido = async (comp: Comprovante) => {
    setTogglingId(comp.id);
    try {
      const { error } = await supabase
        .from("contrato_comprovantes_mensais" as any)
        .update({ recebido: !comp.recebido } as any)
        .eq("id", comp.id);
      if (error) throw error;
      setComprovantes((prev) =>
        prev.map((c) => (c.id === comp.id ? { ...c, recebido: !c.recebido } : c))
      );
      toast({
        title: !comp.recebido
          ? `✅ ${MESES[comp.mes - 1]}/${comp.ano} confirmado como recebido`
          : `${MESES[comp.mes - 1]}/${comp.ano} desmarcado`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar status", description: err.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpen = async (pathOrUrl: string, id: string) => {
    setOpeningFile(id);
    try {
      await openContratoFileViewer(pathOrUrl, undefined, contratoId ? { contractId: contratoId, sourceTable: "contrato_comprovantes_mensais", recordId: id } : undefined);
    } finally {
      setOpeningFile(null);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contrato_comprovantes_mensais" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover comprovante", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Comprovante removido" });
    await fetchComprovantes();
  };

  const comprovantesFiltrados = comprovantes.filter((c) => c.ano === anoSelecionado);
  const totalAnexados = comprovantesFiltrados.length;
  const totalRecebidos = comprovantesFiltrados.filter((c) => c.recebido).length;

  return (
    <>
      <div className="space-y-3 rounded-lg border-2 border-green-500/30 bg-green-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
          <Receipt className="h-5 w-5 text-green-600" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              🧾 Comprovantes Mensais de Pagamento
            </p>
            <span className="inline-flex items-center rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700">
              {totalAnexados}/12 meses
            </span>
            {totalRecebidos > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                ✅ {totalRecebidos} recebido{totalRecebidos > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Anexe o comprovante e confirme o recebimento de cada mês.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs">Ano:</Label>
        <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anosDisponiveis.map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {MESES.map((nomeMes, idx) => {
          const mes = idx + 1;
          const comp = comprovantesFiltrados.find((c) => c.mes === mes);
          const key = `${anoSelecionado}-${mes}`;
          const isUploading = uploadingKey === key;
          const isOpening = openingFile === comp?.id;
          const isToggling = togglingId === comp?.id;

          return (
            <div
              key={mes}
              className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                comp?.recebido
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-border bg-background/80"
              }`}
            >
              <span className="w-12 text-xs font-semibold text-muted-foreground shrink-0">
                {nomeMes.slice(0, 3)}
              </span>
              <div className="flex-1 min-w-0">
                {comp ? (
                  <button
                    type="button"
                    onClick={() => void handleOpen(comp.arquivo_url, comp.id)}
                    className="flex items-center gap-1 text-xs text-green-600 hover:underline truncate"
                  >
                    {isOpening ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                    <span className="truncate">{comp.label || nomeMes}</span>
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {comp && (
                  <Button
                    type="button"
                    variant={comp.recebido ? "default" : "outline"}
                    size="icon"
                    className={`h-7 w-7 ${comp.recebido ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                    onClick={() => void handleToggleRecebido(comp)}
                    disabled={isToggling}
                    title={comp.recebido ? "Recebido ✅ (clique para desmarcar)" : "Confirmar recebimento"}
                  >
                    {isToggling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </Button>
                )}
                <label className="inline-flex h-7 cursor-pointer items-center justify-center rounded border border-dashed border-border px-2 text-xs text-muted-foreground hover:border-green-500/50 hover:text-green-600 transition-colors">
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  <input
                    type="file"
                    className="hidden"
                    accept={DEFAULT_CONTRATO_FILE_ACCEPT}
                    disabled={!contratoId || isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(mes, file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {comp && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => void handleDelete(comp.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      </div>

      <ContratoFileViewerDialog
        open={viewerState.open}
        loading={viewerState.loading}
        file={viewerState.file}
        onOpenChange={(open) => {
          if (!open) closeContratoFileViewer();
        }}
      />
    </>
  );
}
