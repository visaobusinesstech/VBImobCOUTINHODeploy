import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Bot, AlertTriangle, CheckCircle2 } from "lucide-react";

const PIPELINE_ESTAGIOS = [
  "novos","contato","qualificados","mandar_opcoes",
  "visita","proposta","pediu_tempo","nao_responde","fechado",
  "perdido","desistiu","comprou_outra",
];

interface Lead {
  id: string;
  estagio: string | null;
  canal_origem: string | null;
  corretor_id: string | null;
  created_at: string;
}

function todayBRIso() {
  // Retorna YYYY-MM-DD para a data BRT atual
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return d.toISOString().slice(0, 10);
}

export default function AutoAssignReport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [estagio, setEstagio] = useState<string>("todos");
  const [canal, setCanal] = useState<string>("todos");
  const [ludmilaId, setLudmilaId] = useState<string | null>(null);
  const [estagiosElegiveis, setEstagiosElegiveis] = useState<string[]>(["novos"]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Ludmila corretor + estágios configurados
      const [{ data: c }, { data: cfg }] = await Promise.all([
        supabase.from("corretores").select("id").eq("imobiliaria_id", user.id)
          .ilike("email", "ludmilasantos2499@gmail.com").maybeSingle(),
        supabase.from("imobiliaria_config").select("auto_assign_ludmila_estagios")
          .eq("user_id", user.id).maybeSingle(),
      ]);
      setLudmilaId((c as any)?.id ?? null);
      setEstagiosElegiveis(((cfg as any)?.auto_assign_ludmila_estagios) ?? ["novos"]);

      // Leads criados hoje (BRT). Usa faixa em UTC para cobrir o dia BRT.
      const startBR = new Date(`${todayBRIso()}T00:00:00-03:00`).toISOString();
      const endBR = new Date(`${todayBRIso()}T23:59:59.999-03:00`).toISOString();
      const { data } = await supabase
        .from("leads")
        .select("id, estagio, canal_origem, corretor_id, created_at")
        .eq("imobiliaria_id", user.id)
        .gte("created_at", startBR)
        .lte("created_at", endBR);
      setLeads((data as any) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const canais = useMemo(() => {
    const s = new Set<string>();
    leads.forEach(l => l.canal_origem && s.add(l.canal_origem));
    return Array.from(s).sort();
  }, [leads]);

  const filtered = useMemo(() => leads.filter(l =>
    (estagio === "todos" || (l.estagio ?? "") === estagio) &&
    (canal === "todos" || (l.canal_origem ?? "") === canal)
  ), [leads, estagio, canal]);

  const elegiveis = filtered.filter(l => estagiosElegiveis.map(x => x.toLowerCase()).includes((l.estagio ?? "").toLowerCase()));
  const semCorretor = filtered.filter(l => !l.corretor_id).length;
  const elegSemCorretor = elegiveis.filter(l => !l.corretor_id).length;
  const atribuidos = elegiveis.filter(l => ludmilaId && l.corretor_id === ludmilaId).length;
  // Falha = elegível, já com corretor definido, porém NÃO é a Ludmila
  const falhas = elegiveis.filter(l => l.corretor_id && ludmilaId && l.corretor_id !== ludmilaId).length;
  const total = filtered.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          Relatório rápido — Atribuição automática (hoje BRT)
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] uppercase text-muted-foreground mb-1">Estágio</div>
            <Select value={estagio} onValueChange={setEstagio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {PIPELINE_ESTAGIOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground mb-1">Origem / Canal</div>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {canais.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-[11px] text-muted-foreground self-end">
            Estágios elegíveis (config): <span className="font-medium text-foreground">{estagiosElegiveis.join(", ")}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Leads criados hoje" value={total} />
          <Kpi label="Sem corretor (todos)" value={semCorretor} />
          <Kpi label="Em estágio elegível" value={elegiveis.length} />
          <Kpi label="Elegíveis sem corretor" value={elegSemCorretor} tone={elegSemCorretor > 0 ? "warn" : "default"} />
          <Kpi label="Atribuídos à Ludmila" value={atribuidos} icon={<CheckCircle2 className="w-4 h-4 text-green-600" />} tone="ok" />
          <Kpi label="Falhas da regra" value={falhas} icon={<AlertTriangle className="w-4 h-4 text-amber-600" />} tone={falhas > 0 ? "warn" : "default"} />
        </div>

        {(falhas > 0 || elegSemCorretor > 0) && (
          <div className="text-[11px] text-muted-foreground border border-amber-500/30 bg-amber-500/5 rounded-md p-2 space-y-1">
            <div><b>Elegíveis sem corretor:</b> leads que deveriam ter sido atribuídos à Ludmila pelo gatilho. Verifique se a corretora está com <code>status = ativo</code> e e-mail <code>ludmilasantos2499@gmail.com</code>.</div>
            <div><b>Falhas da regra:</b> leads elegíveis que chegaram com outro corretor pré-definido — o gatilho preserva o corretor existente por design.</div>
          </div>
        )}

        {/* Tabela: leads sem corretor hoje */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Leads sem corretor (hoje BRT)</div>
            <div className="text-[11px] text-muted-foreground">{filtered.filter(l => !l.corretor_id).length} registro(s)</div>
          </div>
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-2 py-2 font-medium">ID</th>
                  <th className="px-2 py-2 font-medium">Origem</th>
                  <th className="px-2 py-2 font-medium">Estágio</th>
                  <th className="px-2 py-2 font-medium">Elegibilidade</th>
                  <th className="px-2 py-2 font-medium">Status atribuição</th>
                </tr>
              </thead>
              <tbody>
                {filtered.filter(l => !l.corretor_id).length === 0 ? (
                  <tr><td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">Nenhum lead sem corretor hoje.</td></tr>
                ) : filtered.filter(l => !l.corretor_id).map(l => {
                  const elegivel = estagiosElegiveis.map(x => x.toLowerCase()).includes((l.estagio ?? "").toLowerCase());
                  const motivo = elegivel
                    ? `Estágio "${l.estagio}" está na lista elegível`
                    : `Estágio "${l.estagio ?? "—"}" fora da lista (${estagiosElegiveis.join(", ")})`;
                  const status = elegivel
                    ? (ludmilaId ? "⏳ Aguardando atribuição" : "⚠️ Ludmila não configurada")
                    : "— Não elegível";
                  const statusCls = elegivel
                    ? (ludmilaId ? "text-amber-600" : "text-red-600")
                    : "text-muted-foreground";
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="px-2 py-2 font-mono text-[10px]">{l.id.slice(0, 8)}…</td>
                      <td className="px-2 py-2">{l.canal_origem ?? "—"}</td>
                      <td className="px-2 py-2">{l.estagio ?? "—"}</td>
                      <td className="px-2 py-2">{motivo}</td>
                      <td className={`px-2 py-2 font-medium ${statusCls}`}>{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, icon, tone = "default" }: { label: string; value: number; icon?: React.ReactNode; tone?: "default" | "warn" | "ok" }) {
  const toneCls = tone === "warn" ? "border-amber-500/40" : tone === "ok" ? "border-green-500/40" : "border-border/60";
  return (
    <div className={`rounded-md border ${toneCls} bg-background p-3`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
