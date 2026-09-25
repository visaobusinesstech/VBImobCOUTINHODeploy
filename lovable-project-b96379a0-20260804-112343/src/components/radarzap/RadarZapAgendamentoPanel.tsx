import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Clock, PlayCircle, History } from "lucide-react";

type Config = {
  id: string;
  imobiliaria_id: string;
  ativo: boolean;
  frequencia_horas: number;
  cidades: string[];
  termo_extra: string | null;
  max_grupos_por_execucao: number;
  ultima_execucao: string | null;
  proxima_execucao: string;
};

type Log = {
  id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  duracao_ms: number | null;
  status: string;
  queries_executadas: number;
  grupos_encontrados: number;
  grupos_novos: number;
  erros: string[];
};

export default function RadarZapAgendamentoPanel() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [cidadesCsv, setCidadesCsv] = useState("");

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: c } = await supabase
      .from("radarzap_agendamento_config")
      .select("*")
      .eq("imobiliaria_id", user.id)
      .maybeSingle();
    setCfg((c as Config) ?? null);
    setCidadesCsv(((c as Config)?.cidades ?? []).join(", "));

    const { data: l } = await supabase
      .from("radarzap_execucoes_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs((l as Log[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    const cidades = cidadesCsv.split(",").map(s => s.trim()).filter(Boolean);
    const payload = {
      imobiliaria_id: user.id,
      ativo: cfg?.ativo ?? false,
      frequencia_horas: cfg?.frequencia_horas ?? 24,
      max_grupos_por_execucao: cfg?.max_grupos_por_execucao ?? 20,
      termo_extra: cfg?.termo_extra ?? null,
      cidades,
    };
    const { error } = await supabase
      .from("radarzap_agendamento_config")
      .upsert(payload, { onConflict: "imobiliaria_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Agendamento salvo");
    carregar();
  };

  const executarAgora = async () => {
    if (!user) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("radarzap-executar-agendado", {
        body: { imobiliaria_id: user.id },
      });
      if (error) throw error;
      const r = data?.resultados?.[0];
      toast.success(r ? `Concluído: ${r.novos ?? 0} novos / ${r.encontrados ?? 0}` : "Sem config ativa");
      carregar();
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? e));
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Descoberta automática de grupos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Executar automaticamente</div>
              <div className="text-xs text-muted-foreground">Ao ativar, o RadarZAP buscará novos grupos no intervalo definido.</div>
            </div>
            <Switch checked={cfg?.ativo ?? false} onCheckedChange={v => setCfg(c => ({ ...(c ?? {} as Config), ativo: v }))} />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Frequência (horas)</label>
              <Input type="number" min={1} max={168}
                value={cfg?.frequencia_horas ?? 24}
                onChange={e => setCfg(c => ({ ...(c ?? {} as Config), frequencia_horas: Number(e.target.value) || 24 }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Máx. grupos por execução</label>
              <Input type="number" min={1} max={100}
                value={cfg?.max_grupos_por_execucao ?? 20}
                onChange={e => setCfg(c => ({ ...(c ?? {} as Config), max_grupos_por_execucao: Number(e.target.value) || 20 }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Termo extra (opcional)</label>
              <Input value={cfg?.termo_extra ?? ""}
                onChange={e => setCfg(c => ({ ...(c ?? {} as Config), termo_extra: e.target.value }))}
                placeholder="ex.: aluguel comercial" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Cidades (separadas por vírgula)</label>
            <Input value={cidadesCsv} onChange={e => setCidadesCsv(e.target.value)}
              placeholder="Brasília, Águas Claras, Taguatinga" />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar
            </Button>
            <Button variant="outline" onClick={executarAgora} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <PlayCircle className="h-4 w-4 mr-1" />}
              Executar agora
            </Button>
            {cfg?.ultima_execucao && (
              <span className="text-xs text-muted-foreground">
                Última: {new Date(cfg.ultima_execucao).toLocaleString("pt-BR")} · Próxima: {new Date(cfg.proxima_execucao).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Histórico de execuções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</div>
          ) : logs.map(l => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
              <Badge variant={l.status === "sucesso" ? "default" : l.status === "erro" ? "destructive" : "secondary"}>{l.status}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(l.iniciado_em).toLocaleString("pt-BR")}</span>
              <span className="text-xs">queries: <b>{l.queries_executadas}</b></span>
              <span className="text-xs">encontrados: <b>{l.grupos_encontrados}</b></span>
              <span className="text-xs">novos: <b className="text-primary">{l.grupos_novos}</b></span>
              {l.duracao_ms != null && <span className="text-xs text-muted-foreground">{(l.duracao_ms / 1000).toFixed(1)}s</span>}
              {l.erros?.length > 0 && <span className="text-xs text-destructive">⚠ {l.erros.length} erro(s)</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
