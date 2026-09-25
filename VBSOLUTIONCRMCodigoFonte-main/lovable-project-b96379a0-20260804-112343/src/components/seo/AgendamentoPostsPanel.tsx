import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, X, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Row {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  created_at: string;
  agendado_para: string | null;
  publicado_em: string | null;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AgendamentoPostsPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("conteudos_seo")
      .select("id,titulo,tipo,status,created_at,agendado_para,publicado_em" as any)
      .in("status", ["rascunho", "publicado"])
      .order("agendado_para", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setRows((data as any[]) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const agendar = async (id: string) => {
    const val = drafts[id];
    if (!val) { toast({ title: "Escolha uma data e hora", variant: "destructive" }); return; }
    const iso = new Date(val).toISOString();
    if (new Date(iso) <= new Date()) {
      toast({ title: "Data inválida", description: "Escolha um momento futuro.", variant: "destructive" });
      return;
    }
    setSavingId(id);
    const { error } = await supabase
      .from("conteudos_seo")
      .update({ agendado_para: iso, status: "rascunho" } as any)
      .eq("id", id);
    setSavingId(null);
    if (error) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Publicação agendada", description: format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }) });
      fetchRows();
    }
  };

  const cancelarAgendamento = async (id: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from("conteudos_seo")
      .update({ agendado_para: null } as any)
      .eq("id", id);
    setSavingId(null);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Agendamento cancelado" }); fetchRows(); }
  };

  const agendados = rows.filter(r => r.status === "rascunho" && r.agendado_para);
  const rascunhos = rows.filter(r => r.status === "rascunho" && !r.agendado_para);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="w-5 h-5" /> Agendamento de publicações
            </CardTitle>
            <CardDescription>
              Defina data e hora para publicar automaticamente cada rascunho. A execução ocorre a cada 30 minutos.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRows} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agendados ({agendados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : agendados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma publicação agendada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Publicar em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendados.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.titulo}</TableCell>
                    <TableCell><Badge variant="secondary">{r.tipo}</Badge></TableCell>
                    <TableCell>
                      {format(new Date(r.agendado_para!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => cancelarAgendamento(r.id)} disabled={savingId === r.id} className="gap-1.5">
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rascunhos sem agendamento ({rascunhos.length})</CardTitle>
          <CardDescription>Escolha data e hora para agendar a publicação.</CardDescription>
        </CardHeader>
        <CardContent>
          {rascunhos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum rascunho disponível.</p>
          ) : (
            <div className="space-y-3">
              {rascunhos.map(r => (
                <div key={r.id} className="flex flex-col md:flex-row md:items-end gap-3 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.titulo}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{r.tipo}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Criado em {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <div className="md:w-64">
                    <Label className="text-xs">Data e hora</Label>
                    <Input
                      type="datetime-local"
                      value={drafts[r.id] ?? toLocalInput(new Date(Date.now() + 60 * 60 * 1000).toISOString())}
                      onChange={e => setDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
                    />
                  </div>
                  <Button onClick={() => agendar(r.id)} disabled={savingId === r.id} className="gap-1.5">
                    {savingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
                    Agendar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
