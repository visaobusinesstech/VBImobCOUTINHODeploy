import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarCheck,
  CheckCircle2,
  Mail,
  MessageCircle,
  MousePointerClick,
  Reply,
  Search,
  Send,
  Trophy,
  Eye,
} from "lucide-react";
import type {
  NutricaoEnvio,
  NutricaoEtapa,
  NutricaoFluxo,
  NutricaoInscricao,
} from "@/hooks/useNutricao";
import type { NutricaoEvento, TipoEventoNutricao } from "@/hooks/useNutricaoMetricas";

interface Props {
  fluxos: NutricaoFluxo[];
  etapas: NutricaoEtapa[];
  inscricoes: NutricaoInscricao[];
  envios: NutricaoEnvio[];
  eventos: NutricaoEvento[];
  loading?: boolean;
}

type ItemTipo = "envio" | TipoEventoNutricao;

interface ItemLinha {
  id: string;
  tipo: ItemTipo;
  data: string;
  titulo: string;
  descricao?: string | null;
  canal?: string | null;
  fluxoNome: string;
  etapaLabel?: string | null;
  variante?: string | null;
  status?: string | null;
  valor?: number | null;
}

const CONFIG: Record<ItemTipo, { label: string; icon: typeof Send; classe: string }> = {
  envio: { label: "Enviada", icon: Send, classe: "bg-primary/10 text-primary border-primary/30" },
  abertura: { label: "Abertura", icon: Eye, classe: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
  clique: { label: "Clique", icon: MousePointerClick, classe: "bg-violet-500/10 text-violet-600 border-violet-500/30" },
  resposta: { label: "Resposta", icon: Reply, classe: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  agendamento: { label: "Agendamento", icon: CalendarCheck, classe: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  fechamento: { label: "Fechamento", icon: Trophy, classe: "bg-green-600/10 text-green-700 border-green-600/30" },
};

const ORDEM_ETAPA: ItemTipo[] = ["envio", "abertura", "clique", "resposta", "agendamento", "fechamento"];

function dataHora(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function TimelineLeadPanel({ fluxos, etapas, inscricoes, envios, eventos, loading }: Props) {
  const [busca, setBusca] = useState("");
  const [fluxoFiltro, setFluxoFiltro] = useState("todos");
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const fluxoPorId = useMemo(() => new Map(fluxos.map((f) => [f.id, f])), [fluxos]);
  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const inscricaoPorId = useMemo(() => new Map(inscricoes.map((i) => [i.id, i])), [inscricoes]);

  const enviosPorInscricao = useMemo(() => {
    const m = new Map<string, NutricaoEnvio[]>();
    envios.forEach((e) => {
      const arr = m.get(e.inscricao_id) ?? [];
      arr.push(e);
      m.set(e.inscricao_id, arr);
    });
    return m;
  }, [envios]);

  const eventosPorInscricao = useMemo(() => {
    const envioParaInscricao = new Map(envios.map((e) => [e.id, e.inscricao_id]));
    const m = new Map<string, NutricaoEvento[]>();
    eventos.forEach((ev) => {
      let insc: string | null = ev.inscricao_id ?? null;
      if (!insc && ev.envio_id) insc = envioParaInscricao.get(ev.envio_id) ?? null;
      if (!insc && ev.lead_id) {
        insc =
          inscricoes.find((i) => i.lead_id === ev.lead_id && i.fluxo_id === ev.fluxo_id)?.id ?? null;
      }
      if (!insc) return;
      const arr = m.get(insc) ?? [];
      arr.push(ev);
      m.set(insc, arr);
    });
    return m;
  }, [eventos, envios, inscricoes]);

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return inscricoes
      .filter((i) => (fluxoFiltro === "todos" ? true : i.fluxo_id === fluxoFiltro))
      .filter((i) => {
        if (!termo) return true;
        const alvo = `${i.nome ?? ""} ${i.email ?? ""} ${i.telefone ?? ""}`.toLowerCase();
        return alvo.includes(termo);
      })
      .map((i) => {
        const evs = eventosPorInscricao.get(i.id) ?? [];
        const envs = enviosPorInscricao.get(i.id) ?? [];
        const datas = [
          ...evs.map((e) => e.ocorrido_em),
          ...envs.map((e) => e.enviado_em ?? e.created_at),
        ].filter(Boolean) as string[];
        const ultima = datas.sort().at(-1) ?? i.proxima_execucao;
        return { inscricao: i, envios: envs.length, eventos: evs.length, ultima };
      })
      .sort((a, b) => (a.ultima < b.ultima ? 1 : -1));
  }, [inscricoes, fluxoFiltro, busca, eventosPorInscricao, enviosPorInscricao]);

  const inscricaoAtiva = selecionada
    ? inscricaoPorId.get(selecionada) ?? null
    : listaFiltrada[0]?.inscricao ?? null;

  const linha: ItemLinha[] = useMemo(() => {
    if (!inscricaoAtiva) return [];
    const fluxoNome = fluxoPorId.get(inscricaoAtiva.fluxo_id)?.nome ?? "Fluxo";
    const etapaLabel = (etapaId?: string | null) => {
      if (!etapaId) return null;
      const et = etapaPorId.get(etapaId);
      return et ? `Etapa ${et.ordem} · ${et.titulo}` : null;
    };

    const deEnvios: ItemLinha[] = (enviosPorInscricao.get(inscricaoAtiva.id) ?? []).map((e) => ({
      id: `envio-${e.id}`,
      tipo: "envio",
      data: e.enviado_em ?? e.created_at,
      titulo: e.titulo || "Mensagem enviada",
      descricao: e.mensagem,
      canal: e.canal,
      fluxoNome,
      etapaLabel: etapaLabel(e.etapa_id),
      variante: e.variante,
      status: e.status,
    }));

    const deEventos: ItemLinha[] = (eventosPorInscricao.get(inscricaoAtiva.id) ?? []).map((ev) => ({
      id: `evento-${ev.id}`,
      tipo: ev.tipo,
      data: ev.ocorrido_em,
      titulo: CONFIG[ev.tipo].label,
      descricao: ev.observacao,
      canal: ev.canal,
      fluxoNome: fluxoPorId.get(ev.fluxo_id)?.nome ?? fluxoNome,
      etapaLabel: etapaLabel(ev.etapa_id),
      valor: ev.valor,
    }));

    return [...deEnvios, ...deEventos].sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [inscricaoAtiva, enviosPorInscricao, eventosPorInscricao, fluxoPorId, etapaPorId]);

  const resumo = useMemo(() => {
    const c: Record<ItemTipo, number> = {
      envio: 0, abertura: 0, clique: 0, resposta: 0, agendamento: 0, fechamento: 0,
    };
    linha.forEach((i) => { c[i.tipo] += 1; });
    return c;
  }, [linha]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Leads em nutrição</CardTitle>
          <CardDescription>Escolha um lead para ver a linha do tempo completa.</CardDescription>
          <div className="space-y-2 pt-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone"
                className="pl-8"
              />
            </div>
            <Select value={fluxoFiltro} onValueChange={setFluxoFiltro}>
              <SelectTrigger><SelectValue placeholder="Todos os fluxos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os fluxos</SelectItem>
                {fluxos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[460px]">
            <div className="space-y-1 p-3 pt-0">
              {loading && <p className="p-2 text-sm text-muted-foreground">Carregando…</p>}
              {!loading && listaFiltrada.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">Nenhum lead encontrado.</p>
              )}
              {listaFiltrada.map(({ inscricao, envios: qtdEnvios, eventos: qtdEventos, ultima }) => (
                <Button
                  key={inscricao.id}
                  variant={inscricaoAtiva?.id === inscricao.id ? "secondary" : "ghost"}
                  className="h-auto w-full flex-col items-start gap-1 py-2 text-left"
                  onClick={() => setSelecionada(inscricao.id)}
                >
                  <span className="w-full truncate text-sm font-medium">
                    {inscricao.nome || inscricao.email || inscricao.telefone || "Lead sem nome"}
                  </span>
                  <span className="w-full truncate text-xs font-normal text-muted-foreground">
                    {fluxoPorId.get(inscricao.fluxo_id)?.nome ?? "Fluxo"} · {qtdEnvios} envios · {qtdEventos} eventos
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Última atividade: {dataHora(ultima)}
                  </span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {inscricaoAtiva
              ? inscricaoAtiva.nome || inscricaoAtiva.email || inscricaoAtiva.telefone || "Lead sem nome"
              : "Linha do tempo"}
          </CardTitle>
          <CardDescription>
            {inscricaoAtiva
              ? `${fluxoPorId.get(inscricaoAtiva.fluxo_id)?.nome ?? "Fluxo"} · etapa ${inscricaoAtiva.etapa_atual} · ${inscricaoAtiva.status}`
              : "Selecione um lead na lista ao lado."}
          </CardDescription>
          {inscricaoAtiva && (
            <div className="flex flex-wrap gap-2 pt-2">
              {ORDEM_ETAPA.map((t) => {
                const Icon = CONFIG[t].icon;
                return (
                  <Badge key={t} variant="outline" className={`gap-1 ${CONFIG[t].classe}`}>
                    <Icon className="h-3 w-3" />
                    {CONFIG[t].label}: {resumo[t]}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {inscricaoAtiva && linha.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ainda não há mensagens ou eventos registrados para este lead.
            </p>
          )}
          <ScrollArea className={linha.length > 0 ? "h-[520px] pr-3" : ""}>
            <ol className="relative space-y-4 border-l pl-6">
              {linha.map((item) => {
                const cfg = CONFIG[item.tipo];
                const Icon = cfg.icon;
                return (
                  <li key={item.id} className="relative">
                    <span
                      className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border ${cfg.classe}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="rounded-lg border bg-card p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cfg.classe}>{cfg.label}</Badge>
                        {item.canal && (
                          <Badge variant="secondary" className="gap-1">
                            {item.canal === "email" ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                            {item.canal === "email" ? "E-mail" : "WhatsApp"}
                          </Badge>
                        )}
                        {item.variante && <Badge variant="outline">Variante {item.variante}</Badge>}
                        {item.status && item.tipo === "envio" && (
                          <Badge variant={item.status === "enviado" ? "secondary" : item.status === "falha" ? "destructive" : "outline"}>
                            {item.status}
                          </Badge>
                        )}
                        {typeof item.valor === "number" && item.valor > 0 && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {moeda(item.valor)}
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">{dataHora(item.data)}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{item.titulo}</p>
                      {item.etapaLabel && (
                        <p className="text-xs text-muted-foreground">{item.etapaLabel}</p>
                      )}
                      {item.descricao && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground line-clamp-6">
                          {item.descricao}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
