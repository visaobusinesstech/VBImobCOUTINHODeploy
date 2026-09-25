import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CalendarDays, FileText, Loader2, Plus, Upload, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ContratoFileViewerDialog } from "@/components/contratos/ContratoFileViewerDialog";
import { useContratoFileViewer } from "@/hooks/useContratoFileViewer";
import { DEFAULT_CONTRATO_FILE_ACCEPT, getSafeFileExtension } from "@/lib/contratoFilePreview";
import { uploadContratoFilePrivate } from "@/lib/contratosStorage";

type ContratoAnexoAnual = {
  id: string;
  ano: number;
  label: string;
  arquivo_url: string;
};

interface ContratoAnexosAnuaisSectionProps {
  contratoId?: string | null;
  startYear?: number | null;
}

export function ContratoAnexosAnuaisSection({
  contratoId,
  startYear,
}: ContratoAnexosAnuaisSectionProps) {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const { viewerState, openContratoFileViewer, closeContratoFileViewer } = useContratoFileViewer();
  const [anexosAnuais, setAnexosAnuais] = useState<ContratoAnexoAnual[]>([]);
  const [anosExtras, setAnosExtras] = useState<number[]>([]);
  const [uploadingAno, setUploadingAno] = useState<number | null>(null);
  const [openingFile, setOpeningFile] = useState<string | null>(null);

  const fetchAnexosAnuais = useCallback(async () => {
    if (!contratoId) {
      setAnexosAnuais([]);
      return;
    }

    const { data, error } = await supabase
      .from("contrato_anexos_anuais" as any)
      .select("id, ano, label, arquivo_url")
      .eq("contrato_id", contratoId)
      .order("ano", { ascending: true });

    if (error) {
      toast({
        title: "Erro ao carregar contratos anuais",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setAnexosAnuais((((data ?? []) as unknown as ContratoAnexoAnual[]) || []).sort((a, b) => a.ano - b.ano));
  }, [contratoId, toast]);

  useEffect(() => {
    setAnosExtras([]);
  }, [contratoId]);

  useEffect(() => {
    void fetchAnexosAnuais();
  }, [fetchAnexosAnuais]);

  const anoBase = useMemo(() => {
    if (typeof startYear === "number" && Number.isFinite(startYear)) return startYear;
    if (anexosAnuais.length > 0) return Math.min(...anexosAnuais.map((anexo) => anexo.ano));
    return new Date().getFullYear();
  }, [anexosAnuais, startYear]);

  const anosVisiveis = useMemo(() => {
    const anosIniciais = [anoBase, anoBase + 1, anoBase + 2];
    return Array.from(new Set([...anosIniciais, ...anosExtras, ...anexosAnuais.map((anexo) => anexo.ano)])).sort((a, b) => a - b);
  }, [anoBase, anosExtras, anexosAnuais]);

  const handleUploadAnexoAnual = async (ano: number, file: File) => {
    if (!contratoId || !imobiliariaId) {
      toast({
        title: "Salve o contrato antes de anexar os anos",
        variant: "destructive",
      });
      return;
    }

    setUploadingAno(ano);

    try {
      const ext = getSafeFileExtension(file);
      const path = `${contratoId}/anuais/${ano}_${Date.now()}.${ext}`;
      const storedPath = await uploadContratoFilePrivate(file, path);
      if (!storedPath) throw new Error("Falha ao enviar arquivo");

      // Store the storage PATH (not the signed URL) so it can be refreshed later
      const anexoExistente = anexosAnuais.find((anexo) => anexo.ano === ano);
      const payload = {
        contrato_id: contratoId,
        imobiliaria_id: imobiliariaId,
        ano,
        label: `Contrato ${ano}`,
        arquivo_url: storedPath,
      };

      if (anexoExistente) {
        const { error: updateError } = await supabase
          .from("contrato_anexos_anuais" as any)
          .update(payload)
          .eq("id", anexoExistente.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("contrato_anexos_anuais" as any).insert(payload);

        if (insertError) throw insertError;
      }

      toast({ title: `Contrato ${ano} anexado!` });
      await fetchAnexosAnuais();
    } catch (err: any) {
      toast({
        title: "Erro no upload",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploadingAno(null);
    }
  };

  const handleOpenAnexo = async (pathOrUrl: string, id: string) => {
    setOpeningFile(id);
    try {
      await openContratoFileViewer(pathOrUrl, undefined, contratoId ? { contractId: contratoId, sourceTable: "contrato_anexos_anuais", recordId: id } : undefined);
    } finally {
      setOpeningFile(null);
    }
  };

  const handleDeleteAnexoAnual = async (id: string) => {
    const { error } = await supabase.from("contrato_anexos_anuais" as any).delete().eq("id", id);

    if (error) {
      toast({
        title: "Erro ao remover anexo",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Anexo removido" });
    await fetchAnexosAnuais();
  };

  const adicionarProximoAno = () => {
    const ultimoAno = anosVisiveis[anosVisiveis.length - 1] ?? anoBase;
    setAnosExtras((prev) => [...prev, ultimoAno + 1]);
  };

  return (
    <>
      <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Archive className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              📂 Contratos Anuais da Locação
            </p>
            <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              Arquivo Histórico
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Anexe o contrato de cada ano do aluguel — 2025, 2026, 2027 e os próximos — para manter o histórico completo.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {anosVisiveis.map((ano) => {
          const anexo = anexosAnuais.find((item) => item.ano === ano);
          const isUploading = uploadingAno === ano;
          const isOpening = openingFile === anexo?.id;

          return (
            <div
              key={ano}
              className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border bg-background/80 p-3 sm:grid-cols-[100px_minmax(0,1fr)_auto]"
            >
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ano</Label>
                <div className="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-foreground">
                  {ano}
                </div>
              </div>

              <div className="min-w-0 space-y-1">
                <Label className="text-xs text-muted-foreground">Arquivo</Label>
                {anexo ? (
                  <div className="flex min-h-11 items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    {isOpening ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <button
                      type="button"
                      onClick={() => void handleOpenAnexo(anexo.arquivo_url, anexo.id)}
                      className="truncate text-sm text-primary hover:underline text-left"
                    >
                      {anexo.label || `Contrato ${ano}`}
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-11 items-center rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                    {contratoId ? `Nenhum arquivo anexado para ${ano}` : "Salve o contrato para habilitar os anexos anuais"}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 sm:self-end">
                <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>{isUploading ? "Enviando..." : anexo ? "Trocar" : "Anexar"}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept={DEFAULT_CONTRATO_FILE_ACCEPT}
                    disabled={!contratoId || isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUploadAnexoAnual(ano, file);
                      e.target.value = "";
                    }}
                  />
                </label>

                {anexo && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => void handleDeleteAnexoAnual(anexo.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={adicionarProximoAno}>
        <Plus className="h-4 w-4" /> Adicionar próximo ano
      </Button>

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
