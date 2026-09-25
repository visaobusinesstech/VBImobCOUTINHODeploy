import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";


interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error; resetErrorBoundary: () => void; trackingId?: string }) => ReactNode);
  module?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  trackingId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    trackingId: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Attempt to get the current user for the log
    let userId: string | undefined;
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id;
    } catch (e) {
      // Ignore if auth fails during error reporting
    }

    const { trackingId } = await logger.error({
      module: this.props.module || "UI",
      action: "render_failure",
      message: error.message || "Erro de renderização capturado pelo ErrorBoundary",
      stackTrace: error.stack || errorInfo.componentStack || undefined,
      userId,
      metadata: {
        componentStack: errorInfo.componentStack,
      }
    });

    this.setState({ trackingId });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, trackingId: null });
  };

  private handleReload = () => {
    window.location.reload();
  };


  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback({
            error: this.state.error || new Error("Unknown error"),
            resetErrorBoundary: this.handleReset,
            trackingId: this.state.trackingId || undefined,
          });
        }
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6 text-center">
          <Card className="max-w-md w-full border-destructive/20 shadow-lg animate-in fade-in zoom-in duration-300">
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-xl font-bold">Instabilidade Detectada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                O componente encontrou um problema inesperado. Tente restaurar apenas esta área antes de recarregar todo o sistema.
              </p>
              
              <div className="bg-muted p-3 rounded-lg text-left border border-border/50">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Detalhes técnicos:</p>
                <code className="text-[10px] text-destructive block break-words font-mono">
                  {this.state.error?.message || "Erro de execução interna"}
                </code>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  onClick={this.handleReset} 
                  variant="default"
                  className="gap-2 shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" /> Restaurar Aba
                </Button>
                <Button 
                  onClick={this.handleReload} 
                  variant="outline"
                  className="gap-2"
                >
                  Recarregar Tudo
                </Button>
              </div>
              
              <p className="text-[10px] text-muted-foreground italic">
                * Se o erro persistir ao restaurar, use a opção de recarregar tudo.
              </p>
              
              {this.state.trackingId && (
                <div className="mt-2 pt-2 border-t border-border/40">
                  <p className="text-[9px] text-muted-foreground font-mono">
                    ID de rastreio: <span className="text-foreground select-all">{this.state.trackingId}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      );
    }

    return this.props.children;
  }
}
