import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, RotateCcw, Play, Smartphone, Monitor, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface LighthouseConfig {
  id?: string;
  imobiliaria_id: string;
  paths: string[];
  strategies: Array<"mobile" | "desktop">;
  min_performance: number;
  min_seo: number;
  min_accessibility: number;
  min_best_practices: number;
  max_lcp_ms: number;
  max_cls: number;
  max_tbt_ms: number;
  regression_delta: number;
}

const DEFAULTS = {
  paths: ["/", "/portal", "/anunciar-imovel"],
  strategies: ["mobile"] as Array<"mobile" | "desktop">,
  min_performance: 70,
  min_seo: 90,
  min_accessibility: 85,
  min_best_practices: 85,
  max_lcp_ms: 2500,
  max_cls: 0.1,
  max_tbt_ms: 300,
  regression_delta: 10,
};

export function SeoLighthouseConfigTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [config, setConfig] = useState<LighthouseConfig | null>(null);
  const [newPath, setNewPath] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("lighthouse_config")
        .select("*")
        .eq("imobiliaria_id", user.id)
        .maybeSingle();
      if (error) toast.error("Falha ao carregar configuração: " + error.message);
      setConfig({
        imobiliaria_id: user.id,
        ...DEFAULTS,
        ...(data ?? {}),
      } as LighthouseConfig);
      setLoading(false);
    })();
  }, [user?.id]);

  function update<K extends keyof LighthouseConfig>(key: K, value: LighthouseConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }

  function addPath() {
    const p = newPath.trim();
    if (!p) return;
    if (!p.startsWith("/")) {
      toast.error("A rota deve começar com /");
      return;
    }
    if (!config) return;
    if (config.paths.includes(p)) {
      toast.info("Rota já adicionada");
      return;
    }
    if (config.paths.length >= 20) {
      toast.error("Máximo de 20 rotas por auditoria");
      return;
    }
    update("paths", [...config.paths, p]);
    setNewPath("");
  }

  function removePath(p: string) {
    if (!config) return;
    update("paths", config.paths.filter((x) => x !== p));
  }

  function toggleStrategy(s: "mobile" | "desktop") {
    if (!config) return;
    const has = config.strategies.includes(s);
    const next = has ? config.strategies.filter((x) => x !== s) : [...config.strategies, s];
    if (next.length === 0) {
      toast.error("Selecione ao menos um dispositivo");
      return;
    }
    update("strategies", next);
  }

  async function save() {
    if (!config || !user?.id) return;
    if (config.paths.length === 0) {
      toast.error("Adicione ao menos uma rota");
      return;
    }
    setSaving(true);
    const payload = {
      imobiliaria_id: user.id,
      paths: config.paths,
      strategies: config.strategies,
      min_performance: config.min_performance,
      min_seo: config.min_seo,
      min_accessibility: config.min_accessibility,
      min_best_practices: config.min_best_practices,
      max_lcp_ms: config.max_lcp_ms,
      max_cls: config.max_cls,
      max_tbt_ms: config.max_tbt_ms,
      regression_delta: config.regression_delta,
    };
    const { error } = await supabase
      .from("lighthouse_config")
      .upsert(payload, { onConflict: "imobiliaria_id" });
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    toast.success("Configuração salva");
  }

  function resetDefaults() {
    if (!user?.id) return;
    setConfig({ imobiliaria_id: user.id, ...DEFAULTS });
    toast.info("Padrões restaurados — clique em Salvar para persistir");
  }

  async function runNow() {
    if (!config) return;
    setRunning(true);
    toast.info(`Executando Lighthouse em ${config.paths.length} rota(s) × ${config.strategies.length} dispositivo(s)…`);
    const { data, error } = await supabase.functions.invoke("lighthouse-audit", {
      body: { paths: config.paths, strategies: config.strategies },
    });
    setRunning(false);
    if (error) {
      toast.error("Falha ao executar: " + error.message);
      return;
    }
    const s = (data as { summary?: { total: number; ok: number; avgPerformance: number | null } })?.summary;
    toast.success(`Concluído · ${s?.ok ?? 0}/${s?.total ?? 0} OK · Perf média: ${s?.avgPerformance ?? "—"}`);
  }

  const totalRuns = useMemo(
    () => (config ? config.paths.length * config.strategies.length : 0),
    [config],
  );

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando configuração…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Configuração do Lighthouse</h2>
          <p className="text-xs text-muted-foreground">
            Defina rotas, dispositivos e limites que serão usados nas auditorias. As configurações
            ficam salvas no banco e são aplicadas ao clicar em <b>Executar agora</b>.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={resetDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" /> Padrões
          </Button>
          <Button variant="outline" size="sm" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Executar agora
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rotas auditadas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Até 20 rotas. Serão executadas <b>{totalRuns}</b> auditoria(s) por rodada.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="/ex: /anunciar-imovel/brasilia"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPath();
                }
              }}
            />
            <Button variant="outline" onClick={addPath}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.paths.length === 0 && (
              <span className="text-sm text-muted-foreground">Nenhuma rota configurada.</span>
            )}
            {config.paths.map((p) => (
              <Badge key={p} variant="secondary" className="gap-1 font-mono text-[11px] py-1 pl-2 pr-1">
                {p}
                <button
                  type="button"
                  onClick={() => removePath(p)}
                  className="ml-1 rounded hover:bg-background/60 p-0.5"
                  aria-label={`Remover ${p}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Colar várias rotas (uma por linha)</Label>
            <Textarea
              placeholder={"/portal\n/anunciar-imovel\n/lgpd/meus-dados"}
              rows={3}
              onBlur={(e) => {
                const items = e.target.value
                  .split(/\r?\n/)
                  .map((x) => x.trim())
                  .filter((x) => x.startsWith("/"));
                if (!items.length) return;
                const merged = Array.from(new Set([...config.paths, ...items])).slice(0, 20);
                update("paths", merged);
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dispositivos</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-6 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.strategies.includes("mobile")}
              onCheckedChange={() => toggleStrategy("mobile")}
            />
            <Smartphone className="h-4 w-4" /> Mobile
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.strategies.includes("desktop")}
              onCheckedChange={() => toggleStrategy("desktop")}
            />
            <Monitor className="h-4 w-4" /> Desktop
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limites mínimos de pontuação</CardTitle>
          <p className="text-xs text-muted-foreground">
            Rotas com scores abaixo destes valores serão sinalizadas nos relatórios.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumField label="Performance (0-100)" value={config.min_performance} onChange={(v) => update("min_performance", v)} min={0} max={100} />
          <NumField label="SEO (0-100)" value={config.min_seo} onChange={(v) => update("min_seo", v)} min={0} max={100} />
          <NumField label="Acessibilidade (0-100)" value={config.min_accessibility} onChange={(v) => update("min_accessibility", v)} min={0} max={100} />
          <NumField label="Best Practices (0-100)" value={config.min_best_practices} onChange={(v) => update("min_best_practices", v)} min={0} max={100} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limites máximos de Core Web Vitals</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumField label="LCP máximo (ms)" value={config.max_lcp_ms} onChange={(v) => update("max_lcp_ms", v)} min={0} max={20000} />
          <NumField label="CLS máximo" value={config.max_cls} onChange={(v) => update("max_cls", v)} min={0} max={5} step={0.01} />
          <NumField label="TBT máximo (ms)" value={config.max_tbt_ms} onChange={(v) => update("max_tbt_ms", v)} min={0} max={10000} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas de regressão</CardTitle>
          <p className="text-xs text-muted-foreground">
            Queda mínima (em pontos) entre auditorias consecutivas para abrir um alerta automaticamente. Aplica-se a Performance, SEO, Acessibilidade e Best Practices.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumField
            label="Queda mínima (pts)"
            value={config.regression_delta}
            onChange={(v) => update("regression_delta", v)}
            min={1}
            max={100}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function NumField({
  label, value, onChange, min, max, step = 1,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}
