import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAllSeoChecklist, SeoChecklistItem } from "@/hooks/useSeoChecklist";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Search } from "lucide-react";

export function SeoChecklistTab() {
  const { imobiliariaId } = useAuth();
  const [items, setItems] = useState<SeoChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"todos" | "resolvido" | "pendente">("todos");

  async function load() {
    if (!imobiliariaId) return;
    setLoading(true);
    const data = await fetchAllSeoChecklist(imobiliariaId);
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imobiliariaId]);

  const filtered = items.filter((i) => {
    if (status === "resolvido" && !i.resolved) return false;
    if (status === "pendente" && i.resolved) return false;
    if (q) {
      const s = q.toLowerCase();
      return (
        i.route_path.toLowerCase().includes(s) ||
        i.tag_key.toLowerCase().includes(s) ||
        (i.notes || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totals = {
    total: items.length,
    resolvidos: items.filter((i) => i.resolved).length,
    pendentes: items.filter((i) => !i.resolved).length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar rota, tag ou observação…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="resolvido">Resolvidos</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{totals.total} itens</Badge>
          <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
            {totals.resolvidos} resolvidos
          </Badge>
          <Badge variant="outline" className="text-amber-800 border-amber-200 bg-amber-50">
            {totals.pendentes} pendentes
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Recarregar
        </Button>
      </div>

      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rota</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data da correção</TableHead>
              <TableHead>Observações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Nenhum item registrado. Abra o drill-down de uma rota e marque itens como
                  resolvidos.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((i) => (
                <TableRow key={`${i.route_path}-${i.tag_key}`}>
                  <TableCell className="font-mono text-xs">{i.route_path}</TableCell>
                  <TableCell className="font-mono text-xs">{i.tag_key}</TableCell>
                  <TableCell>
                    {i.resolved ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        Resolvido
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        Pendente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {i.resolved_at
                      ? new Date(i.resolved_at).toLocaleString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs max-w-[420px] whitespace-pre-wrap break-words">
                    {i.notes || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
