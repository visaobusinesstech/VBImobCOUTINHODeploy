import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";

import { CheckCircle2, Circle, Clock, AlertTriangle, History, CalendarClock, Loader2, FileDown, FileSpreadsheet, Pause, Play, RotateCcw, Search, X } from "lucide-react";
import {
  exportarHistoricoCondominioCsv,
  gerarHistoricoCondominioPdfPreview,
  montarTextoMarcaDagua,
} from "@/lib/exportHistoricoCondominio";

import { EventoNotasBlock, type NotaEvento } from "@/components/qcapture/EventoNotasBlock";
import { AnexosPreviewPanel } from "@/components/qcapture/AnexosPreviewPanel";




type EtapaDef = { id: string; titulo: string; descricao: string };

type Prospeccao = {
  id: string;
  condominio_nome: string;
  bairro: string | null;
  status: string;
  progresso: number | null;
  etapas_concluidas: string[] | null;
  updated_at: string;
  created_at: string;
};

type LogRow = {
  id: string;
  tipo: string;
  etapa: string | null;
  nota: string | null;
  created_at: string;
};

type AgendamentoRow = {
  id: string;
  etapa: string;
  status: string;
  agendado_para: string;
  tentativa_num: number;
  max_tentativas: number;
  concluido_em: string | null;
  motivo_pausa: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospeccao: Prospeccao | null;
  etapas: EtapaDef[];
}

const statusColor: Record<string, string> = {
  pendente: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  concluida: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  concluido: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  pausada: "bg-slate-500/15 text-slate-700 border-slate-500/40",
  pausado: "bg-slate-500/15 text-slate-700 border-slate-500/40",
  cancelada: "bg-red-500/15 text-red-700 border-red-500/40",
};

