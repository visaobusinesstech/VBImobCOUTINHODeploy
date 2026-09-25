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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Mail, MessageCircle, Trophy } from "lucide-react";
import type { NutricaoEnvio, NutricaoEtapa, NutricaoFluxo } from "@/hooks/useNutricao";
import type { NutricaoEvento } from "@/hooks/useNutricaoMetricas";

interface Props {
  fluxos: NutricaoFluxo[];
  etapas: NutricaoEtapa[];
  envios: NutricaoEnvio[];
  eventos: NutricaoEvento[];
  loading?: boolean;
}

interface Agregado {
  chave: string;
  label: string;
  sublabel?: string;
  canal?: string;
  variante?: string;
  enviados: number;
  aberturas: number;
  cliques: number;
  respostas: number;
  agendamentos: number;
  fechamentos: number;
  valorFechado: number;
  taxaResposta: number;
  taxaAgendamento: number;
  taxaFechamento: number;
}

const pct = (p: number, t: number) => (t > 0 ? (p / t) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const canalLabel = (c?: string | null) =>
  c === "email" ? "E-mail" : c === "whatsapp" ? "WhatsApp" : c || "Outro";

function agregar(
  grupos: Map<string, { label: string; sublabel?: string; canal?: string; variante?: string; envios: NutricaoEnvio[] }>,
  eventosPorEnvio: Map<string, NutricaoEvento[]>,
): Agregado[] {
  return Array.from(grupos.entries()).map(([chave, g]) => {
    const enviados = g.envios.filter((e) => e.status === "enviado").length || g.envios.length;
    let aberturas = 0, cliques = 0, respostas = 0, agendamentos = 0, fechamentos = 0, valorFechado = 0;
    g.envios.forEach((env) => {
      const evs = eventosPorEnvio.get(env.id) ?? [];
      const tem = (t: string) => evs.some((e) => e.tipo === t);
      if (tem("abertura")) aberturas += 1;
      if (tem("clique")) cliques += 1;
      if (tem("resposta")) respostas += 1;
      if (tem("agendamento")) agendamentos += 1;
      const fech = evs.filter((e) => e.tipo === "fechamento");
      if (fech.length) {
        fechamentos += 1;
        valorFechado += fech.reduce((s, e) => s + Number(e.valor ?? 0), 0);
      }
    });
    return {
      chave,
      label: g.label,
      sublabel: g.sublabel,
      canal: g.canal,
      variante: g.variante,
      enviados,
      aberturas,
      cliques,
      respostas,
      agendamentos,
      fechamentos,
      valorFechado,
      taxaResposta: pct(respostas, enviados),
      taxaAgendamento: pct(agendamentos, enviados),
      taxaFechamento: pct(fechamentos, enviados),
    };
  });
}

function CardComparativo({ item, melhor }: { item: Agregado; melhor: boolean }) {
  const Icon = item.canal === "email" ? Mail : MessageCircle;
  return (
    <Card className={melhor ? "border-primary" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{item.label}</CardTitle>
          {melhor && (
            <Badge className="ml-auto gap-1"><Trophy className="h-3 w-3" /> Melhor</Badge>
          )}
        </div>
        {item.sublabel && <CardDescription>{item.sublabel}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Enviadas</span><span className="font-medium">{item.enviados}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Respostas</span><span className="font-medium">{item.respostas} ({fmtPct(item.taxaResposta)})</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Agendamentos</span><span className="font-medium">{item.agendamentos} ({fmtPct(item.taxaAgendamento)})</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Fechamentos</span><span className="font-medium">{item.fechamentos} ({fmtPct(item.taxaFechamento)})</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Valor fechado</span><span className="font-medium">{moeda(item.valorFechado)}</span></div>
      </CardContent>
    </Card>
  );
}

export function ComparativoCanalVariantePanel({ fluxos, etapas, envios, eventos, loading }: Props) {
  const [fluxoFiltro, setFluxoFiltro] = useState("todos");
  const [metrica, setMetrica] = useState<"taxaAgendamento" | "taxaFechamento" | "taxaResposta">("taxaFechamento");

  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const inscricoesDoFluxo = useMemo(() => new Map(etapas.map((e) => [e.id, e.fluxo_id])), [etapas]);

  const enviosFiltrados = useMemo(
    () =>
      envios.filter((e) =>
        fluxoFiltro === "todos"
          ? true
          : e.etapa_id
            ? inscricoesDoFluxo.get(e.etapa_id) === fluxoFiltro
            : false,
      ),
    [envios, fluxoFiltro, inscricoesDoFluxo],
  );

  const eventosPorEnvio = useMemo(() => {
    const m = new Map<string, NutricaoEvento[]>();
    eventos.forEach((ev) => {
      if (!ev.envio_id) return;
      const arr = m.get(ev.envio_id) ?? [];
      arr.push(ev);
      m.set(ev.envio_id, arr);
    });
    return m;
  }, [eventos]);

  const porCanal = useMemo(() => {
    const grupos = new Map<string, { label: string; canal: string; envios: NutricaoEnvio[] }>();
    enviosFiltrados.forEach((e) => {
      const canal = e.canal || "outro";
      const g = grupos.get(canal) ?? { label: canalLabel(canal), canal, envios: [] };
      g.envios.push(e);
      grupos.set(canal, g);
    });
    return agregar(grupos, eventosPorEnvio).sort((a, b) => b[metrica] - a[metrica]);
  }, [enviosFiltrados, eventosPorEnvio, metrica]);

  const porVersao = useMemo(() => {
    const grupos = new Map<
      string,
      { label: string; sublabel?: string; canal?: string; variante?: string; envios: NutricaoEnvio[] }
    >();
    enviosFiltrados.forEach((e) => {
      if (!e.etapa_id) return;
      const etapa = etapaPorId.get(e.etapa_id);
      const variante = (e.variante || "A").toUpperCase();
      const chave = `${e.etapa_id}|${variante}`;
      const fluxoNome = fluxos.find((f) => f.id === etapa?.fluxo_id)?.nome ?? "Fluxo";
      const g = grupos.get(chave) ?? {
        label: `${etapa ? `Etapa ${etapa.ordem} · ${etapa.titulo}` : "Etapa"} — versão ${variante}`,
        sublabel: `${fluxoNome} · ${canalLabel(e.canal)}`,
        canal: e.canal,
        variante,
        envios: [],
      };
      g.envios.push(e);
      grupos.set(chave, g);
    });
    return agregar(grupos, eventosPorEnvio).sort((a, b) => b[metrica] - a[metrica]);
  }, [enviosFiltrados, eventosPorEnvio, etapaPorId, fluxos, metrica]);

  const paresVariante = useMemo(() => {
    const m = new Map<string, Agregado[]>();
    porVersao.forEach((v) => {
      const base = v.chave.split("|")[0];
      const arr = m.get(base) ?? [];
      arr.push(v);
      m.set(base, arr);
    });
    return Array.from(m.values())
      .filter((arr) => arr.length > 1)
      .map((arr) => arr.sort((a, b) => (a.variante ?? "").localeCompare(b.variante ?? "")));
  }, [porVersao]);

  const grafico = useMemo(
    () =>
      porVersao.slice(0, 10).map((v) => ({
        nome: `${v.variante} · ${v.label.split("—")[0].trim().slice(0, 22)}`,
        Agendamento: Number(v.taxaAgendamento.toFixed(1)),
        Fechamento: Number(v.taxaFechamento.toFixed(1)),
        Resposta: Number(v.taxaResposta.toFixed(1)),
      })),
    [porVersao],
  );

  const exportarCsv = () => {
    const head = ["Grupo", "Tipo", "Canal", "Versao", "Enviadas", "Respostas", "Agendamentos", "Fechamentos", "Taxa agendamento %", "Taxa fechamento %", "Valor fechado"];
    const linhas = [
      ...porCanal.map((c) => ["Canal: " + c.label, "canal", c.label, "", c.enviados, c.respostas, c.agendamentos, c.fechamentos, c.taxaAgendamento.toFixed(1), c.taxaFechamento.toFixed(1), c.valorFechado.toFixed(2)]),
      ...porVersao.map((v) => [v.label, "versao", canalLabel(v.canal), v.variante ?? "", v.enviados, v.respostas, v.agendamentos, v.fechamentos, v.taxaAgendamento.toFixed(1), v.taxaFechamento.toFixed(1), v.valorFechado.toFixed(2)]),
    ];
    const csv = [head, ...linhas].map((r) => r.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparativo-canal-versao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const melhorCanal = porCanal[0]?.chave;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={fluxoFiltro} onValueChange={setFluxoFiltro}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Todos os fluxos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os fluxos</SelectItem>
            {fluxos.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={metrica} onValueChange={(v) => setMetrica(v as typeof metrica)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="taxaFechamento">Ordenar por fechamento</SelectItem>
            <SelectItem value="taxaAgendamento">Ordenar por agendamento</SelectItem>
            <SelectItem value="taxaResposta">Ordenar por resposta</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportarCsv} disabled={porCanal.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Comparação por canal</h3>
        {porCanal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem mensagens registradas para comparar.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {porCanal.map((c) => (
              <CardComparativo key={c.chave} item={c} melhor={c.chave === melhorCanal && porCanal.length > 1} />
            ))}
          </div>
        )}
      </div>

      {paresVariante.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Comparação lado a lado por versão de mensagem</h3>
          <div className="space-y-3">
            {paresVariante.map((par) => {
              const vencedor = [...par].sort((a, b) => b[metrica] - a[metrica])[0];
              return (
                <div key={par[0].chave} className="grid gap-3 md:grid-cols-2">
                  {par.map((v) => (
                    <CardComparativo key={v.chave} item={v} melhor={v.chave === vencedor.chave} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {grafico.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Agendamento × fechamento por versão</CardTitle>
            <CardDescription>Top 10 versões pela métrica selecionada.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="nome" fontSize={11} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis unit="%" fontSize={12} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Bar dataKey="Agendamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Fechamento" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhe por versão de mensagem</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Enviadas</TableHead>
                <TableHead className="text-right">Respostas</TableHead>
                <TableHead className="text-right">Agendamentos</TableHead>
                <TableHead className="text-right">Fechamentos</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porVersao.map((v) => (
                <TableRow key={v.chave}>
                  <TableCell className="font-medium">
                    {v.label}
                    {v.sublabel && <span className="block text-xs text-muted-foreground">{v.sublabel}</span>}
                  </TableCell>
                  <TableCell>{canalLabel(v.canal)}</TableCell>
                  <TableCell className="text-right">{v.enviados}</TableCell>
                  <TableCell className="text-right">{v.respostas} ({fmtPct(v.taxaResposta)})</TableCell>
                  <TableCell className="text-right">{v.agendamentos} ({fmtPct(v.taxaAgendamento)})</TableCell>
                  <TableCell className="text-right">{v.fechamentos} ({fmtPct(v.taxaFechamento)})</TableCell>
                  <TableCell className="text-right">{moeda(v.valorFechado)}</TableCell>
                </TableRow>
              ))}
              {porVersao.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhuma versão com mensagens registradas.
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
