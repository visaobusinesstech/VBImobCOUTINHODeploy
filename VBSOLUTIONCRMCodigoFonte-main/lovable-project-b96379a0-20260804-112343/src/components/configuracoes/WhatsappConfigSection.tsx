import { MessageCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function WhatsappConfigSection() {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          Integração WhatsApp API
        </h3>
        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">
          <AlertTriangle className="w-3 h-3 mr-1" /> Em breve
        </Badge>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-6 text-center space-y-2">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <p className="text-sm font-medium text-foreground">Funcionalidade em desenvolvimento</p>
        <p className="text-xs text-muted-foreground">
          A integração com WhatsApp API (Evolution API, Z-API) estará disponível em breve.
          Por enquanto, o sistema utiliza o modo manual via wa.me.
        </p>
      </div>
    </div>
  );
}
