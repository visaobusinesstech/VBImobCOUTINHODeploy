import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save, FlaskConical, ArrowUp, ArrowDown, Minus } from "lucide-react";

type Cfg = {
  peso_operacao: number;
  peso_contato_bom: number;
  peso_contato_parcial: number;
  peso_preco: number;
  peso_bairro: number;
  peso_cidade: number;
  peso_proprietario: number;
  peso_tipo: number;
  min_score_principal: number;
  alerta_score_alto: number;
};

const DEFAULT_CFG: Cfg = {
  peso_operacao: 30,
  peso_contato_bom: 25,
  peso_contato_parcial: 10,
  peso_preco: 15,
  peso_bairro: 15,
  peso_cidade: 7,
  peso_proprietario: 10,
  peso_tipo: 5,
  min_score_principal: 40,
  alerta_score_alto: 70,
};

type Lead = {
  id: string;
  score: number;
  is_principal: boolean;
  operacao: string | null;
  tipo_imovel: string | null;
  contato: string | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  proprietario_nome: string | null;
  resumo: string | null;
};

const CAMPOS: { key: keyof Cfg; label: string }[] = [
  { key: "peso_operacao", label: "Operação (venda/aluguel/temporada)" },
  { key: "peso_contato_bom", label: "Contato bom (≥10 dígitos)" },
  { key: "peso_contato_parcial", label: "Contato parcial (8–9 dígitos)" },
  { key: "peso_preco", label: "Preço informado" },
  { key: "peso_bairro", label: "Bairro identificado" },
  { key: "peso_cidade", label: "Somente cidade" },
  { key: "peso_proprietario", label: "Nome do proprietário" },
  { key: "peso_tipo", label: "Tipo de imóvel" },
];

/** Replica exatamente a lógica do trigger `tg_radarzap_leads_dedup_score` + extras opcionais */
function calcularScore(
  l: Lead,
  c: Cfg,
  extras: { obrig: string[]; bonus: string[]; pontosBonus: number; exigirObrig: boolean },
): { score: number; detalhes: Record<string, number>; desqualificado: boolean } {
  const det: Record<string, number> = {};
  let s = 0;
  const op = (l.operacao || "").toLowerCase();
  const contatoNorm = (l.contato || "").replace(/\D/g, "");

  if (["venda", "aluguel", "temporada"].includes(op)) {
    s += c.peso_operacao;
    det.operacao = c.peso_operacao;
  }
  if (contatoNorm.length >= 10) {
    s += c.peso_contato_bom;
    det.contato = c.peso_contato_bom;
  } else if (contatoNorm.length >= 8) {
    s += c.peso_contato_parcial;
    det.contato = c.peso_contato_parcial;
  }
  if (l.preco && l.preco > 0) {
    s += c.peso_preco;
    det.preco = c.peso_preco;
  }
  if ((l.bairro || "").trim()) {
    s += c.peso_bairro;
    det.bairro = c.peso_bairro;
  } else if ((l.cidade || "").trim()) {
    s += c.peso_cidade;
    det.cidade = c.peso_cidade;
  }
  if ((l.proprietario_nome || "").trim()) {
    s += c.peso_proprietario;
    det.proprietario = c.peso_proprietario;
  }
  if ((l.tipo_imovel || "").trim()) {
    s += c.peso_tipo;
    det.tipo = c.peso_tipo;
  }

  const texto = [l.resumo, l.tipo_imovel, l.bairro, l.cidade, l.operacao].join(" ").toLowerCase();
  const temObrig = extras.obrig.length === 0 || extras.obrig.some((k) => texto.includes(k));
  let desqualificado = false;
  if (extras.exigirObrig && extras.obrig.length && !temObrig) {
    desqualificado = true;
  }
  const hitsBonus = extras.bonus.filter((k) => k && texto.includes(k));
  if (hitsBonus.length && extras.pontosBonus > 0) {
    const add = hitsBonus.length * extras.pontosBonus;
    s += add;
    det.palavras_chave = add;
  }

  return { score: Math.min(Math.max(s, 0), 100), detalhes: det, desqualificado };
}

