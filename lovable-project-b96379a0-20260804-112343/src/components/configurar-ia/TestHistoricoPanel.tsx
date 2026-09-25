import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, History, RefreshCw, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Row {
  id: string;
  created_at: string;
  kind: "ai" | "serper" | "chain";
  provider: string | null;
  model: string | null;
  status: "success" | "error";
  message: string | null;
  active_model: string | null;
  fallback_used: boolean | null;
  duration_ms: number | null;
}

const kindLabel: Record<Row["kind"], string> = {
  ai: "IA (chave)",
  serper: "Serper",
  chain: "Cadeia de modelos",
};

export function TestHistoricoPanel({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"all" | Row["kind"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Row["status"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("ai_config_test_log" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (kindFilter !== "all") q = q.eq("kind", kindFilter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (!error) setRows((data as unknown as Row[]) || []);
    setLoading(false);
  }, [userId, kindFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = () => load();
    window.addEventListener("ai-test-log-updated", h);
    return () => window.removeEventListener("ai-test-log-updated", h);
  }, [load]);

  const clearAll = async () => {
    if (!confirm("Apagar todo o histórico de testes de conexão?")) return;
    const { error } = await supabase.from("ai_config_test_log" as any).delete().eq("user_id", userId);
    if (error) {
      toast({ title: "Erro ao limpar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Histórico limpo" });
    load();
  };

  const exportCsv = () => {
    const header = ["data_hora","tipo","provedor","modelo","status","mensagem","modelo_ativo","fallback","duracao_ms"];
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map(r => [
      new Date(r.created_at).toLocaleString("pt-BR"),
      kindLabel[r.kind],
      r.provider ?? "",
      r.model ?? "",
      r.status,
      r.message ?? "",
      r.active_model ?? "",
      r.fallback_used ? "sim" : "",
      r.duration_ms ?? "",
    ].map(escape).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-testes-ia-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Histórico de testes de conexão
          </CardTitle>
          <CardDescription>
            Auditoria dos últimos 50 testes de chaves e cadeia de modelos.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kindFilter} onValueChange={(v: any) => setKindFilter(v)}>
            <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="ai">IA (chave)</SelectItem>
              <SelectItem value="serper">Serper</SelectItem>
              <SelectItem value="chain">Cadeia</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="error">Falha</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll} disabled={!rows.length} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum teste registrado ainda. Clique em <strong>Testar conexão</strong> para começar a auditar.</p>
        ) : (
          <TooltipProvider>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 pr-4 font-medium">Data / hora</th>
                    <th className="text-left py-2 pr-4 font-medium">Tipo</th>
                    <th className="text-left py-2 pr-4 font-medium">Provedor / modelo</th>
                    <th className="text-left py-2 pr-4 font-medium">Status</th>
                    <th className="text-left py-2 pr-4 font-medium">Duração</th>
                    <th className="text-left py-2 font-medium">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{kindLabel[r.kind]}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{r.provider ?? "—"}</div>
                        {(r.active_model || r.model) && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {r.active_model || r.model}
                            {r.fallback_used ? " (fallback)" : ""}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {r.status === "success" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" /> Falha
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                        {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                      </td>
                      <td className="py-2 max-w-[420px]">
                        {r.message ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="line-clamp-2 text-muted-foreground cursor-help">{r.message}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[500px]">
                              <p className="text-xs whitespace-pre-wrap">{r.message}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
