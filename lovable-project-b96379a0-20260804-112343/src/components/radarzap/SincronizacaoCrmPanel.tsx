import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  RefreshCw, ExternalLink, CheckCircle2, Merge, AlertTriangle, Search,
} from "lucide-react";

type Acao = "crm_lead_criado" | "crm_lead_dedup_vinculado" | "crm_lead_falha";

type Row = {
  id: string;
  created_at: string;
  acao: Acao;
  lead_id: string; // radarzap_leads.id
  campos_alterados: any;
  revisao_notas: string | null;
  rz: {
    proprietario_nome: string | null;
    contato: string | null;
    cidade: string | null;
    bairro: string | null;
    score: number | null;
  } | null;
};

const ACAO_LABEL: Record<Acao, string> = {
  crm_lead_criado: "Criado",
  crm_lead_dedup_vinculado: "Já existia (dedup)",
  crm_lead_falha: "Falhou",
};

export const SincronizacaoCrmPanel = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | Acao>("todos");
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("radarzap_leads_auditoria")
      .select(`
        id, created_at, acao, lead_id, campos_alterados, revisao_notas,
        rz:radarzap_leads!radarzap_leads_auditoria_lead_id_fkey (
          proprietario_nome, contato, cidade, bairro, score
        )
      `)
      .eq("imobiliaria_id", user.id)
      .in("acao", ["crm_lead_criado", "crm_lead_dedup_vinculado", "crm_lead_falha"])
      .order("created_at", { ascending: false })
      .limit(300);
    if (!error && data) setRows(data as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [user?.id]);

  const stats = useMemo(() => {
    const s = { criado: 0, dedup: 0, falha: 0 };
    rows.forEach((r) => {
      if (r.acao === "crm_lead_criado") s.criado++;
      else if (r.acao === "crm_lead_dedup_vinculado") s.dedup++;
      else if (r.acao === "crm_lead_falha") s.falha++;
    });
    return s;
  }, [rows]);

  const filtradas = useMemo(() => {
    return rows.filter((r) => {
      if (filtro !== "todos" && r.acao !== filtro) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const hay = [
          r.rz?.proprietario_nome, r.rz?.contato, r.rz?.cidade, r.rz?.bairro,
          r.campos_alterados?.error_message, r.campos_alterados?.motivo,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filtro, busca]);

  const badgeFor = (a: Acao) => {
    if (a === "crm_lead_criado") return <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" />{ACAO_LABEL[a]}</Badge>;
    if (a === "crm_lead_dedup_vinculado") return <Badge variant="secondary" className="gap-1"><Merge className="h-3 w-3" />{ACAO_LABEL[a]}</Badge>;
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{ACAO_LABEL[a]}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Sincronização com o CRM</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Status detalhado das aprovações do RadarZAP: criado, já existia (dedup) ou falhou — com link direto ao CRM.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Criados</div>
            <div className="text-2xl font-semibold text-emerald-600">{stats.criado}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Já existiam (dedup)</div>
            <div className="text-2xl font-semibold">{stats.dedup}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Falhas</div>
            <div className="text-2xl font-semibold text-destructive">{stats.falha}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome, contato, cidade, erro…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="crm_lead_criado">Somente criados</SelectItem>
              <SelectItem value="crm_lead_dedup_vinculado">Somente dedup</SelectItem>
              <SelectItem value="crm_lead_falha">Somente falhas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[520px] pr-3">
          <div className="space-y-2">
            {filtradas.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                Nenhum evento de sincronização encontrado.
              </div>
            )}
            {filtradas.map((r) => {
              const crmLeadId = r.campos_alterados?.crm_lead_id as string | undefined;
              const errMsg = r.campos_alterados?.error_message as string | undefined;
              const motivo = r.campos_alterados?.motivo as string | undefined;
              return (
                <div key={r.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {badgeFor(r.acao)}
                      <span className="font-medium">
                        {r.rz?.proprietario_nome || "Lead RadarZAP"}
                      </span>
                      {r.rz?.contato && (
                        <span className="text-xs text-muted-foreground">· {r.rz.contato}</span>
                      )}
                      {(r.rz?.cidade || r.rz?.bairro) && (
                        <span className="text-xs text-muted-foreground">
                          · {[r.rz?.bairro, r.rz?.cidade].filter(Boolean).join(" / ")}
                        </span>
                      )}
                      {typeof r.rz?.score === "number" && (
                        <Badge variant="outline" className="text-xs">Score {r.rz.score}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>

                  {r.acao !== "crm_lead_falha" && crmLeadId && (
                    <div className="flex items-center gap-2 text-sm">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/pipeline?lead=${crmLeadId}`}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir lead no CRM
                        </Link>
                      </Button>
                      {motivo && (
                        <span className="text-xs text-muted-foreground">
                          Dedup: {motivo}
                        </span>
                      )}
                    </div>
                  )}

                  {r.acao === "crm_lead_falha" && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <div className="font-medium">Falha na sincronização com o CRM</div>
                        <div className="mt-1 break-words">
                          {errMsg || "Erro desconhecido"}
                        </div>
                        {r.campos_alterados?.sqlstate && (
                          <div className="mt-1 opacity-70">SQLSTATE: {r.campos_alterados.sqlstate}</div>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SincronizacaoCrmPanel;
