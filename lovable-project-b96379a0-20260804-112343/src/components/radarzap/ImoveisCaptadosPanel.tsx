import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, ExternalLink, Search } from "lucide-react";
import { useRadarZapImoveis, type ImoveisFiltros } from "@/hooks/useRadarZapImoveis";
import { exportImoveisXlsx, exportImoveisCsv } from "@/lib/exportImoveisXlsx";

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function ImoveisCaptadosPanel() {
  const [filtros, setFiltros] = useState<ImoveisFiltros>({});
  const { imoveis, loading } = useRadarZapImoveis(filtros);

  const cidades = useMemo(() => Array.from(new Set(imoveis.map((i) => i.cidade).filter(Boolean))) as string[], [imoveis]);
  const bairros = useMemo(() => Array.from(new Set(imoveis.map((i) => i.bairro).filter(Boolean))) as string[], [imoveis]);
  const tipos = useMemo(() => Array.from(new Set(imoveis.map((i) => i.tipo_imovel).filter(Boolean))) as string[], [imoveis]);

  const set = (k: keyof ImoveisFiltros, v: any) => setFiltros((f) => ({ ...f, [k]: v || undefined }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Imóveis captados ({imoveis.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportImoveisCsv(imoveis)} disabled={imoveis.length === 0}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button size="sm" onClick={() => exportImoveisXlsx(imoveis)} disabled={imoveis.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="col-span-2 relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar endereço, bairro, proprietário…"
                className="pl-8"
                value={filtros.q ?? ""}
                onChange={(e) => set("q", e.target.value)}
              />
            </div>
            <Select value={filtros.tipo ?? "all"} onValueChange={(v) => set("tipo", v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtros.operacao ?? "all"} onValueChange={(v) => set("operacao", v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Operação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Venda + Aluguel</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="aluguel">Aluguel</SelectItem>
                <SelectItem value="temporada">Temporada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtros.cidade ?? "all"} onValueChange={(v) => set("cidade", v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas cidades</SelectItem>
                {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtros.bairro ?? "all"} onValueChange={(v) => set("bairro", v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Bairro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos bairros</SelectItem>
                {bairros.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Qtos mín." value={filtros.quartos_min ?? ""} onChange={(e) => set("quartos_min", Number(e.target.value) || undefined)} />
            <Input type="number" placeholder="Valor mín." value={filtros.preco_min ?? ""} onChange={(e) => set("preco_min", Number(e.target.value) || undefined)} />
            <Input type="number" placeholder="Valor máx." value={filtros.preco_max ?? ""} onChange={(e) => set("preco_max", Number(e.target.value) || undefined)} />
          </div>

          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Config.</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Grupo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando…</TableCell></TableRow>}
                {!loading && imoveis.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum imóvel captado. Conecte o WhatsApp em <b>Conexão</b> e importe grupos em <b>Importar grupos</b>.
                  </TableCell></TableRow>
                )}
                {imoveis.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium">{i.tipo_imovel ?? "Imóvel"} · {i.operacao ?? "—"}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 max-w-[280px]">{i.descricao ?? i.mensagem_original ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {i.endereco && <div>{i.endereco}</div>}
                      <div>{[i.bairro, i.cidade, i.uf].filter(Boolean).join(", ") || "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {[
                        i.quartos && `${i.quartos}Q`,
                        i.suites && `${i.suites}Ste`,
                        i.banheiros && `${i.banheiros}Ban`,
                        i.vagas && `${i.vagas}Vg`,
                        i.area_util && `${i.area_util}m²`,
                      ].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">{money(i.preco)}</div>
                      {i.condominio_valor && <div className="text-xs text-muted-foreground">Cond. {money(i.condominio_valor)}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{i.proprietario_nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{i.contato ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {i.grupo_nome ? (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="max-w-[140px] truncate">{i.grupo_nome}</Badge>
                          {i.grupo_invite_url && (
                            <a href={i.grupo_invite_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
