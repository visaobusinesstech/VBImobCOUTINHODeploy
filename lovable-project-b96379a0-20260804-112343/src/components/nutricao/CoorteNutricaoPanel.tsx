import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import type { NutricaoFluxo, NutricaoInscricao } from "@/hooks/useNutricao";
import type { NutricaoEvento } from "@/hooks/useNutricaoMetricas";

interface Props {
  fluxos: NutricaoFluxo[];
  inscricoes: NutricaoInscricao[];
  eventos: NutricaoEvento[];
  loading?: boolean;
}

type Granularidade = "semana" | "mes";

interface LinhaCoorte {
  chave: string;
  label: string;
  inicio: Date;
  inscritos: number;
  respostas: number;
  agendamentos: number;
  fechamentos: number;
  valorFechado: number;
  taxaResposta: number;
  taxaAgendamento: number;
  taxaFechamento: number;
  diasMedioFechamento: number | null;
}

function inicioSemana(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  const dia = (c.getDay() + 6) % 7; // segunda = 0
  c.setDate(c.getDate() - dia);
  return c;
}

function inicioMes(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function rotulo(d: Date, g: Granularidade) {
  if (g === "mes") {
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  return `Sem. ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function corTaxa(taxa: number, media: number) {
  if (taxa === 0) return "text-muted-foreground";
  if (taxa >= media * 1.15) return "text-emerald-600 font-semibold";
  if (taxa <= media * 0.85) return "text-destructive";
  return "";
}

export function CoorteNutricaoPanel({ fluxos, inscricoes, eventos, loading }: Props) {
  const [granularidade, setGranularidade] = useState<Granularidade>("mes");
  const [fluxoFiltro, setFluxoFiltro] = useState("todos");
  const [periodos, setPeriodos] = useState("12");

  const linhas: LinhaCoorte[] = useMemo(() => {
    const inscFiltradas = inscricoes.filter(
      (i) => (fluxoFiltro === "todos" || i.fluxo_id === fluxoFiltro) && i.created_at,
    );

    const eventosPorInscricao = new Map<string, NutricaoEvento[]>();
    eventos.forEach((ev) => {
      const chave = ev.inscricao_id;
      if (!chave) return;
      const arr = eventosPorInscricao.get(chave) ?? [];
      arr.push(ev);
      eventosPorInscricao.set(chave, arr);
    });
    // fallback por lead + fluxo quando o evento não tem inscrição vinculada
    const porLeadFluxo = new Map<string, NutricaoEvento[]>();
    eventos.forEach((ev) => {
      if (ev.inscricao_id || !ev.lead_id) return;
      const k = `${ev.lead_id}|${ev.fluxo_id}`;
      const arr = porLeadFluxo.get(k) ?? [];
      arr.push(ev);
      porLeadFluxo.set(k, arr);
    });

    const grupos = new Map<string, { inicio: Date; itens: NutricaoInscricao[] }>();
    inscFiltradas.forEach((i) => {
      const d = new Date(i.created_at as string);
      const inicio = granularidade === "mes" ? inicioMes(d) : inicioSemana(d);
      const chave = inicio.toISOString().slice(0, 10);
      const g = grupos.get(chave) ?? { inicio, itens: [] };
      g.itens.push(i);
      grupos.set(chave, g);
    });

    const resultado = Array.from(grupos.entries()).map(([chave, { inicio, itens }]) => {
      let respostas = 0;
      let agendamentos = 0;
      let fechamentos = 0;
      let valorFechado = 0;
      const diasAteFechar: number[] = [];

      itens.forEach((i) => {
        const evs = [
          ...(eventosPorInscricao.get(i.id) ?? []),
          ...(i.lead_id ? porLeadFluxo.get(`${i.lead_id}|${i.fluxo_id}`) ?? [] : []),
        ];
        const tem = (t: string) => evs.some((e) => e.tipo === t);
        if (tem("resposta")) respostas += 1;
        if (tem("agendamento")) agendamentos += 1;
        const fech = evs.filter((e) => e.tipo === "fechamento");
        if (fech.length > 0) {
          fechamentos += 1;
          valorFechado += fech.reduce((s, e) => s + Number(e.valor ?? 0), 0);
          const primeiro = fech
            .map((e) => new Date(e.ocorrido_em).getTime())
            .sort((a, b) => a - b)[0];
          const base = new Date(i.created_at as string).getTime();
          if (primeiro >= base) diasAteFechar.push((primeiro - base) / 86400000);
        }
      });

      const inscritos = itens.length;
      return {
        chave,
        label: rotulo(inicio, granularidade),
        inicio,
        inscritos,
        respostas,
        agendamentos,
        fechamentos,
        valorFechado,
        taxaResposta: pct(respostas, inscritos),
        taxaAgendamento: pct(agendamentos, inscritos),
        taxaFechamento: pct(fechamentos, inscritos),
        diasMedioFechamento: diasAteFechar.length
          ? diasAteFechar.reduce((s, v) => s + v, 0) / diasAteFechar.length
          : null,
      } as LinhaCoorte;
    });

    return resultado
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
      .slice(-Number(periodos));
  }, [inscricoes, eventos, fluxoFiltro, granularidade, periodos]);

  const totais = useMemo(() => {
    const inscritos = linhas.reduce((s, l) => s + l.inscritos, 0);
    const fechamentos = linhas.reduce((s, l) => s + l.fechamentos, 0);
    const valor = linhas.reduce((s, l) => s + l.valorFechado, 0);
    const taxaMedia = pct(fechamentos, inscritos);
    const ultima = linhas.at(-1);
    const anterior = linhas.at(-2);
    const variacao =
      ultima && anterior ? ultima.taxaFechamento - anterior.taxaFechamento : null;
    return { inscritos, fechamentos, valor, taxaMedia, variacao };
  }, [linhas]);

  const exportarCsv = () => {
    const head = [
      "Coorte",
      "Inscritos",
      "Respostas",
      "Agendamentos",
      "Fechamentos",
      "Taxa resposta %",
      "Taxa agendamento %",
      "Taxa fechamento %",
      "Dias medio ate fechar",
      "Valor fechado",
    ];
    const linhasCsv = linhas.map((l) => [
      l.label,
      l.inscritos,
      l.respostas,
      l.agendamentos,
      l.fechamentos,
      l.taxaResposta.toFixed(1),
      l.taxaAgendamento.toFixed(1),
      l.taxaFechamento.toFixed(1),
      l.diasMedioFechamento?.toFixed(1) ?? "",
      l.valorFechado.toFixed(2),
    ]);
    const csv = [head, ...linhasCsv].map((r) => r.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `coorte-nutricao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={granularidade} onValueChange={(v) => setGranularidade(v as Granularidade)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Por mês</SelectItem>
            <SelectItem value="semana">Por semana</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fluxoFiltro} onValueChange={setFluxoFiltro}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Todos os fluxos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os fluxos</SelectItem>
            {fluxos.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodos} onValueChange={setPeriodos}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="6">Últimos 6</SelectItem>
            <SelectItem value="12">Últimos 12</SelectItem>
            <SelectItem value="24">Últimos 24</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportarCsv} disabled={linhas.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Inscritos nas coortes</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold">{totais.inscritos}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Fechamentos</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold">{totais.fechamentos}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Taxa média de fechamento</CardDescription></CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-bold">
            {fmtPct(totais.taxaMedia)}
            {totais.variacao !== null && (
              <Badge variant="outline" className="gap-1 text-xs">
                {totais.variacao >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                {totais.variacao >= 0 ? "+" : ""}
                {totais.variacao.toFixed(1)} p.p.
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Valor fechado</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold">{moeda(totais.valor)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução por coorte de entrada</CardTitle>
          <CardDescription>
            Cada coorte agrupa os leads pela data em que entraram no fluxo, comparando quantos fecharam.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && linhas.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem inscrições no período selecionado.</p>
          )}
          {!loading && linhas.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={linhas}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis yAxisId="left" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" unit="%" fontSize={12} />
                <Tooltip
                  formatter={(valor: number, nome: string) =>
                    nome.includes("Taxa") ? fmtPct(Number(valor)) : valor
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="inscritos" name="Inscritos" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="fechamentos" name="Fechamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="taxaFechamento" name="Taxa de fechamento" stroke="hsl(var(--destructive))" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhe das coortes</CardTitle>
          <CardDescription>Taxas destacadas comparam cada coorte com a média do período.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coorte</TableHead>
                <TableHead className="text-right">Inscritos</TableHead>
                <TableHead className="text-right">Respostas</TableHead>
                <TableHead className="text-right">Agendamentos</TableHead>
                <TableHead className="text-right">Fechamentos</TableHead>
                <TableHead className="text-right">Taxa fechamento</TableHead>
                <TableHead className="text-right">Dias até fechar</TableHead>
                <TableHead className="text-right">Valor fechado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.chave}>
                  <TableCell className="font-medium">{l.label}</TableCell>
                  <TableCell className="text-right">{l.inscritos}</TableCell>
                  <TableCell className="text-right">
                    {l.respostas} <span className="text-xs text-muted-foreground">({fmtPct(l.taxaResposta)})</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.agendamentos} <span className="text-xs text-muted-foreground">({fmtPct(l.taxaAgendamento)})</span>
                  </TableCell>
                  <TableCell className="text-right">{l.fechamentos}</TableCell>
                  <TableCell className={`text-right ${corTaxa(l.taxaFechamento, totais.taxaMedia)}`}>
                    {fmtPct(l.taxaFechamento)}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.diasMedioFechamento !== null ? `${l.diasMedioFechamento.toFixed(0)} d` : "—"}
                  </TableCell>
                  <TableCell className="text-right">{moeda(l.valorFechado)}</TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    Nenhuma coorte no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
