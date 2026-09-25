import { Badge } from "@/components/ui/badge";
import { Clock, Eye, ShieldCheck, ShieldX } from "lucide-react";

export type StatusRevisao = "pendente" | "em_revisao" | "aprovado" | "rejeitado";

export function StatusRevisaoBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "pendente") as StatusRevisao;
  const map = {
    pendente: { label: "Aguardando aprovação", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", Icon: Clock },
    em_revisao: { label: "Em revisão", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", Icon: Eye },
    aprovado: { label: "Fonte aprovada", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", Icon: ShieldCheck },
    rejeitado: { label: "Rejeitado", cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", Icon: ShieldX },
  }[s] ?? { label: s, cls: "", Icon: Clock };
  const Icon = map.Icon;
  return (
    <Badge variant="outline" className={`gap-1 ${map.cls}`}>
      <Icon className="w-3 h-3" />
      {map.label}
    </Badge>
  );
}
