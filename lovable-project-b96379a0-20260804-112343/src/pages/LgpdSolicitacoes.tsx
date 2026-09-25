import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Solicitacao {
  id: string;
  tipo: string;
  status: string;
  titular_nome: string | null;
  titular_email: string | null;
  titular_telefone: string | null;
  titular_documento: string | null;
  descricao: string | null;
  lead_ids: string[] | null;
  prazo_legal_em: string;
  respondido_em: string | null;
  resposta: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  recebida: "Recebida", em_verificacao: "Em verificação", em_analise: "Em análise",
  atendida: "Atendida", rejeitada: "Rejeitada", expirada: "Expirada",
};

export default function LgpdSolicitacoes() {
  const { imobiliariaId } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Solicitacao[]>([]);
  const [metricas, setMetricas] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<Solicitacao | null>(null);
  const [status, setStatus] = useState<string>("em_analise");
  const [resposta, setResposta] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { document.title = "Solicitações LGPD · radarimobtech"; }, []);

  const carregar = async () => {
    if (!imobiliariaId) return;
    setLoading(true);
    const [{ data }, { data: mets }] = await Promise.all([
      supabase.from("lgpd_solicitacoes_titular").select("*").order("created_at", { ascending: false }),
      supabase.rpc("lgpd_metricas_imobiliaria", { _imobiliaria_id: imobiliariaId }),
    ]);
    setRows((data as any) ?? []);
    setMetricas(Array.isArray(mets) ? mets[0] : mets);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [imobiliariaId]);

  const abrir = (s: Solicitacao) => {
    setAberto(s); setStatus(s.status === "recebida" ? "em_analise" : s.status);
    setResposta(s.resposta ?? "");
  };

  const salvar = async () => {
    if (!aberto) return;
    setSalvando(true);
    const isFinal = ["atendida", "rejeitada"].includes(status);
    const { error } = await supabase.from("lgpd_solicitacoes_titular").update({
      status, resposta,
      respondido_em: isFinal ? new Date().toISOString() : null,
    }).eq("id", aberto.id);
    setSalvando(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Solicitação atualizada" });
    setAberto(null); await carregar();
  };

  const badgePrazo = (s: Solicitacao) => {
    if (["atendida","rejeitada","expirada"].includes(s.status)) return null;
    const rest = (new Date(s.prazo_legal_em).getTime() - Date.now()) / (86400_000);
    if (rest < 0) return <Badge variant="destructive">Vencida</Badge>;
    if (rest < 3) return <Badge className="bg-orange-500">Prazo em {Math.ceil(rest)}d</Badge>;
    return <Badge variant="secondary">{Math.ceil(rest)}d</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Solicitações LGPD do Titular</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: "Recebidas", v: metricas?.total_recebidas ?? 0, icon: ShieldCheck },
          { l: "Pendentes", v: metricas?.pendentes ?? 0, icon: Clock },
          { l: "Próximas do prazo", v: metricas?.proximas_do_prazo ?? 0, icon: AlertTriangle, cls: "text-orange-600" },
          { l: "Vencidas", v: metricas?.vencidas ?? 0, icon: AlertTriangle, cls: "text-red-600" },
          { l: "Atendidas", v: metricas?.atendidas ?? 0, icon: CheckCircle2, cls: "text-green-600" },
        ].map((m) => (
          <Card key={m.l}><CardContent className="pt-4">
            <div className={`flex items-center gap-2 text-sm ${m.cls ?? ""}`}><m.icon className="h-4 w-4" />{m.l}</div>
            <div className="text-2xl font-semibold mt-1">{m.v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Carregando…</div> : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma solicitação recebida ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aberta</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      <div className="font-medium">{s.titular_nome}</div>
                      <div className="text-xs text-muted-foreground">{s.titular_email}</div>
                    </TableCell>
                    <TableCell>{s.tipo}</TableCell>
                    <TableCell><Badge variant="outline">{STATUS_LABEL[s.status] ?? s.status}</Badge></TableCell>
                    <TableCell>{badgePrazo(s)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => abrir(s)}>Tratar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Solicitação #{aberto?.id.slice(0, 8)}</DialogTitle></DialogHeader>
          {aberto && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><strong>Titular:</strong> {aberto.titular_nome}</div>
                <div><strong>E-mail:</strong> {aberto.titular_email}</div>
                <div><strong>Telefone:</strong> {aberto.titular_telefone ?? "—"}</div>
                <div><strong>Documento:</strong> {aberto.titular_documento ?? "—"}</div>
                <div><strong>Tipo:</strong> {aberto.tipo}</div>
                <div><strong>Prazo legal:</strong> {new Date(aberto.prazo_legal_em).toLocaleDateString("pt-BR")}</div>
              </div>
              <div className="text-sm"><strong>Descrição do pedido:</strong>
                <div className="mt-1 p-2 bg-muted rounded text-muted-foreground whitespace-pre-wrap">{aberto.descricao}</div>
              </div>
              {aberto.lead_ids && aberto.lead_ids.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {aberto.lead_ids.length} registro(s) identificado(s) na base de captação vinculado(s) ao titular.
                </div>
              )}
              <div>
                <div className="text-sm font-medium mb-1">Atualizar status</div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["em_verificacao","em_analise","atendida","rejeitada","expirada"].map(s =>
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s] ?? s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Resposta ao titular</div>
                <Textarea rows={5} value={resposta} onChange={(e) => setResposta(e.target.value)}
                  placeholder="Descreva a ação tomada, base legal, e demais informações que serão exibidas ao titular no portal público." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
