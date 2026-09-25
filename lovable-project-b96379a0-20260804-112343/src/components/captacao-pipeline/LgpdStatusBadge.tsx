import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion } from "lucide-react";

export type LgpdStatus = "ok" | "parcial" | "remocao_solicitada" | "removido" | null | undefined;

const MAP: Record<string, { label: string; variant: any; Icon: any; hint: string }> = {
  ok:                  { label: "LGPD ok",       variant: "default",     Icon: ShieldCheck,    hint: "Todos os campos críticos têm fonte pública registrada." },
  parcial:             { label: "Sem fonte",     variant: "secondary",   Icon: ShieldAlert,    hint: "Faltam fontes públicas para campos críticos (nome, telefone ou e-mail)." },
  remocao_solicitada:  { label: "Remoção pedida", variant: "destructive", Icon: ShieldOff,      hint: "Titular solicitou remoção — disparos bloqueados." },
  removido:            { label: "Removido",      variant: "outline",     Icon: ShieldOff,      hint: "Dados removidos por solicitação do titular." },
};

export function LgpdStatusBadge({ status, className = "" }: { status: LgpdStatus; className?: string }) {
  const m = MAP[status ?? "parcial"] ?? { label: "LGPD?", variant: "outline", Icon: ShieldQuestion, hint: "Status LGPD não avaliado." };
  const Icon = m.Icon;
  return (
    <Badge variant={m.variant} className={`text-[10px] gap-1 ${className}`} title={m.hint}>
      <Icon className="w-3 h-3" />
      {m.label}
    </Badge>
  );
}
