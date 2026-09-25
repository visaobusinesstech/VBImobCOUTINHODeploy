import { useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export function AvaliacaoFallback({ error, onReset, trackingId }: { error?: Error; onReset?: () => void; trackingId?: string }) {
  const handleTryAgain = useCallback(() => {
    const resetEvent = new CustomEvent('avaliacao:reset-state');
    window.dispatchEvent(resetEvent);
    if (onReset) onReset();
    else window.location.reload();
  }, [onReset]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh] p-6 text-center">
        <Card className="max-w-md w-full border-destructive/20 shadow-lg">
          <CardHeader className="pb-2">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Ops! Algo deu errado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              Não conseguimos carregar a ferramenta de avaliação no momento.
            </p>
            {error && (
              <div className="bg-destructive/5 p-3 rounded-lg border border-destructive/10 text-left">
                <code className="text-[10px] text-destructive block break-words font-mono max-h-24 overflow-y-auto">
                  {error.message}
                </code>
              </div>
            )}
            {trackingId && (
              <p className="text-[10px] text-muted-foreground font-mono">
                ID de rastreio: <span className="text-foreground select-all font-bold">{trackingId}</span>
              </p>
            )}
            <div className="flex flex-col gap-3">
              <Button onClick={handleTryAgain} variant="default" size="lg" className="gap-2 w-full font-bold">
                <RefreshCw className="w-5 h-5" /> Tentar Novamente
              </Button>
              <Button onClick={() => (window.location.href = '/dashboard')} variant="outline" className="w-full">
                Ir para o Painel Principal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
