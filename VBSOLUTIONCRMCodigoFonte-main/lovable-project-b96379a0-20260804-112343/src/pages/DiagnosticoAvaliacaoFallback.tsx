import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, RotateCcw } from "lucide-react";

export function DiagnosticoFallback({ error, onReset, trackingId }: { error?: Error; onReset?: () => void; trackingId?: string }) {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh] p-6 text-center">
        <Card className="max-w-md w-full border-destructive/20 shadow-lg">
          <CardHeader className="pb-2">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Ops! Erro no Diagnóstico</CardTitle>
            <CardDescription className="text-muted-foreground pt-2">
              Houve um problema ao carregar as ferramentas de análise técnica.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="bg-muted/50 p-3 rounded text-xs text-left font-mono text-muted-foreground overflow-auto max-h-32">
              {error ? error.message : "Erro de renderização detectado."}
            </div>
            {trackingId && (
              <p className="text-[10px] text-muted-foreground font-mono text-left pt-1">
                ID de rastreio: <span className="text-foreground select-all">{trackingId}</span>
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => (window.location.href = '/dashboard')}>
                <Home className="w-4 h-4" /> Ir para Início
              </Button>
              <Button className="flex-1 gap-2 font-bold" onClick={() => (onReset ? onReset() : window.location.reload())}>
                <RotateCcw className="w-4 h-4" /> Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
