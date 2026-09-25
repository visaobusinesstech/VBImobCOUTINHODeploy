import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, RefreshCw, Download } from "lucide-react";

type Row = {
  id: string;
  lead_id: string;
  acao: string;
  actor_user_id: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  campos_alterados: Record<string, { antes: unknown; depois: unknown }>;
  revisao_notas: string | null;
  created_at: string;
  radarzap_leads?: { proprietario_nome: string | null; contato: string | null; cidade: string | null; bairro: string | null } | null;
};

const ACOES = ["todos", "aprovado", "rejeitado", "editado", "status_alterado"] as const;

const badgeVariant = (a: string) =>
  a === "aprovado" ? "default" : a === "rejeitado" ? "destructive" : "secondary";

export default function AuditoriaAprovacoesPanel() {
  const { imobiliariaId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [acao, setAcao] = useState<string>("todos");

  const carregar = async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("radarzap_leads_auditoria" as any)
      .select("*, radarzap_leads(proprietario_nome, contato, cidade, bairro)")
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) setRows(data as any);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [imobiliariaId]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (acao !== "todos" && r.acao !== acao) return false;
      if (!q) return true;
      const hay = [
        r.radarzap_leads?.proprietario_nome,
        r.radarzap_leads?.contato,
        r.radarzap_leads?.cidade,
        r.radarzap_leads?.bairro,
        r.revisao_notas,
        r.actor_user_id,
        r.lead_id,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, busca, acao]);

  const exportCsv = () => {
    const header = ["data", "acao", "lead", "contato", "cidade", "bairro", "actor", "status_anterior", "status_novo", "campos_alterados", "notas"];
    const lines = [header.join(",")];
    for (const r of filtrados) {
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      lines.push([
        r.created_at, r.acao,
        r.radarzap_leads?.proprietario_nome ?? "",
        r.radarzap_leads?.contato ?? "",
        r.radarzap_leads?.cidade ?? "",
        r.radarzap_leads?.bairro ?? "",
        r.actor_user_id ?? "",
        r.status_anterior ?? "",
        r.status_novo ?? "",
        JSON.stringify(r.campos_alterados ?? {}),
        r.revisao_notas ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radarzap_auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Auditoria de aprovações e alterações
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Histórico completo de quem aprovou, rejeitou ou alterou dados sensíveis dos leads antes do registro definitivo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por proprietário, contato, cidade, notas..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-sm"
          />
          <Select value={acao} onValueChange={setAcao}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACOES.map((a) => (
                <SelectItem key={a} value={a}>{a === "todos" ? "Todas as ações" : a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1">Atualizar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtrados.length}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
          <div className="ml-auto text-sm text-muted-foreground self-center">
            {filtrados.length} de {rows.length} registro(s)
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : filtrados.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Nenhum registro de auditoria encontrado.</div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 text-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariant(r.acao) as any}>{r.acao}</Badge>
                  <span className="font-medium">{r.radarzap_leads?.proprietario_nome || "—"}</span>
                  {r.radarzap_leads?.contato && <span className="text-muted-foreground">· {r.radarzap_leads.contato}</span>}
                  {(r.radarzap_leads?.cidade || r.radarzap_leads?.bairro) && (
                    <span className="text-muted-foreground">
                      · {[r.radarzap_leads?.bairro, r.radarzap_leads?.cidade].filter(Boolean).join(" / ")}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {r.actor_user_id && (
                  <div className="text-xs text-muted-foreground">Responsável: <code className="font-mono">{r.actor_user_id.slice(0, 8)}…</code></div>
                )}
                {Object.keys(r.campos_alterados || {}).length > 0 && (
                  <div className="bg-muted/40 rounded p-2 space-y-1">
                    {Object.entries(r.campos_alterados).map(([campo, diff]) => (
                      <div key={campo} className="text-xs">
                        <span className="font-medium">{campo}:</span>{" "}
                        <span className="line-through text-muted-foreground">{String((diff as any)?.antes ?? "—")}</span>
                        {" → "}
                        <span className="text-foreground">{String((diff as any)?.depois ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                )}
                {r.revisao_notas && (
                  <div className="text-xs italic text-muted-foreground">Notas: {r.revisao_notas}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
