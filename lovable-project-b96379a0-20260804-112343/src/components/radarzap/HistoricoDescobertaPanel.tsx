import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Download, FileSpreadsheet, History, Loader2, RefreshCw, RotateCw, Search } from "lucide-react";
import { toast } from "sonner";

type ReexecutarPayload = {
  cidades: string[];
  ceps: string[];
  condominios: string[];
  termo: string | null;
  ignorar_dedup_all?: boolean;
  reprocessar_invites?: string[];
};
type ClonarPayload = ReexecutarPayload;
interface Props {
  onReexecutar?: (p: ReexecutarPayload) => Promise<void> | void;
  onClonarParametros?: (p: ClonarPayload) => void;
}


type Row = {
  id: string;
  run_id: string;
  imobiliaria_id: string;
  cidades: string[] | null;
  termo: string | null;
  firecrawl_key_kind: string | null;
  queries: number;
  encontrados: number;
  inseridos: number;
  total_raw_items: number;
  total_invites_validos: number;
  total_ms: number;
  erros: unknown;
  telemetria: unknown;
  created_at: string;
  ignorar_dedup_all?: boolean | null;
  reprocessar_invites?: string[] | null;
  motivo_reprocessamento?: string | null;
  modo?: string | null;
};


const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

export default function HistoricoDescobertaPanel({ onReexecutar, onClonarParametros }: Props = {}) {
  const { isMaster } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");
  const [imob, setImob] = useState<string>("");
  const [tipoAlvo, setTipoAlvo] = useState<"todos" | "cep" | "condominio" | "cidade">("todos");
  const [busca, setBusca] = useState<string>("");
  const [reexecutandoId, setReexecutandoId] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<Row | null>(null);

  const classificarAlvo = (v: string): "cep" | "condominio" | "cidade" => {
    const s = (v ?? "").trim();
    if (/^CEP\s/i.test(s) || /^\d{5}-?\d{3}$/.test(s)) return "cep";
    if (/^Condom[íi]nio\s/i.test(s)) return "condominio";
    return "cidade";
  };
  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const carregar = async () => {
    setLoading(true);
    let q = supabase
      .from("radarzap_descoberta_execucoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (de) q = q.gte("created_at", new Date(de).toISOString());
    if (ate) {
      const end = new Date(ate);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }
    if (isMaster && imob.trim()) q = q.eq("imobiliaria_id", imob.trim());
    const { data, error } = await q;
    if (error) {
      toast.error("Falha ao carregar histórico", { description: error.message });
      setRows([]);
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return rows.filter((r) => {
      const alvos = (r.cidades ?? []) as string[];
      if (tipoAlvo !== "todos") {
        if (!alvos.some((a) => classificarAlvo(a) === tipoAlvo)) return false;
      }
      if (termo) {
        const hit = alvos.some((a) => normalizar(a).includes(termo)) ||
          normalizar(r.termo ?? "").includes(termo);
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, busca, tipoAlvo]);

  const resumoAlvos = (alvos: string[]) => {
    const g = { cep: [] as string[], condominio: [] as string[], cidade: [] as string[] };
    alvos.forEach((a) => g[classificarAlvo(a)].push(a));
    return g;
  };

  const construirPayload = (r: Row): ReexecutarPayload => {
    const alvos = (r.cidades ?? []) as string[];
    const g = resumoAlvos(alvos);
    return {
      cidades: g.cidade,
      ceps: g.cep.map((s) => s.replace(/^CEP\s+/i, "").trim()),
      condominios: g.condominio.map((s) => s.replace(/^Condom[íi]nio\s+/i, "").trim()),
      termo: r.termo,
      ignorar_dedup_all: r.ignorar_dedup_all ?? false,
      reprocessar_invites: r.reprocessar_invites ?? [],
    };
  };

  const clonar = (r: Row) => {
    if (!r.cidades?.length) return toast.info("Execução sem alvos para clonar");
    if (!onClonarParametros) return toast.info("Clonagem indisponível neste contexto");
    onClonarParametros(construirPayload(r));
    toast.success("Parâmetros carregados no formulário de descoberta");
  };

  const reexecutar = async (r: Row) => {
    if (!r.cidades?.length) return toast.info("Execução sem alvos para reexecutar");
    setReexecutandoId(r.id);
    try {
      const payload = construirPayload(r);
      if (onReexecutar) {
        await onReexecutar(payload);
      } else {
        const { data, error } = await supabase.functions.invoke("radarzap-descobrir-grupos", {
          body: {
            cidades: r.cidades,
            termo: r.termo ?? undefined,
            ignorar_dedup_all: payload.ignorar_dedup_all,
            reprocessar_invites: payload.reprocessar_invites,
          },
        });
        if (error) throw error;
        toast.success("Reexecução concluída", {
          description: `${(data as any)?.encontrados ?? 0} grupo(s) · ${(data as any)?.inseridos ?? 0} novo(s)`,
        });
        await carregar();
      }
    } catch (e: any) {
      toast.error("Falha ao reexecutar", { description: e?.message ?? String(e) });
    } finally {
      setReexecutandoId(null);

    }
  };

  const copiarJson = async (r: Row) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(r, null, 2));
      toast.success("JSON copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const baixarJson = (r: Row) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radarzap-descoberta-${r.run_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportarJson = () => {
    if (!filtradas.length) return toast.info("Nada para exportar");
    const blob = new Blob([JSON.stringify(filtradas, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radarzap-descoberta-historico-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtradas.length} execuç${filtradas.length === 1 ? "ão" : "ões"} exportada(s)`);
  };

  const exportarCsvTelemetria = () => {
    if (!filtradas.length) return toast.info("Nada para exportar");
    const headers = [
      "run_id", "created_at", "imobiliaria_id", "termo",
      "cidade", "query_termo", "query", "http_status", "duration_ms",
      "raw_items", "invites_validos", "invites_novos",
      "duplicados_local", "descartados_sem_url", "descartados_host_invalido",
      "response_shape", "sample_urls", "error", "body_preview",
    ];
    const linhas: string[] = [headers.join(",")];
    for (const r of filtradas) {
      const tel = Array.isArray(r.telemetria) ? (r.telemetria as any[]) : [];
      if (tel.length === 0) {
        linhas.push([r.run_id, r.created_at, r.imobiliaria_id, r.termo ?? "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""].map(escapeCsv).join(","));
        continue;
      }
      for (const t of tel) {
        linhas.push([
          r.run_id, r.created_at, r.imobiliaria_id, r.termo ?? "",
          t.cidade ?? "", t.termo ?? "", t.query ?? "",
          t.status ?? "", t.duration_ms ?? "",
          t.raw_items ?? 0, t.invites_validos ?? 0, t.invites_novos ?? 0,
          t.duplicados_local ?? 0, t.descartados_sem_url ?? 0, t.descartados_host_invalido ?? 0,
          Array.isArray(t.response_shape) ? t.response_shape.join("|") : "",
          Array.isArray(t.sample_urls) ? t.sample_urls.join("|") : "",
          t.error ?? "", t.body_preview ?? "",
        ].map(escapeCsv).join(","));
      }
    }
    const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radarzap-descoberta-telemetria-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`CSV gerado com ${linhas.length - 1} linhas`);
  };

  const exportarCsvErros = () => {
    if (!filtradas.length) return toast.info("Nada para exportar");
    const headers = ["run_id", "created_at", "imobiliaria_id", "tipo", "mensagem"];
    const linhas: string[] = [headers.join(",")];
    for (const r of filtradas) {
      const errs = Array.isArray(r.erros) ? (r.erros as unknown[]) : [];
      for (const e of errs) {
        const msg = typeof e === "string" ? e : JSON.stringify(e);
        const tipo = typeof e === "string" && e.startsWith("Insert:") ? "insert" : "consulta";
        linhas.push([r.run_id, r.created_at, r.imobiliaria_id, tipo, msg].map(escapeCsv).join(","));
      }
      const tel = Array.isArray(r.telemetria) ? (r.telemetria as any[]) : [];
      for (const t of tel) {
        if (t?.error) {
          linhas.push([r.run_id, r.created_at, r.imobiliaria_id, "firecrawl", `${t.cidade}/${t.termo}: ${t.error}`].map(escapeCsv).join(","));
        }
      }
    }
    if (linhas.length === 1) return toast.info("Nenhum erro nos resultados filtrados");
    const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radarzap-descoberta-erros-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${linhas.length - 1} erro(s) exportado(s)`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" /> Histórico de buscas de grupos públicos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4 items-end">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          {isMaster && (
            <div>
              <Label className="text-xs">Imobiliária (UUID)</Label>
              <Input
                placeholder="Deixe em branco para todas"
                value={imob}
                onChange={(e) => setImob(e.target.value)}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={carregar} disabled={loading} className="w-full">
              {loading ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Aplicar
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4 items-end">
          <div className="md:col-span-2">
            <Label className="text-xs">Buscar por CEP, condomínio, cidade ou termo</Label>
            <Input
              placeholder="ex.: 70000-000, Vivendas, Águas Claras, apartamento…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Tipo de alvo</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={tipoAlvo}
              onChange={(e) => setTipoAlvo(e.target.value as typeof tipoAlvo)}
            >
              <option value="todos">Todos</option>
              <option value="cep">CEPs</option>
              <option value="condominio">Condomínios</option>
              <option value="cidade">Cidades</option>
            </select>
          </div>
          <div className="text-xs text-muted-foreground">
            {filtradas.length} de {rows.length} execuç{rows.length === 1 ? "ão" : "ões"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportarJson} disabled={!filtradas.length}>
            <Download className="h-4 w-4 mr-1" /> Exportar JSON ({filtradas.length})
          </Button>
          <Button size="sm" variant="outline" onClick={exportarCsvTelemetria} disabled={!filtradas.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV telemetria
          </Button>
          <Button size="sm" variant="outline" onClick={exportarCsvErros} disabled={!filtradas.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV erros
          </Button>
        </div>



        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma execução registrada para os filtros escolhidos.
          </p>
        ) : (
          <div className="space-y-2">
            {filtradas.map((r) => {
              const errosCount = Array.isArray(r.erros) ? (r.erros as unknown[]).length : 0;
              const alvos = (r.cidades ?? []) as string[];
              const g = resumoAlvos(alvos);
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/40"
                >
                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{r.run_id.slice(0, 8)}</span>
                      <Badge variant="outline">{fmtDate(r.created_at)}</Badge>
                      {r.termo && <Badge variant="secondary">{r.termo}</Badge>}
                      {g.cidade.length > 0 && <Badge variant="outline">{g.cidade.length} cidade(s)</Badge>}
                      {g.cep.length > 0 && <Badge variant="outline" className="border-blue-400 text-blue-700">{g.cep.length} CEP(s)</Badge>}
                      {g.condominio.length > 0 && <Badge variant="outline" className="border-amber-400 text-amber-700">{g.condominio.length} condomínio(s)</Badge>}
                      {isMaster && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {r.imobiliaria_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={alvos.join(" · ")}>
                      {alvos.slice(0, 6).join(" · ")}{alvos.length > 6 ? ` · +${alvos.length - 6}` : ""}
                    </div>
                    {(r.modo === "reprocessar" || r.ignorar_dedup_all || (r.reprocessar_invites?.length ?? 0) > 0 || r.motivo_reprocessamento) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                          Reprocessamento
                          {r.ignorar_dedup_all ? " · ignorar dedup (todos)" : (r.reprocessar_invites?.length ? ` · ${r.reprocessar_invites.length} invite(s)` : "")}
                        </Badge>
                        {r.motivo_reprocessamento && (
                          <span
                            className="text-muted-foreground truncate max-w-[520px]"
                            title={r.motivo_reprocessamento}
                          >
                            <b>Motivo:</b> {r.motivo_reprocessamento}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      queries <b>{r.queries}</b> · raw <b>{r.total_raw_items}</b> ·
                      válidos <b>{r.total_invites_validos}</b> · encontrados <b>{r.encontrados}</b> ·
                      inseridos <b>{r.inseridos}</b> · {r.total_ms}ms
                      {errosCount > 0 && (
                        <span className="text-destructive"> · {errosCount} erro(s)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => reexecutar(r)}
                      disabled={reexecutandoId === r.id || !alvos.length}
                    >
                      {reexecutandoId === r.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RotateCw className="h-4 w-4 mr-1" />
                      )}
                      Reexecutar
                    </Button>
                    {onClonarParametros && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clonar(r)}
                        disabled={!alvos.length}
                        title="Copia cidades, CEPs, condomínios, termo e estratégia de deduplicação para o formulário"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Clonar parâmetros
                      </Button>
                    )}

                    <Button size="sm" variant="outline" onClick={() => setSelecionada(r)}>
                      Ver JSON
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copiarJson(r)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => baixarJson(r)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

          </div>
        )}

        <Dialog open={!!selecionada} onOpenChange={(o) => !o && setSelecionada(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Telemetria — {selecionada && fmtDate(selecionada.created_at)}
              </DialogTitle>
            </DialogHeader>
            {selecionada && (
              <>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" variant="outline" onClick={() => copiarJson(selecionada)}>
                    <Copy className="h-4 w-4 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => baixarJson(selecionada)}>
                    <Download className="h-4 w-4 mr-1" /> Baixar
                  </Button>
                </div>
                <ScrollArea className="h-[60vh] rounded border bg-muted/30">
                  <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                    {JSON.stringify(selecionada, null, 2)}
                  </pre>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
