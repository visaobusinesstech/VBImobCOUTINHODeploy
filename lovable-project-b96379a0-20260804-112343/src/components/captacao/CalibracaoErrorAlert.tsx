import { AlertTriangle, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import type { CalibracaoFriendlyError } from "@/lib/calibracaoErrorGuide";

interface Props {
  error: CalibracaoFriendlyError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function CalibracaoErrorAlert({ error, onRetry, onDismiss }: Props) {
  const navigate = useNavigate();
  const isError = error.severity === "error";
  const Icon = isError ? XCircle : AlertTriangle;

  const handleAction = () => {
    if (!error.action) return;
    if (error.action.kind === "config_ia") navigate("/configurar-ia");
  };

  return (
    <Alert variant={isError ? "destructive" : "default"} className={!isError ? "border-amber-300 bg-amber-50/60 text-amber-900" : ""}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {error.title}
        <Badge variant="outline" className="text-[10px] font-mono">{error.code}</Badge>
      </AlertTitle>
      <AlertDescription className="space-y-3 mt-1">
        <p className="text-sm">{error.description}</p>

        {error.checklist.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">
              O que revisar
            </div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {error.checklist.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {error.action?.kind === "config_ia" && (
            <Button size="sm" variant="secondary" onClick={handleAction}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              {error.action.label}
            </Button>
          )}
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Tentar novamente
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>Fechar</Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
