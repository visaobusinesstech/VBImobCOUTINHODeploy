import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListOrdered, Play, User, Loader2, CheckCircle2, Users } from "lucide-react";
import {
  useFilaDistribuicao,
  useCorretoresCap,
  useDistribuirFila,
  useSetLimiteCorretor,
  useEncerrarLeadFila,
} from "@/hooks/useFilaDistribuicao";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function FilaDistribuicao() {
  const [status, setStatus] = useState<"pending" | "assigned" | "all">("pending");
  const { data: fila = [], isLoading } = useFilaDistribuicao(status);
  const { data: caps = [] } = useCorretoresCap();
  const distribuir = useDistribuirFila();
  const setLimite = useSetLimiteCorretor();
  const encerrar = useEncerrarLeadFila();

  const totals = useMemo(() => {
    const pend = fila.filter((f) => f.status === "pending").length;
    const atrib = fila.filter((f) => f.status === "assigned").length;
    const capTotal = caps.reduce((a, c) => a + c.limite, 0);
    const capUsada = caps.reduce((a, c) => a + c.ativos, 0);
    return { pend, atrib, capTotal, capUsada };
  }, [fila, caps]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ListOrdered className="w-6 h-6 text-primary" />
              Fila de Distribuição Global
            </h1>
            <p className="text-sm text-muted-foreground">
              Leads da IA priorizados por <strong>ai_score</strong> (FIFO em empate) e distribuídos em
              round-robin entre corretores com capacidade livre.
            </p>
          </div>
          <Button onClick={() => distribuir.mutate()} disabled={distribuir.isPending} className="gap-2">
            {distribuir.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Distribuir agora
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Pendentes</div>
            <div className="text-2xl font-bold text-primary">{totals.pend}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Ativos atribuídos</div>
            <div className="text-2xl font-bold">{totals.atrib}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Capacidade da equipe</div>
            <div className="text-2xl font-bold">{totals.capUsada}/{totals.capTotal}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Corretores ativos</div>
            <div className="text-2xl font-bold">{caps.filter((c) => c.status === "ativo").length}</div>
          </CardContent></Card>
        </div>

        {/* Corretores + capacidade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" /> Capacidade dos corretores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {caps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum corretor cadastrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Corretor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ativos</TableHead>
                    <TableHead>Limite</TableHead>
                    <TableHead>Livre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caps.map((c) => (
                    <TableRow key={c.corretor_id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "ativo" ? "default" : "outline"}>{c.status}</Badge>
                      </TableCell>
                      <TableCell>{c.ativos}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20"
                          defaultValue={c.limite}
                          min={0}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== c.limite) setLimite.mutate({ corretor_id: c.corretor_id, limite: v });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <span className={c.capacidade_livre === 0 ? "text-red-600 font-semibold" : "text-emerald-700 font-semibold"}>
                          {c.capacidade_livre}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Fila */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">Fila</CardTitle>
              <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
                <TabsList>
                  <TabsTrigger value="pending">Pendentes</TabsTrigger>
                  <TabsTrigger value="assigned">Atribuídos</TabsTrigger>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </div>
            ) : fila.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhum lead nesse status.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Score</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Corretor</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fila.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <Badge className="bg-primary text-primary-foreground font-semibold">
                          {Number(f.ai_score).toFixed(0)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{f.payload?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.payload?.bairro ?? "—"} · {f.payload?.cidade ?? "—"} · {f.payload?.operacao ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{f.source}</Badge></TableCell>
                      <TableCell className="text-xs">{fmtDate(f.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={f.status === "pending" ? "secondary" : f.status === "assigned" ? "default" : "outline"}>
                          {f.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {f.corretor?.nome ? (
                          <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{f.corretor.nome}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {f.status === "assigned" && (
                          <Button size="sm" variant="outline" onClick={() => encerrar.mutate(f.id)} className="gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Encerrar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
