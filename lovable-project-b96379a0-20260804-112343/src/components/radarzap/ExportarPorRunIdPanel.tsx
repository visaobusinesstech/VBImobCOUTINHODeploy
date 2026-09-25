import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, FileDown, X } from "lucide-react";
import { toast } from "sonner";
import ExecucaoErrosPanel from "./ExecucaoErrosPanel";

/**
 * Painel: informe um run_id e baixe o relatório "Detalhes de erros"
 * daquela execução em JSON, CSV ou ZIP (via ExecucaoErrosPanel).
 */
export default function ExportarPorRunIdPanel() {
  const [runId, setRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const [execucao, setExecucao] = useState<any | null>(null);

  const buscar = async () => {
    const id = runId.trim();
    if (!id) {
      toast.error("Informe o run_id");
      return;
    }
    setLoading(true);
    setExecucao(null);
    const { data, error } = await supabase
      .from("radarzap_descoberta_execucoes")
      .select("*")
      .eq("run_id", id)
      .maybeSingle();
    setLoading(false);
    if (error) {
      toast.error("Falha ao buscar execução", { description: error.message });
      return;
    }
    if (!data) {
      toast.error("Nenhuma execução encontrada para este run_id");
      return;
    }
    setExecucao(data);
    toast.success("Execução carregada", {
      description: "Use os botões de exportação abaixo (JSON, CSV, ZIP).",
    });
  };

  const limpar = () => {
    setRunId("");
    setExecucao(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Exportar “Detalhes de erros” por run_id
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Informe o <code>run_id</code> de uma busca de grupos públicos para carregar a execução
            e exportar o relatório em JSON, CSV ou ZIP para análise offline / suporte.
          </p>
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1">
              <Label htmlFor="rz-runid" className="text-xs">run_id</Label>
              <Input
                id="rz-runid"
                value={runId}
                onChange={(e) => setRunId(e.target.value)}
                placeholder="ex.: 3f6a8c9e-1234-4a5b-8c7d-…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") buscar();
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={buscar} disabled={loading || !runId.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Search className="h-4 w-4 mr-1" />
                )}
                Carregar
              </Button>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={limpar} disabled={loading && !execucao}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>
          </div>
          {execucao && (
            <div className="text-xs text-muted-foreground">
              Execução <span className="font-mono">{execucao.run_id}</span> ·{" "}
              {new Date(execucao.created_at).toLocaleString("pt-BR")} ·{" "}
              queries: {execucao.queries ?? 0} · encontrados: {execucao.encontrados ?? 0} ·
              inseridos: {execucao.inseridos ?? 0}
            </div>
          )}
        </CardContent>
      </Card>

      {execucao && <ExecucaoErrosPanel ultimaBusca={execucao} />}
    </div>
  );
}
