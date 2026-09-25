import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { FontesDadosPanel } from "./FontesDadosPanel";
import { LgpdStatusBadge, type LgpdStatus } from "./LgpdStatusBadge";

/**
 * Botão + dialog para abrir o dossiê de fontes públicas (LGPD) de um lead
 * do pipeline de captação.
 */
export function LgpdDossieButton({
  leadTipo,
  leadId,
  lgpdStatus,
  compact = false,
}: {
  leadTipo: "lista_proprietarios" | "pipeline";
  leadId: string;
  lgpdStatus?: LgpdStatus;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className={compact ? "h-7 px-2 text-xs" : ""}
          title="Ver fontes públicas e dossiê LGPD deste lead"
          onClick={(e) => e.stopPropagation()}
        >
          <ShieldCheck className="w-3 h-3 mr-1" />
          {compact ? "" : "LGPD"}
          {lgpdStatus && <LgpdStatusBadge status={lgpdStatus} className="ml-1" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dossiê de fontes públicas (LGPD)</DialogTitle>
        </DialogHeader>
        <FontesDadosPanel leadTipo={leadTipo} leadId={leadId} />
      </DialogContent>
    </Dialog>
  );
}
