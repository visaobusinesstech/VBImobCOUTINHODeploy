import { useMemo, useState } from "react";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNutricao } from "@/hooks/useNutricao";
import { useNutricaoMetricas, TIPOS_EVENTO, type TipoEventoNutricao } from "@/hooks/useNutricaoMetricas";
import { MetricasFluxosPanel } from "@/components/nutricao/MetricasFluxosPanel";
import { TesteABPanel } from "@/components/nutricao/TesteABPanel";
import { ComparativoCanalVariantePanel } from "@/components/nutricao/ComparativoCanalVariantePanel";
import { AlertasMetasPanel } from "@/components/nutricao/AlertasMetasPanel";
import { TimelineLeadPanel } from "@/components/nutricao/TimelineLeadPanel";
import { CoorteNutricaoPanel } from "@/components/nutricao/CoorteNutricaoPanel";
import { FluxoNutricaoDialog } from "@/components/nutricao/FluxoNutricaoDialog";
import { CATEGORIAS_MODELO, MODELOS_NUTRICAO, type ModeloNutricao } from "@/lib/nutricaoTemplates";
import { useToast } from "@/hooks/use-toast";
import { resumoSegmentacao } from "@/lib/nutricaoSegmentacao";
import { Filter } from "lucide-react";
import {
  Check,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";


const statusLabel: Record<string, string> = {
  ativa: "Em andamento",
  concluida: "Concluída",
  encerrada: "Encerrada",
};

function formatData(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function NutricaoLeads() {
  const {
    fluxos,
    etapas,
    inscricoes,
    envios,
    loading,
    processando,
    salvarFluxo,
    toggleFluxo,
    excluirFluxo,
    criarModelos,
    processarAgora,
    marcarEnvio,
    encerrarInscricao,
    aplicarVencedorAB,
    reabrirTesteAB,
  } = useNutricao();

  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<"todas" | ModeloNutricao["categoria"]>("todas");
  const [diasMetricas, setDiasMetricas] = useState(90);
  const { eventos, loading: loadingMetricas, registrarEvento } = useNutricaoMetricas(diasMetricas);

  const fluxoDoEnvio = (inscricaoId: string) =>
    inscricoes.find((i) => i.id === inscricaoId)?.fluxo_id ?? null;

  const marcarEvento = async (
    envio: { id: string; inscricao_id: string; lead_id: string | null; etapa_id: string | null; canal: string },
    tipo: TipoEventoNutricao,
  ) => {
    const fluxoId = fluxoDoEnvio(envio.inscricao_id);
    if (!fluxoId) {
      toast({ title: "Fluxo não encontrado para esta mensagem", variant: "destructive" });
      return;
    }
    let valor: number | null = null;
    if (tipo === "fechamento") {
      const entrada = window.prompt("Valor do negócio fechado (opcional, em R$):", "");
      if (entrada) valor = Number(entrada.replace(/\./g, "").replace(",", ".")) || null;
    }
    const ok = await registrarEvento({
      fluxo_id: fluxoId,
      tipo,
      envio_id: envio.id,
      inscricao_id: envio.inscricao_id,
      etapa_id: envio.etapa_id,
      lead_id: envio.lead_id,
      canal: envio.canal,
      valor,
    });
    if (ok) toast({ title: "Evento registrado", description: tipo });
  };


  const modelosFiltrados = MODELOS_NUTRICAO.filter(
    (m) => categoria === "todas" || m.categoria === categoria,
  );
  const nomesExistentes = new Set(fluxos.map((f) => f.nome));

  const aplicarModelo = async (modelo: ModeloNutricao) => {
    setAplicando(modelo.id);
    const ok = await salvarFluxo(modelo.fluxo, modelo.etapas);
    setAplicando(null);
    if (ok) toast({ title: "Sugestão adicionada", description: `${modelo.fluxo.nome} está na aba Fluxos.` });
  };


  const fluxoEditando = fluxos.find((f) => f.id === editando) ?? null;
  const etapasDoFluxo = useMemo(
    () => etapas.filter((e) => e.fluxo_id === editando),
    [etapas, editando],
  );

  const inscricoesAtivas = inscricoes.filter((i) => i.status === "ativa");
  const enviosPendentes = envios.filter((e) => e.status === "pendente");
  const filtrados = envios.filter((e) =>
    !busca.trim() ||
    (e.titulo ?? "").toLowerCase().includes(busca.toLowerCase()) ||
    (e.destino ?? "").toLowerCase().includes(busca.toLowerCase()) ||
    e.mensagem.toLowerCase().includes(busca.toLowerCase()),
  );

  const abrirWhatsapp = (destino: string | null, mensagem: string) => {
    if (!destino) return;
    const fone = destino.replace(/\D/g, "");
    const numero = fone.length <= 11 ? `55${fone}` : fone;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank");
  };

  const abrirEmail = (destino: string | null, titulo: string | null, mensagem: string) => {
    if (!destino) return;
    window.open(
      `mailto:${destino}?subject=${encodeURIComponent(titulo ?? "Novidades")}&body=${encodeURIComponent(mensagem)}`,
      "_blank",
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Seo
        title="Nutrição e reengajamento de leads | radarimobtech"
        description="Fluxos automáticos de nutrição para reativar leads inativos, entregar conteúdo de valor e fortalecer o relacionamento."
        path="/nutricao"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => { setEditando(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo fluxo
        </Button>
        <Button variant="outline" onClick={processarAgora} disabled={processando}>
          {processando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Processar agora
        </Button>
        {fluxos.length === 0 && (
          <Button variant="secondary" onClick={criarModelos}>
            <Sparkles className="mr-2 h-4 w-4" /> Criar fluxos modelo
          </Button>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold">Nutrição e reengajamento</h1>
        <p className="text-sm text-muted-foreground">
          Sequências automáticas que reativam leads inativos e mantêm o relacionamento vivo nos momentos-chave.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Fluxos ativos</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold">{fluxos.filter((f) => f.ativo).length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Leads em nutrição</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold">{inscricoesAtivas.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Mensagens a enviar</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold">{enviosPendentes.length}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="fluxos">
        <TabsList className="flex-wrap">
          <TabsTrigger value="fluxos">Fluxos</TabsTrigger>
          <TabsTrigger value="sugestoes">Sugestões prontas</TabsTrigger>
          <TabsTrigger value="inscricoes">Leads em nutrição</TabsTrigger>
          <TabsTrigger value="envios">Mensagens</TabsTrigger>
          <TabsTrigger value="metricas">Métricas e relatórios</TabsTrigger>
          <TabsTrigger value="abtest">Teste A/B</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          <TabsTrigger value="coorte">Coortes</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          <TabsTrigger value="alertas">Metas e alertas</TabsTrigger>

        </TabsList>

        <TabsContent value="sugestoes" className="space-y-3 pt-4">
          <div className="flex flex-wrap gap-2">
            {(["todas", "jornada", "segmentado", "reativacao", "sem_resposta", "valor", "relacionamento"] as const).map((c) => (
              <Button
                key={c}
                size="sm"
                variant={categoria === c ? "default" : "outline"}
                onClick={() => setCategoria(c)}
              >
                {c === "todas" ? "Todas" : CATEGORIAS_MODELO[c]}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {modelosFiltrados.map((modelo) => {
              const jaExiste = nomesExistentes.has(modelo.fluxo.nome);
              return (
                <Card key={modelo.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{modelo.fluxo.nome}</CardTitle>
                    <CardDescription>{modelo.resumo}</CardDescription>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{CATEGORIAS_MODELO[modelo.categoria]}</Badge>
                      <Badge variant="outline">
                        {modelo.fluxo.publico_alvo === "lead_sem_resposta" ? "Sem resposta" : "Inativos"} ·{" "}
                        {modelo.fluxo.dias_inatividade} dias
                      </Badge>
                      <Badge variant="outline">{modelo.etapas.length} etapas</Badge>
                      {resumoSegmentacao(modelo.fluxo).map((t) => (
                        <Badge key={t} variant="outline" className="gap-1">
                          <Filter className="h-3 w-3" />{t}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {modelo.etapas.map((e) => (
                      <div key={e.ordem} className="rounded-md border p-2 text-sm">
                        <div className="flex items-center gap-2 font-medium">
                          {e.canal === "email" ? <Mail className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                          {e.ordem}. {e.titulo}
                          <span className="text-xs text-muted-foreground">+{e.dias_apos}d</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.mensagem}</p>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      className="mt-1"
                      disabled={aplicando === modelo.id || jaExiste}
                      onClick={() => aplicarModelo(modelo)}
                    >
                      {aplicando === modelo.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {jaExiste ? "Já adicionado" : "Usar esta sugestão"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>



        <TabsContent value="fluxos" className="space-y-3 pt-4">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && fluxos.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">
              Nenhum fluxo criado. Use "Criar fluxos modelo" para começar com sequências prontas de reativação.
            </CardContent></Card>
          )}
          {fluxos.map((fluxo) => {
            const etapasFluxo = etapas.filter((e) => e.fluxo_id === fluxo.id);
            const emNutricao = inscricoes.filter((i) => i.fluxo_id === fluxo.id && i.status === "ativa").length;
            return (
              <Card key={fluxo.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
                  <div>
                    <CardTitle className="text-base">{fluxo.nome}</CardTitle>
                    <CardDescription>{fluxo.descricao}</CardDescription>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {fluxo.publico_alvo === "lead_sem_resposta" ? "Sem resposta" : "Inativos"} · {fluxo.dias_inatividade} dias
                      </Badge>
                      <Badge variant="outline">{etapasFluxo.length} etapas</Badge>
                      <Badge variant="outline"><Users className="mr-1 h-3 w-3" />{emNutricao} em nutrição</Badge>
                      {fluxo.encerrar_ao_responder && <Badge variant="outline">Para ao responder</Badge>}
                      {resumoSegmentacao(fluxo).map((t) => (
                        <Badge key={t} variant="outline" className="gap-1">
                          <Filter className="h-3 w-3" />{t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={fluxo.ativo} onCheckedChange={(v) => toggleFluxo(fluxo.id, v)} />
                    <Button variant="ghost" size="icon" onClick={() => { setEditando(fluxo.id); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => excluirFluxo(fluxo.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {etapasFluxo.map((e) => (
                    <div key={e.id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        {e.canal === "email" ? <Mail className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                        {e.ordem}. {e.titulo}
                        <span className="text-xs text-muted-foreground">+{e.dias_apos}d</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.mensagem}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="inscricoes" className="space-y-2 pt-4">
          {inscricoes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum lead inscrito ainda. Clique em "Processar agora".</p>
          )}
          {inscricoes.map((i) => {
            const fluxo = fluxos.find((f) => f.id === i.fluxo_id);
            return (
              <Card key={i.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{i.nome ?? "Contato"}</p>
                    <p className="text-xs text-muted-foreground">
                      {fluxo?.nome} · etapa {i.etapa_atual} · próxima ação {formatData(i.proxima_execucao)}
                      {i.motivo_encerramento ? ` · ${i.motivo_encerramento}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={i.status === "ativa" ? "default" : "secondary"}>
                      {statusLabel[i.status] ?? i.status}
                    </Badge>
                    {i.status === "ativa" && (
                      <Button variant="outline" size="sm" onClick={() => encerrarInscricao(i.id)}>Encerrar</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="envios" className="space-y-2 pt-4">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, contato ou texto"
            className="max-w-sm"
          />
          {filtrados.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem gerada.</p>}
          {filtrados.map((e) => (
            <Card key={e.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium">
                    {e.canal === "email" ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                    {e.titulo ?? "Mensagem"}
                    <span className="text-xs text-muted-foreground">{e.destino ?? "sem contato"}</span>
                  </div>
                  <Badge variant={e.status === "enviado" ? "default" : e.status === "falha" ? "destructive" : "secondary"}>
                    {e.status}
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{e.mensagem}</p>
                {e.erro && <p className="text-xs text-destructive">{e.erro}</p>}
                <div className="flex flex-wrap gap-2">
                  {e.canal === "email" ? (
                    <Button size="sm" variant="outline" disabled={!e.destino}
                      onClick={() => abrirEmail(e.destino, e.titulo, e.mensagem)}>
                      <Mail className="mr-1 h-4 w-4" /> Abrir e-mail
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={!e.destino}
                      onClick={() => abrirWhatsapp(e.destino, e.mensagem)}>
                      <MessageCircle className="mr-1 h-4 w-4" /> Abrir WhatsApp
                    </Button>
                  )}
                  {e.status !== "enviado" && (
                    <Button size="sm" onClick={() => marcarEnvio(e.id, "enviado")}>
                      <Check className="mr-1 h-4 w-4" /> Marcar como enviada
                    </Button>
                  )}
                  <span className="self-center text-xs text-muted-foreground">{formatData(e.created_at)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 border-t pt-2">
                  <span className="mr-1 text-xs text-muted-foreground">Registrar:</span>
                  {TIPOS_EVENTO.map((t) => {
                    const jaTem = eventos.some((ev) => ev.envio_id === e.id && ev.tipo === t.tipo);
                    return (
                      <Button
                        key={t.tipo}
                        size="sm"
                        variant={jaTem ? "secondary" : "outline"}
                        disabled={jaTem}
                        onClick={() => marcarEvento(e, t.tipo)}
                      >
                        {jaTem && <Check className="mr-1 h-3 w-3" />}
                        {t.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="metricas" className="pt-4">
          <MetricasFluxosPanel
            fluxos={fluxos}
            inscricoes={inscricoes}
            envios={envios}
            eventos={eventos}
            dias={diasMetricas}
            onDiasChange={setDiasMetricas}
            loading={loading || loadingMetricas}
          />
        </TabsContent>

        <TabsContent value="abtest" className="pt-4">
          <TesteABPanel
            fluxos={fluxos}
            etapas={etapas}
            envios={envios}
            eventos={eventos}
            onAplicarVencedor={aplicarVencedorAB}
            onReabrir={reabrirTesteAB}
          />
        </TabsContent>

        <TabsContent value="timeline" className="pt-4">
          <TimelineLeadPanel
            fluxos={fluxos}
            etapas={etapas}
            inscricoes={inscricoes}
            envios={envios}
            eventos={eventos}
            loading={loading || loadingMetricas}
          />
        </TabsContent>

        <TabsContent value="coorte" className="pt-4">
          <CoorteNutricaoPanel
            fluxos={fluxos}
            inscricoes={inscricoes}
            eventos={eventos}
            loading={loading || loadingMetricas}
          />
        </TabsContent>

        <TabsContent value="comparativo" className="pt-4">
          <ComparativoCanalVariantePanel
            fluxos={fluxos}
            etapas={etapas}
            envios={envios}
            eventos={eventos}
            loading={loading || loadingMetricas}
          />
        </TabsContent>

        <TabsContent value="alertas" className="pt-4">
          <AlertasMetasPanel fluxos={fluxos} />
        </TabsContent>
      </Tabs>



      <FluxoNutricaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        fluxo={fluxoEditando}
        etapas={etapasDoFluxo}
        onSave={salvarFluxo}
      />
    </div>
  );
}
