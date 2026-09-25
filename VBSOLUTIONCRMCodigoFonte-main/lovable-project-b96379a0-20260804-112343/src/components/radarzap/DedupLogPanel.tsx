import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, Search, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type LogRow = {
  id: string;
  created_at: string;
  decisao: "novo_card" | "mesclado" | "ignorado" | string;
  motivo: string | null;
  match_por: string | null;
  campos_batidos: Record<string, unknown> | null;
  destino_pipeline_id: string | null;
  radarzap_lead_id: string | null;
  radarzap_mensagem_id: string | null;
  radarzap_grupo_id: string | null;
  dedup_key: string | null;
  dedup_group_id: string | null;
  score: number | null;
};

const DECISAO_COLOR: Record<string, string> = {
  novo_card: "bg-emerald-100 text-emerald-800",
  mesclado: "bg-amber-100 text-amber-800",
  ignorado: "bg-slate-200 text-slate-700",
};

export default function DedupLogPanel() {
  const { imobiliariaId } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [decisao, setDecisao] = useState<string>("todas");
  const [mesclandoId, setMesclandoId] = useState<string | null>(null);

  const mesclar = async (pipelineId: string) => {
    setMesclandoId(pipelineId);
    const { data, error } = await (supabase.rpc as any)(
      "rz_mesclar_dados_complementares",
      { _pipeline_id: pipelineId },
    );
    setMesclandoId(null);
    if (error) {
      toast.error("Falha ao mesclar dados: " + error.message);
      return;
    }
    const aplicado = (data as { aplicado?: Record<string, unknown> } | null)?.aplicado ?? {};
    const nCampos = Object.keys(aplicado).length;
    toast.success(
      nCampos > 0
        ? `Mesclagem concluída: ${nCampos} campo(s) complementados`
        : "Nenhum campo complementar para aplicar (mestre já preenchido ou verificado)",
    );
  };

  const load = async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("radarzap_dedup_log")
      .select("*")
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as LogRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [imobiliariaId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (decisao !== "todas" && r.decisao !== decisao) return false;
      if (!q.trim()) return true;
      const hay = `${r.motivo ?? ""} ${r.match_por ?? ""} ${JSON.stringify(r.campos_batidos ?? {})} ${r.radarzap_lead_id ?? ""} ${r.destino_pipeline_id ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [rows, q, decisao]);

  const exportCsv = () => {
    const header = [
      "created_at", "decisao", "motivo", "match_por", "score",
      "destino_pipeline_id", "radarzap_lead_id", "radarzap_mensagem_id",
      "radarzap_grupo_id", "dedup_key", "dedup_group_id", "campos_batidos",
    ];
    const csv = [
      header.join(","),
      ...filtered.map((r) =>
        [
          r.created_at, r.decisao, r.motivo ?? "", r.match_por ?? "", r.score ?? "",
          r.destino_pipeline_id ?? "", r.radarzap_lead_id ?? "", r.radarzap_mensagem_id ?? "",
          r.radarzap_grupo_id ?? "", r.dedup_key ?? "", r.dedup_group_id ?? "",
          JSON.stringify(r.campos_batidos ?? {}),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radarzap-dedup-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-base">Log de deduplicação RadarZAP</CardTitle>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por motivo, campo, ID..."
              className="pl-8 w-64"
            />
          </div>
          <Select value={decisao} onValueChange={setDecisao}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as decisões</SelectItem>
              <SelectItem value="novo_card">Novo card</SelectItem>
              <SelectItem value="mesclado">Mesclado</SelectItem>
              <SelectItem value="ignorado">Ignorado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground mb-2">
          {filtered.length} de {rows.length} registros (últimos 500)
        </div>
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {filtered.map((r) => {
            const campos = r.campos_batidos && typeof r.campos_batidos === "object"
              ? Object.entries(r.campos_batidos).filter(([, v]) => v !== null && v !== "" && v !== undefined)
              : [];
            return (
              <div key={r.id} className="border rounded-md p-3 text-sm bg-card">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={DECISAO_COLOR[r.decisao] ?? "bg-slate-100"}>
                      {r.decisao}
                    </Badge>
                    {r.match_por && (
                      <Badge variant="outline">match: {r.match_por}</Badge>
                    )}
                    {r.score !== null && (
                      <Badge variant="secondary">score {r.score}</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>
                {r.motivo && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <strong className="text-foreground">Motivo:</strong> {r.motivo}
                  </div>
                )}
                {campos.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">Campos considerados:</div>
                    <div className="flex flex-wrap gap-1">
                      {campos.map(([k, v]) => (
                        <Badge key={k} variant="outline" className="font-normal">
                          {k}: <span className="ml-1 text-muted-foreground">{String(v)}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-muted-foreground font-mono">
                  {r.destino_pipeline_id && (
                    <div><strong className="text-foreground">Card destino:</strong> {r.destino_pipeline_id}</div>
                  )}
                  {r.radarzap_lead_id && (
                    <div><strong className="text-foreground">Lead RadarZAP:</strong> {r.radarzap_lead_id}</div>
                  )}
                  {r.dedup_key && (
                    <div><strong className="text-foreground">dedup_key:</strong> {r.dedup_key}</div>
                  )}
                  {r.dedup_group_id && (
                    <div><strong className="text-foreground">dedup_group_id:</strong> {r.dedup_group_id}</div>
                  )}
                </div>
                {r.decisao === "mesclado" && r.destino_pipeline_id && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mesclandoId === r.destino_pipeline_id}
                      onClick={() => mesclar(r.destino_pipeline_id!)}
                    >
                      {mesclandoId === r.destino_pipeline_id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Layers className="h-4 w-4 mr-1" />
                      )}
                      Mesclar dados complementares
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {!filtered.length && !loading && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhum registro de deduplicação encontrado.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
