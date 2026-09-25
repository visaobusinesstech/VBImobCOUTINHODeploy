import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Result = {
  connector: string;
  env_var: string;
  configured: boolean;
  outcome: "verified" | "skipped" | "failed" | "not_configured" | "error";
  latency_ms?: number;
  status?: number;
  error?: string;
};

const OUTCOME_META: Record<Result["outcome"], { label: string; Icon: any; variant: any; className: string }> = {
  verified:       { label: "Credenciais OK",     Icon: CheckCircle2,  variant: "default",     className: "bg-emerald-600 hover:bg-emerald-600" },
  skipped:        { label: "Verificação pulada", Icon: AlertTriangle, variant: "secondary",   className: "" },
  failed:         { label: "Credenciais inválidas", Icon: XCircle,    variant: "destructive", className: "" },
  not_configured: { label: "Conector não linkado", Icon: AlertTriangle, variant: "outline",   className: "" },
  error:          { label: "Erro na verificação", Icon: XCircle,      variant: "destructive", className: "" },
};

export function TesteCredenciaisButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const executar = async () => {
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("verificar-credenciais-conectores", { body: {} });
      if (error) throw error;
      setResults(data?.results ?? []);
      setCheckedAt(data?.checked_at ?? new Date().toISOString());
      const okAll = (data?.results ?? []).every((r: Result) => r.outcome === "verified");
      if (okAll) toast.success("Todos os conectores validados");
      else toast.warning("Alguns conectores precisam de atenção");
    } catch (e: any) {
      toast.error("Falha ao verificar", { description: e?.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); executar(); }}>
        <ShieldCheck className="w-4 h-4 mr-1" />
        Testar credenciais
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Validação de conectores</DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando Telegram e Apify pelo gateway…
            </div>
          )}

          {!loading && results && (
            <div className="space-y-3">
              {results.map((r) => {
                const meta = OUTCOME_META[r.outcome];
                const Icon = meta.Icon;
                return (
                  <div key={r.connector} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="font-medium capitalize">{r.connector}</span>
                        <code className="text-xs text-muted-foreground">{r.env_var}</code>
                      </div>
                      <Badge variant={meta.variant} className={meta.className}>{meta.label}</Badge>
                    </div>
                    {r.latency_ms != null && (
                      <p className="text-xs text-muted-foreground">Latência: {r.latency_ms} ms</p>
                    )}
                    {r.error && (
                      <p className="text-xs text-destructive break-words">{r.error}</p>
                    )}
                    {r.outcome === "not_configured" && (
                      <p className="text-xs text-muted-foreground">
                        Peça ao admin para linkar o conector no workspace antes de ativar as fontes desta categoria.
                      </p>
                    )}
                  </div>
                );
              })}
              {checkedAt && (
                <p className="text-[11px] text-muted-foreground text-right">
                  Verificado em {new Date(checkedAt).toLocaleString("pt-BR")}
                </p>
              )}
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={executar} disabled={loading}>Rodar novamente</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