export function HistoricoCondominioDialog({ open, onOpenChange, prospeccao, etapas }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [ags, setAgs] = useState<AgendamentoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [acaoEtapa, setAcaoEtapa] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState<string>("todas");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [notas, setNotas] = useState<NotaEvento[]>([]);
  const [previewPdf, setPreviewPdf] = useState<{ url: string; filename: string; marcaDagua: string } | null>(null);

  useEffect(() => {
    return () => {
      if (previewPdf) URL.revokeObjectURL(previewPdf.url);
    };
  }, [previewPdf]);


  const carregarNotas = async (prospeccaoId: string) => {
    const { data } = await supabase
      .from("condominio_historico_notas")
      .select("id,historico_id,autor_id,autor_nome,visibilidade,texto,anexo_path,anexo_nome,anexo_tipo,anexo_tamanho,created_at,updated_at")
      .eq("prospeccao_id", prospeccaoId)
      .order("created_at", { ascending: true });
    setNotas((data as NotaEvento[]) ?? []);
  };

  const carregar = async (prospeccaoId: string) => {
    const [l, a] = await Promise.all([
      supabase
        .from("condominio_prospeccao_historico")
        .select("id,tipo,etapa,nota,created_at")
        .eq("prospeccao_id", prospeccaoId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("condominio_prospeccao_agendamentos")
        .select("id,etapa,status,agendado_para,tentativa_num,max_tentativas,concluido_em,motivo_pausa")
        .eq("prospeccao_id", prospeccaoId)
        .order("agendado_para", { ascending: false })
        .limit(100),
      carregarNotas(prospeccaoId),
    ]);
    return {
      logs: (l.data as LogRow[]) ?? [],
      ags: (a.data as AgendamentoRow[]) ?? [],
    };
  };

  useEffect(() => {
    if (!open || !prospeccao) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const r = await carregar(prospeccao.id);
      if (cancel) return;
      setLogs(r.logs);
      setAgs(r.ags);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [open, prospeccao?.id]);


  const registrarHistorico = async (etapaId: string, tipo: string, nota: string) => {
    if (!prospeccao || !user) return;
    await supabase.from("condominio_prospeccao_historico").insert({
      prospeccao_id: prospeccao.id,
      imobiliaria_id: user.id,
      tipo,
      etapa: etapaId,
      nota,
    } as any);
  };

  const recarregar = async () => {
    if (!prospeccao) return;
    const r = await carregar(prospeccao.id);
    setLogs(r.logs);
    setAgs(r.ags);
  };

  const executarAcao = async (
    etapaId: string,
    acao: "pausar" | "retomar" | "reagendar",
    agendamento?: AgendamentoRow
  ) => {
    if (!prospeccao || !user) return;
    setAcaoEtapa(etapaId);
    try {
      const etapaLabel = etapas.find((e) => e.id === etapaId)?.titulo ?? etapaId;

      if (acao === "pausar") {
        const dias = Number(window.prompt("Pausar esta etapa por quantos dias?", "7") || 0);
        if (!dias || dias <= 0 || !agendamento) return;
        const motivo = `Pausa manual por ${dias} dia(s)`;
        const { error } = await supabase
          .from("condominio_prospeccao_agendamentos")
          .update({
            status: "pausada",
            pausado_ate: addDays(new Date(), dias).toISOString(),
            motivo_pausa: motivo,
          } as any)
          .eq("id", agendamento.id);
        if (error) throw error;
        await registrarHistorico(etapaId, "etapa_pausada", `${etapaLabel}: ${motivo}`);
        toast({ title: `Etapa pausada por ${dias} dia(s)` });
      }

      if (acao === "retomar") {
        if (!agendamento) return;
        const { error } = await supabase
          .from("condominio_prospeccao_agendamentos")
          .update({ status: "pendente", pausado_ate: null, motivo_pausa: null } as any)
          .eq("id", agendamento.id);
        if (error) throw error;
        await registrarHistorico(etapaId, "etapa_retomada", `${etapaLabel}: prospecção retomada manualmente`);
        toast({ title: "Etapa retomada" });
      }

      if (acao === "reagendar") {
        const dias = Number(window.prompt("Reagendar para daqui a quantos dias?", "3") || 0);
        if (!dias || dias <= 0) return;
        const novaData = addDays(new Date(), dias).toISOString();
        if (agendamento) {
          const { error } = await supabase
            .from("condominio_prospeccao_agendamentos")
            .update({
              status: "pendente",
              agendado_para: novaData,
              pausado_ate: null,
              motivo_pausa: null,
            } as any)
            .eq("id", agendamento.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("condominio_prospeccao_agendamentos").insert({
            imobiliaria_id: user.id,
            prospeccao_id: prospeccao.id,
            etapa: etapaId,
            agendado_para: novaData,
            tentativa_num: 1,
            max_tentativas: 3,
            intervalo_dias: dias,
          } as any);
          if (error) throw error;
        }
        await registrarHistorico(
          etapaId,
          "etapa_reagendada",
          `${etapaLabel}: reagendada para ${new Date(novaData).toLocaleString("pt-BR")}`
        );
        toast({ title: "Etapa reagendada" });
      }

      await recarregar();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setAcaoEtapa(null);
    }
  };


  if (!prospeccao) return null;

  const concluidas = new Set(prospeccao.etapas_concluidas ?? []);
  const agsPorEtapa = ags.reduce<Record<string, AgendamentoRow[]>>((acc, a) => {
    (acc[a.etapa] ||= []).push(a);
    return acc;
  }, {});
  const ultimaAcaoPorEtapa = logs.reduce<Record<string, LogRow>>((acc, l) => {
    if (l.etapa && !acc[l.etapa]) acc[l.etapa] = l;
    return acc;
  }, {});

  const prog = prospeccao.progresso ?? Math.round((concluidas.size / etapas.length) * 100);

  const termo = busca.trim().toLowerCase();
  const deTs = dataDe ? new Date(`${dataDe}T00:00:00`).getTime() : null;
  const ateTs = dataAte ? new Date(`${dataAte}T23:59:59`).getTime() : null;
  const logsFiltrados = logs.filter((l) => {
    if (filtroEtapa !== "todas") {
      if (filtroEtapa === "sem_etapa" ? !!l.etapa : l.etapa !== filtroEtapa) return false;
    }
    const ts = new Date(l.created_at).getTime();
    if (deTs !== null && ts < deTs) return false;
    if (ateTs !== null && ts > ateTs) return false;
    if (termo) {
      const etapaLabel = l.etapa ? etapas.find((e) => e.id === l.etapa)?.titulo ?? l.etapa : "";
      const alvo = `${l.tipo} ${l.nota ?? ""} ${etapaLabel}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
  const filtrosAtivos = !!termo || filtroEtapa !== "todas" || !!dataDe || !!dataAte;
  const limparFiltros = () => {
    setBusca("");
    setFiltroEtapa("todas");
    setDataDe("");
    setDataAte("");
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            {prospeccao.condominio_nome}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {prospeccao.bairro && <span>{prospeccao.bairro}</span>}
            <Badge variant="secondary" className="text-[10px]">{prog}% concluído</Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{prospeccao.status.replace("_", " ")}</Badge>
            <span className="text-xs text-muted-foreground">
              Iniciado {new Date(prospeccao.created_at).toLocaleDateString("pt-BR")}
              {" • "}
              atualizado {new Date(prospeccao.updated_at).toLocaleDateString("pt-BR")}
            </span>
          </DialogDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() =>
                exportarHistoricoCondominioCsv({
                  prospeccao,
                  etapas,
                  logs: logsFiltrados,
                  agendamentos: ags,
                  notas,
                  currentUserId: user?.id ?? null,
                })
              }
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                if (previewPdf) URL.revokeObjectURL(previewPdf.url);
                const exportInput = {
                  prospeccao,
                  etapas,
                  logs: logsFiltrados,
                  agendamentos: ags,
                  notas,
                  currentUserId: user?.id ?? null,
                  usuarioNome:
                    (user?.user_metadata as any)?.nome ||
                    (user?.user_metadata as any)?.full_name ||
                    user?.email ||
                    null,
                };
                const { url, filename } = gerarHistoricoCondominioPdfPreview(exportInput);

                setPreviewPdf({ url, filename, marcaDagua: montarTextoMarcaDagua(exportInput) });
              }}

            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" /> Pré-visualizar PDF
            </Button>
          </div>
        </DialogHeader>


        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4">
            <section>
              <h4 className="text-sm font-semibold mb-2">Status por etapa</h4>
              <div className="space-y-2">
                {etapas.map((et) => {
                  const done = concluidas.has(et.id);
                  const ultima = ultimaAcaoPorEtapa[et.id];
                  const agsEt = agsPorEtapa[et.id] ?? [];
                  const proximo = agsEt.find((a) => a.status === "pendente");
                  const pausado = agsEt.find((a) => a.status === "pausada" || a.status === "pausado");
                  return (
                    <div key={et.id} className="rounded-md border p-3">
                      <div className="flex items-start gap-2">
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" />
                        ) : proximo ? (
                          <Clock className="w-4 h-4 mt-0.5 text-amber-600" />
                        ) : pausado ? (
                          <AlertTriangle className="w-4 h-4 mt-0.5 text-slate-500" />
                        ) : (
                          <Circle className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{et.titulo}</p>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                done
                                  ? statusColor.concluida
                                  : proximo
                                  ? statusColor.pendente
                                  : pausado
                                  ? statusColor.pausada
                                  : ""
                              }`}
                            >
                              {done ? "Concluída" : proximo ? "Agendada" : pausado ? "Pausada" : "Não iniciada"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{et.descricao}</p>
                          <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                            {ultima && (
                              <span>
                                Última ação: <strong className="text-foreground">{ultima.tipo}</strong>{" "}
                                em {new Date(ultima.created_at).toLocaleString("pt-BR")}
                                {ultima.nota ? ` — ${ultima.nota}` : ""}
                              </span>
                            )}
                            {proximo && (
                              <span className="flex items-center gap-1">
                                <CalendarClock className="w-3 h-3" /> Próxima tentativa{" "}
                                {new Date(proximo.agendado_para).toLocaleString("pt-BR")}{" "}
                                (tentativa {proximo.tentativa_num}/{proximo.max_tentativas})
                              </span>
                            )}
                            {pausado?.motivo_pausa && (
                              <span>Motivo da pausa: {pausado.motivo_pausa}</span>
                            )}
                            {!ultima && !proximo && !pausado && !done && (
                              <span>Nenhuma atividade registrada ainda.</span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {proximo && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                disabled={acaoEtapa === et.id}
                                onClick={() => executarAcao(et.id, "pausar", proximo)}
                              >
                                <Pause className="w-3 h-3 mr-1" /> Pausar
                              </Button>
                            )}
                            {pausado && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                disabled={acaoEtapa === et.id}
                                onClick={() => executarAcao(et.id, "retomar", pausado)}
                              >
                                <Play className="w-3 h-3 mr-1" /> Retomar
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              disabled={acaoEtapa === et.id}
                              onClick={() => executarAcao(et.id, "reagendar", proximo ?? pausado)}
                            >
                              {acaoEtapa === et.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3 mr-1" />
                              )}
                              {proximo || pausado ? "Reagendar" : "Agendar"}
                            </Button>
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <Separator />

            <section>
              <h4 className="text-sm font-semibold mb-2">
                Linha do tempo{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({logsFiltrados.length}
                  {filtrosAtivos ? ` de ${logs.length}` : ""} evento{logsFiltrados.length === 1 ? "" : "s"})
                </span>
              </h4>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-3">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar evento ou observação"
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Etapa / canal" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="todas">Todas as etapas</SelectItem>
                    {etapas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.titulo}
                      </SelectItem>
                    ))}
                    <SelectItem value="sem_etapa">Sem etapa</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={dataDe}
                  onChange={(e) => setDataDe(e.target.value)}
                  className="h-9 text-xs"
                  aria-label="Data inicial"
                />
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dataAte}
                    onChange={(e) => setDataAte(e.target.value)}
                    className="h-9 text-xs"
                    aria-label="Data final"
                  />
                  {filtrosAtivos && (
                    <Button type="button" variant="ghost" size="sm" className="h-9 px-2" onClick={limparFiltros}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
                </div>
              ) : logs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
              ) : logsFiltrados.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento corresponde aos filtros aplicados.</p>
              ) : (
                <ol className="relative border-l pl-4 space-y-3">
                  {logsFiltrados.map((l) => (

                    <li key={l.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                      <div className="text-xs">
                        <span className="font-medium capitalize">{l.tipo.replace(/_/g, " ")}</span>
                        {l.etapa && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {etapas.find((e) => e.id === l.etapa)?.titulo ?? l.etapa}
                          </Badge>
                        )}
                        <span className="ml-2 text-muted-foreground">
                          {new Date(l.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {l.nota && <p className="text-xs text-muted-foreground mt-0.5">{l.nota}</p>}
                      <EventoNotasBlock
                        historicoId={l.id}
                        prospeccaoId={prospeccao.id}
                        etapa={l.etapa}
                        notas={notas.filter((n) => n.historico_id === l.id)}
                        onChanged={() => recarregar()}
                      />
                    </li>

                  ))}
                </ol>
              )}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>

      <Dialog open={!!previewPdf} onOpenChange={(v) => { if (!v) setPreviewPdf(null); }}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pré-visualização do PDF</DialogTitle>
            <DialogDescription>
              Confira o status por etapa, a linha do tempo e a seção Notas e anexos antes de baixar.
            </DialogDescription>
          </DialogHeader>
          {previewPdf && (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">Marca d'água</Badge>
                <span className="truncate">{previewPdf.marcaDagua}</span>
                <span className="text-[11px]">— aplicada em todas as páginas do PDF</span>
              </div>
              <div className="flex flex-1 min-h-0 flex-col gap-3 lg:flex-row">

                <iframe
                  src={previewPdf.url}
                  title="Pré-visualização do histórico em PDF"
                  className="min-h-[40vh] flex-1 w-full rounded-md border bg-muted"
                />
                <ScrollArea className="lg:w-72 lg:shrink-0 max-h-[35vh] lg:max-h-none pr-2">
                  <AnexosPreviewPanel notas={notas} currentUserId={user?.id ?? null} />
                </ScrollArea>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPreviewPdf(null)}>
                  Fechar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = previewPdf.url;
                    a.download = previewPdf.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                >
                  <FileDown className="w-3.5 h-3.5 mr-1.5" /> Baixar PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
