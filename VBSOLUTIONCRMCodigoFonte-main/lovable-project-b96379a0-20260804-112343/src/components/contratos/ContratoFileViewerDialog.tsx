import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ContratoViewerFile } from "@/hooks/useContratoFileViewer";

interface ContratoFileViewerDialogProps {
  open: boolean;
  loading: boolean;
  file: ContratoViewerFile | null;
  onOpenChange: (open: boolean) => void;
}

export function ContratoFileViewerDialog({
  open,
  loading,
  file,
  onOpenChange,
}: ContratoFileViewerDialogProps) {
  const handleOpenOriginal = () => {
    if (!file?.url) return;
    window.open(file.url, "_blank", "noopener,noreferrer");
  };

  const handleDownload = () => {
    if (!file?.url) return;

    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const previewSource = file?.previewKind === "office" ? file.officePreviewUrl : file?.url;

  const renderPreview = () => {
    if (loading || !file?.url) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center rounded-lg border border-border bg-muted/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Preparando visualização...
          </div>
        </div>
      );
    }

    if (file.previewKind === "image") {
      return (
        <div className="flex min-h-[60vh] items-center justify-center rounded-lg border border-border bg-muted/20 p-4">
          <img
            src={file.url}
            alt={file.name}
            loading="lazy"
            className="max-h-[70vh] max-w-full rounded-md object-contain"
          />
        </div>
      );
    }

    if (file.previewKind === "video") {
      return (
        <div className="rounded-lg border border-border bg-muted/20 p-2">
          <video src={file.url} controls className="max-h-[70vh] w-full rounded-md bg-black/80" />
        </div>
      );
    }

    if (previewSource && ["pdf", "text", "office"].includes(file.previewKind)) {
      return (
        <iframe
          title={file.name}
          src={previewSource}
          className="h-[70vh] w-full rounded-lg border border-border bg-background"
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Pré-visualização interna indisponível</p>
          <p className="text-xs text-muted-foreground">
            Este formato pode ser aberto em nova aba ou baixado diretamente.
          </p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-6xl overflow-hidden p-0">
        <div className="border-b border-border px-6 py-4">
          <DialogHeader className="gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <DialogTitle className="pr-10 text-left text-base">{file?.name || "Visualizador de arquivo"}</DialogTitle>
              <DialogDescription className="text-left">
                Visualização segura de anexos do contrato com acesso temporário.
              </DialogDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleOpenOriginal} disabled={!file?.url}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir original
              </Button>
              <Button type="button" size="sm" onClick={handleDownload} disabled={!file?.url}>
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6">{renderPreview()}</div>
      </DialogContent>
    </Dialog>
  );
}