function parseLista(s: string): string[] {
  return s
    .split(/[\n,;]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export default function SimuladorScorePanel() {
  const { user, imobiliariaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cfgAtual, setCfgAtual] = useState<Cfg>(DEFAULT_CFG);
  const [cfgSim, setCfgSim] = useState<Cfg>(DEFAULT_CFG);
  const [palObrig, setPalObrig] = useState("");
  const [palBonus, setPalBonus] = useState("");
  const [pontosBonus, setPontosBonus] = useState(5);
  const [exigirObrig, setExigirObrig] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: leadsData }, { data: cfgData }] = await Promise.all([
      supabase
        .from("radarzap_leads")
        .select(
          "id,score,is_principal,operacao,tipo_imovel,contato,bairro,cidade,preco,proprietario_nome,resumo",
        )
        .eq("imobiliaria_id", user.id)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("radarzap_scoring_config")
        .select("*")
        .eq("imobiliaria_id", user.id)
        .maybeSingle(),
    ]);
    setLeads((leadsData as Lead[]) || []);
    const c = cfgData ? { ...DEFAULT_CFG, ...(cfgData as any) } : DEFAULT_CFG;
    setCfgAtual(c);
    setCfgSim(c);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const extras = useMemo(
    () => ({
      obrig: parseLista(palObrig),
      bonus: parseLista(palBonus),
      pontosBonus,
      exigirObrig,
    }),
    [palObrig, palBonus, pontosBonus, exigirObrig],
  );

  const resultado = useMemo(() => {
    let principaisAtual = 0;
    let principaisSim = 0;
    let alertaAtual = 0;
    let alertaSim = 0;
    let promovidos = 0;
    let rebaixados = 0;
    let desq = 0;
    const linhas = leads.map((l) => {
      const atualPassa = l.score >= cfgAtual.min_score_principal;
      const sim = calcularScore(l, cfgSim, extras);
      const simPassa = !sim.desqualificado && sim.score >= cfgSim.min_score_principal;
      if (atualPassa) principaisAtual++;
      if (simPassa) principaisSim++;
      if (l.score >= cfgAtual.alerta_score_alto) alertaAtual++;
      if (!sim.desqualificado && sim.score >= cfgSim.alerta_score_alto) alertaSim++;
      if (!atualPassa && simPassa) promovidos++;
      if (atualPassa && !simPassa) rebaixados++;
      if (sim.desqualificado) desq++;
      return {
        lead: l,
        atualPassa,
        simScore: sim.score,
        simPassa,
        desq: sim.desqualificado,
        det: sim.detalhes,
      };
    });
    return {
      linhas,
      principaisAtual,
      principaisSim,
      alertaAtual,
      alertaSim,
      promovidos,
      rebaixados,
      desq,
    };
  }, [leads, cfgAtual, cfgSim, extras]);

  const linhasMudadas = useMemo(
    () => resultado.linhas.filter((r) => r.atualPassa !== r.simPassa || r.simScore !== r.lead.score),
    [resultado],
  );

  const aplicar = async (reprocessar: boolean) => {
    if (!imobiliariaId) return;
    setSaving(true);
    const { error } = await supabase
      .from("radarzap_scoring_config")
      .upsert({ imobiliaria_id: imobiliariaId, ...cfgSim }, { onConflict: "imobiliaria_id" });
    if (error) {
      setSaving(false);
      toast.error("Falha ao aplicar", { description: error.message });
      return;
    }
    setCfgAtual(cfgSim);
    if (reprocessar) {
      const { data, error: e2 } = await supabase.rpc("rz_reprocessar_scores", { _imob: imobiliariaId });
      setSaving(false);
      if (e2) {
        toast.error("Configuração salva, mas falhou ao reprocessar", { description: e2.message });
      } else {
        const n = (data as any)?.reprocessados ?? 0;
        toast.success("Reprocessamento concluído", {
          description: `${n} lead(s) recalculados com os novos pesos.`,
        });
        await carregar();
      }
    } else {
      setSaving(false);
      toast.success("Configuração aplicada", {
        description: "Novos leads usarão esses pesos. Use 'Reprocessar' para recalcular os existentes.",
      });
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" /> Simulador de Score
          </CardTitle>
          <CardDescription>
            Ajuste pesos, mínimo, alerta e palavras-chave e veja em tempo real como {leads.length} leads recentes seriam
            reclassificados — sem alterar nada até você clicar em <b>Aplicar</b>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <MetricCard label="Principais (atual)" v={resultado.principaisAtual} />
          <MetricCard label="Principais (simulado)" v={resultado.principaisSim} destaque />
          <MetricCard label="Alerta quente (atual)" v={resultado.alertaAtual} />
          <MetricCard label="Alerta quente (simulado)" v={resultado.alertaSim} destaque />
          <MetricCard label="Promovidos" v={resultado.promovidos} cor="text-emerald-600" />
          <MetricCard label="Rebaixados" v={resultado.rebaixados} cor="text-red-600" />
          <MetricCard label="Desqualificados (palavras)" v={resultado.desq} cor="text-amber-600" />
          <MetricCard label="Mudanças de score" v={linhasMudadas.length} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pesos e limites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SliderRow
              label="Score mínimo para pipeline"
              v={cfgSim.min_score_principal}
              set={(n) => setCfgSim({ ...cfgSim, min_score_principal: n })}
            />
            <SliderRow
              label="Score de alerta quente"
              v={cfgSim.alerta_score_alto}
              set={(n) => setCfgSim({ ...cfgSim, alerta_score_alto: n })}
            />
            <Separator />
            {CAMPOS.map((f) => (
              <SliderRow
                key={f.key}
                label={f.label}
                v={cfgSim[f.key]}
                set={(n) => setCfgSim({ ...cfgSim, [f.key]: n })}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Palavras-chave (simulação)</CardTitle>
            <CardDescription>
              Somente aplicadas nesta prévia. Não são persistidas no motor de scoring.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm">Palavras obrigatórias</Label>
              <Textarea
                rows={3}
                value={palObrig}
                onChange={(e) => setPalObrig(e.target.value)}
                placeholder="proprietário, direto, sem imobiliária"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={exigirObrig} onCheckedChange={setExigirObrig} id="exigir" />
                <Label htmlFor="exigir" className="text-xs">
                  Desqualificar leads que não contenham nenhuma destas palavras
                </Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Palavras bônus</Label>
              <Textarea
                rows={3}
                value={palBonus}
                onChange={(e) => setPalBonus(e.target.value)}
                placeholder="quitado, escriturado, urgente"
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Pontos por palavra encontrada</Label>
                <Input
                  type="number"
              min={0}
                  max={30}
                  value={pontosBonus}
                  onChange={(e) => setPontosBonus(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                  className="w-20"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setCfgSim(cfgAtual)} disabled={saving}>
          <RotateCcw className="w-4 h-4 mr-1" /> Descartar simulação
        </Button>
        <Button variant="secondary" onClick={() => aplicar(false)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar configuração
        </Button>
        <Button onClick={() => aplicar(true)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-1" />}
          Salvar e reprocessar leads existentes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads impactados ({linhasMudadas.length})</CardTitle>
          <CardDescription>Ordenado pela diferença de score (maiores mudanças primeiro).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[500px] overflow-auto">
          {linhasMudadas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum lead muda com esses parâmetros.</p>
          )}
          {[...linhasMudadas]
            .sort((a, b) => Math.abs(b.simScore - b.lead.score) - Math.abs(a.simScore - a.lead.score))
            .slice(0, 100)
            .map((r) => {
              const delta = r.simScore - r.lead.score;
              const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
              const cor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-muted-foreground";
              return (
                <div key={r.lead.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {r.lead.proprietario_nome || r.lead.contato || "(sem nome)"} —{" "}
                      <span className="text-muted-foreground">
                        {r.lead.tipo_imovel || "?"} · {r.lead.bairro || r.lead.cidade || "?"} ·{" "}
                        {r.lead.operacao || "?"}
                      </span>
                    </div>
                    {r.lead.resumo && (
                      <div className="text-xs text-muted-foreground truncate">{r.lead.resumo}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.desq && <Badge variant="destructive">Desqualificado</Badge>}
                    {!r.atualPassa && r.simPassa && <Badge className="bg-emerald-600">Vira principal</Badge>}
                    {r.atualPassa && !r.simPassa && <Badge variant="secondary">Sai do pipeline</Badge>}
                    <div className={`flex items-center gap-1 font-mono ${cor}`}>
                      <span>{r.lead.score}</span>
                      <Icon className="w-3 h-3" />
                      <span className="font-semibold">{r.simScore}</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, v, cor, destaque }: { label: string; v: number; cor?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? "bg-primary/5 border-primary/30" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${cor || ""}`}>{v}</div>
    </div>
  );
}

function SliderRow({ label, v, set }: { label: string; v: number; set: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={v}
          onChange={(e) => set(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          className="w-20 h-8"
        />
      </div>
      <Slider value={[v]} min={0} max={100} step={1} onValueChange={(x) => set(x[0])} />
    </div>
  );
}
