import { Clock, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ConsultaCPF() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-primary" />
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Atualização futura
        </Badge>
        <h1 className="text-2xl font-bold text-foreground">Consulta de CPF</h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          A consulta de CPF (SPC, Boa Vista e Serasa) está temporariamente
          indisponível e será liberada em uma próxima atualização do sistema.
        </p>
      </div>
    </div>
  );
}
