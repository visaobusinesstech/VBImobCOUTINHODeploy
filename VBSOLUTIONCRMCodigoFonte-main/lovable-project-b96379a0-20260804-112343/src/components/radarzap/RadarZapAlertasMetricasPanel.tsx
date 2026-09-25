import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { AlertTriangle, Bell, Loader2, PlayCircle, Save, TrendingDown } from "lucide-react";

type Config = {
  id?: string;
  imobiliaria_id: string;
  ativo: boolean;
  min_taxa_geracao: number;
  min_taxa_aprovacao: number;
  min_mensagens_avaliacao: number;
  min_leads_avaliacao: number;
  janela_horas: number;
  cooldown_horas: number;
  ultimo_check_em?: string | null;
  descoberta_alertar_zero: boolean;
  descoberta_alertar_erro: boolean;
  descoberta_alertar_timeout: boolean;
  descoberta_timeout_ms: number;
  descoberta_min_erros: number;
};

type TipoAlerta = "taxa_geracao" | "taxa_aprovacao" | "descoberta_zero" | "descoberta_erro" | "descoberta_timeout";

type LogRow = {
  id: string;
  tipo: TipoAlerta;
  taxa_observada: number;
  taxa_minima: number;
  total_mensagens: number;
  total_leads: number;
  total_aprovados: number;
  janela_horas: number;
  detalhes: { motivo?: string; [k: string]: unknown } | null;
  created_at: string;
};

const DEFAULTS = {
  ativo: true,
  min_taxa_geracao: 5,
  min_taxa_aprovacao: 40,
  min_mensagens_avaliacao: 20,
  min_leads_avaliacao: 5,
  janela_horas: 24,
  cooldown_horas: 6,
  descoberta_alertar_zero: true,
  descoberta_alertar_erro: true,
  descoberta_alertar_timeout: true,
  descoberta_timeout_ms: 60000,
  descoberta_min_erros: 1,
};

const TIPO_LABEL: Record<TipoAlerta, string> = {
  taxa_geracao: "Taxa de geração",
  taxa_aprovacao: "Taxa de aprovação",
  descoberta_zero: "Descoberta · 0 resultados",
  descoberta_erro: "Descoberta · erro Firecrawl",
  descoberta_timeout: "Descoberta · tempo excedido",
};


export default function RadarZapAlertasMetricasPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [c, l] = await Promise.all([
      supabase.from("radarzap_metricas_alertas_config").select("*").eq("imobiliaria_id", user.id).maybeSingle(),
      supabase.from("radarzap_metricas_alertas_log").select("*").eq("imobiliaria_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (c.error && c.error.code !== "PGRST116") toast.error("Erro ao carregar config: " + c.error.message);
    if (l.error) toast.error("Erro ao carregar histórico: " + l.error.message);
    setCfg((c.data as Config) ?? { imobiliaria_id: user.id, ...DEFAULTS });
    setLogs((l.data ?? []) as LogRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!cfg || !user) return;
    setSaving(true);
    const payload = { ...cfg, imobiliaria_id: user.id };
    const { error } = await supabase.from("radarzap_metricas_alertas_config").upsert(payload, { onConflict: "imobiliaria_id" });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Configuração salva.");
    carregar();
  };

  const testarAgora = async () => {
    if (!user) return;
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("radarzap-metricas-monitor", {
      body: { imobiliaria_id: user.id },
    });
    setRunning(false);
    if (error) return toast.error("Falha ao executar: " + error.message);
    const res = (data as { resultados?: Array<{ alertas: string[]; taxa_geracao: number; taxa_aprovacao: number }> })?.resultados?.[0];
    if (res) {
      toast.success(
        res.alertas.length > 0
          ? `Alertas disparados: ${res.alertas.join(", ")} (geração ${res.taxa_geracao}% · aprovação ${res.taxa_aprovacao}%)`
          : `Sem alertas. Geração ${res.taxa_geracao}% · Aprovação ${res.taxa_aprovacao}%`,
      );
    } else {
      toast.info("Nenhum resultado.");
    }
    carregar();
  };

  if (loading || !cfg) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>;
  }

  const upd = <K extends keyof Config>(k: K, v: Config[K]) => setCfg({ ...cfg, [k]: v });

  const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas de queda de performance
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Verificação automática a cada hora. Cria uma notificação sempre que a taxa cai abaixo do limite configurado.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <div className="font-medium text-sm">Monitoramento ativo</div>
              <div className="text-xs text-muted-foreground">
                {cfg.ultimo_check_em ? `Último check: ${fmtDate(cfg.ultimo_check_em)}` : "Ainda não executado."}
              </div>
            </div>
            <Switch checked={cfg.ativo} onCheckedChange={(v) => upd("ativo", v)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><TrendingDown className="h-3 w-3" />Taxa mínima de geração (%)</Label>
              <Input type="number" min={0} max={100} step={0.1}
                value={cfg.min_taxa_geracao}
                onChange={(e) => upd("min_taxa_geracao", Number(e.target.value))} />
              <p className="text-[11px] text-muted-foreground">Leads gerados / mensagens analisadas.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><TrendingDown className="h-3 w-3" />Taxa mínima de aprovação (%)</Label>
              <Input type="number" min={0} max={100} step={0.1}
                value={cfg.min_taxa_aprovacao}
                onChange={(e) => upd("min_taxa_aprovacao", Number(e.target.value))} />
              <p className="text-[11px] text-muted-foreground">Leads aprovados / leads gerados.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mínimo de mensagens para avaliar</Label>
              <Input type="number" min={1}
                value={cfg.min_mensagens_avaliacao}
                onChange={(e) => upd("min_mensagens_avaliacao", Number(e.target.value))} />
              <p className="text-[11px] text-muted-foreground">Evita alerta em amostras pequenas.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mínimo de leads para avaliar</Label>
              <Input type="number" min={1}
                value={cfg.min_leads_avaliacao}
                onChange={(e) => upd("min_leads_avaliacao", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Janela de análise (horas)</Label>
              <Input type="number" min={1} max={168}
                value={cfg.janela_horas}
                onChange={(e) => upd("janela_horas", Number(e.target.value))} />
              <p className="text-[11px] text-muted-foreground">Padrão: 24h.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cooldown entre alertas (horas)</Label>
              <Input type="number" min={1} max={168}
                value={cfg.cooldown_horas}
                onChange={(e) => upd("cooldown_horas", Number(e.target.value))} />
              <p className="text-[11px] text-muted-foreground">Evita spam do mesmo tipo.</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="text-sm font-medium">Alertas da busca de grupos públicos</div>
            <p className="text-[11px] text-muted-foreground">
              Disparam durante cada execução de <em>Buscar grupos públicos</em> quando as condições abaixo forem atendidas.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center justify-between rounded border p-3 text-xs">
                <span>Zero resultados</span>
                <Switch checked={cfg.descoberta_alertar_zero} onCheckedChange={(v) => upd("descoberta_alertar_zero", v)} />
              </label>
              <label className="flex items-center justify-between rounded border p-3 text-xs">
                <span>Erro do Firecrawl</span>
                <Switch checked={cfg.descoberta_alertar_erro} onCheckedChange={(v) => upd("descoberta_alertar_erro", v)} />
              </label>
              <label className="flex items-center justify-between rounded border p-3 text-xs">
                <span>Tempo limite excedido</span>
                <Switch checked={cfg.descoberta_alertar_timeout} onCheckedChange={(v) => upd("descoberta_alertar_timeout", v)} />
              </label>
              <div className="space-y-1">
                <Label className="text-xs">Tempo limite (ms)</Label>
                <Input type="number" min={5000} step={1000}
                  value={cfg.descoberta_timeout_ms}
                  onChange={(e) => upd("descoberta_timeout_ms", Number(e.target.value))} />
                <p className="text-[11px] text-muted-foreground">Padrão: 60000 (60s).</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mínimo de erros para alertar</Label>
                <Input type="number" min={1}
                  value={cfg.descoberta_min_erros}
                  onChange={(e) => upd("descoberta_min_erros", Number(e.target.value))} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={testarAgora} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
              Testar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Histórico de alertas ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta disparado até o momento.</p>
          ) : (
            logs.map((l) => {
              const isDescoberta = l.tipo.startsWith("descoberta_");
              return (
                <div key={l.id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={l.tipo === "taxa_geracao" || l.tipo === "descoberta_zero" || l.tipo === "descoberta_erro" ? "destructive" : "secondary"}>
                      {TIPO_LABEL[l.tipo] ?? l.tipo}
                    </Badge>
                    {!isDescoberta && (
                      <>
                        <span className="font-medium">{Number(l.taxa_observada).toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground">mínimo {Number(l.taxa_minima).toFixed(1)}%</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground">· janela {l.janela_horas}h</span>
                    <span className="text-xs text-muted-foreground ml-auto">{fmtDate(l.created_at)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {l.detalhes?.motivo ?? (isDescoberta ? "Alerta registrado." : `${l.total_leads} leads / ${l.total_mensagens} mensagens · ${l.total_aprovados} aprovados`)}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>

      </Card>
    </div>
  );
}
