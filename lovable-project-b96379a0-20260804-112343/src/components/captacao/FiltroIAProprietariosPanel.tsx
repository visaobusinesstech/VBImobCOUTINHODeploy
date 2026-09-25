import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Sparkles, MessageCircle, ExternalLink, Target, User, Loader2, RefreshCw } from "lucide-react";
import {
  useFiltrarProprietariosIA,
  type CriterioIA,
  type ResultadoFiltroIA,
  type PrioridadeIA,
} from "@/hooks/useFiltrarProprietariosIA";
import type { FiltroIAErro } from "@/hooks/useFiltrarProprietariosIA";
import { FiltroIAErroAlert } from "./FiltroIAErroAlert";
import { FiltroIAMetricasPanel } from "./FiltroIAMetricasPanel";
import { normalizeToE164 } from "@/lib/phoneE164";

const CRITERIOS_LABEL: Record<CriterioIA, string> = {
  probabilidade: "Probabilidade de venda/aluguel",
  urgencia: "Urgência declarada no anúncio",
  investimento: "Perfil de investimento",
  portfolio: "Ajuste ao portfólio do corretor",
};

const PRIORIDADE_STYLE: Record<PrioridadeIA, string> = {
  alta: "bg-red-600 text-white",
  media: "bg-amber-500 text-white",
  baixa: "bg-slate-300 text-slate-800",
};

const PERFIL_LABEL: Record<string, string> = {
  morador_motivado: "🏠 Morador motivado",
  morador_neutro: "🏠 Morador",
  investidor: "💼 Investidor",
  incerto: "❔ Incerto",
};

function formatBRL(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function ResultadoCard({ r }: { r: ResultadoFiltroIA }) {
  const p = r.proprietario;
  const abrirWhats = () => {
    const e164 = normalizeToE164(p.telefone ?? "");
    if (!e164.ok || !e164.digits) return;
    const msg = r.mensagem_whatsapp || `Olá ${p.nome_proprietario.split(" ")[0]}, gostaria de conversar sobre seu imóvel em ${p.bairro ?? p.cidade}. Podemos falar?`;
    window.open(`https://wa.me/${e164.digits}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${PRIORIDADE_STYLE[r.prioridade]} font-semibold`}>
              IA {r.ai_score} · {r.prioridade}
            </Badge>
            {p.operacao && <Badge variant="outline" className="capitalize">{p.operacao}</Badge>}
            <Badge variant="secondary">{PERFIL_LABEL[r.perfil] ?? r.perfil}</Badge>
            <span className="text-[11px] text-muted-foreground">dor: {p.motivacao_score}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium truncate">{p.nome_proprietario}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {p.titulo_imovel ?? "—"} · {p.bairro ?? "—"}, {p.cidade ?? "—"}
          </div>
          {r.motivos.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[12px] text-muted-foreground list-disc pl-4">
              {r.motivos.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          )}
          {r.acao_recomendada && (
            <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 px-2.5 py-1.5 text-[12px] flex items-start gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <span><strong className="text-primary">Ação:</strong> {r.acao_recomendada}</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold">{formatBRL(p.ultimo_preco ?? p.preco)}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={abrirWhats} disabled={!p.telefone} className="gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </Button>
        {p.url_anuncio && (
          <Button size="sm" variant="outline" asChild>
            <a href={p.url_anuncio} target="_blank" rel="noreferrer" className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Anúncio
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

export function FiltroIAProprietariosPanel() {
  const [operacao, setOperacao] = useState<string>("todas");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [tipoImovel, setTipoImovel] = useState("");
  const [portfolioHint, setPortfolioHint] = useState("");
  const [scoreMin, setScoreMin] = useState(25);
  const [limite, setLimite] = useState(60);
  const [criterios, setCriterios] = useState<Record<CriterioIA, number>>({
    probabilidade: 40, urgencia: 30, investimento: 15, portfolio: 15,
  });

  const filtrar = useFiltrarProprietariosIA();
  const resultados = filtrar.data?.resultados ?? [];

  const stats = useMemo(() => {
    const s = { alta: 0, media: 0, baixa: 0 };
    for (const r of resultados) s[r.prioridade]++;
    return s;
  }, [resultados]);

  const totalPeso = Object.values(criterios).reduce((a, b) => a + b, 0);

  const executar = (opts?: { modoTeste?: boolean; amostra?: number }) => {
    filtrar.mutate({
      operacao: operacao === "todas" ? null : (operacao as "Venda" | "Aluguel"),
      cidade: cidade.trim() || null,
      bairro: bairro.trim() || null,
      tipo_imovel: tipoImovel.trim() || null,
      portfolio_hint: portfolioHint.trim() || null,
      score_min: scoreMin,
      limite,
      criterios,
      modo_teste: opts?.modoTeste ?? false,
      amostra: opts?.amostra ?? 8,
    });
  };
  const executarTeste = () => executar({ modoTeste: true, amostra: 8 });

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="w-5 h-5 text-primary" />
          IA Filtra Proprietários
          <span className="text-xs font-normal text-muted-foreground">
            · ranqueia e recomenda ação para cada lead
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filtros básicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Operação</Label>
            <Select value={operacao} onValueChange={setOperacao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="Venda">Venda</SelectItem>
                <SelectItem value="Aluguel">Aluguel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cidade / RA</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: Águas Claras" />
          </div>
          <div>
            <Label className="text-xs">Bairro</Label>
            <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Ex: Sudoeste" />
          </div>
          <div>
            <Label className="text-xs">Tipo de imóvel</Label>
            <Input value={tipoImovel} onChange={(e) => setTipoImovel(e.target.value)} placeholder="Apartamento, Casa..." />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Foco do corretor (para ajuste de portfólio)</Label>
            <Input
              value={portfolioHint}
              onChange={(e) => setPortfolioHint(e.target.value)}
              placeholder="Ex: apartamentos 2–3 quartos em Águas Claras e Sudoeste"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Score dor mínimo: {scoreMin}</Label>
              <Slider value={[scoreMin]} min={0} max={100} step={5} onValueChange={(v) => setScoreMin(v[0])} />
            </div>
            <div>
              <Label className="text-xs">Máximo a analisar: {limite}</Label>
              <Slider value={[limite]} min={10} max={200} step={10} onValueChange={(v) => setLimite(v[0])} />
            </div>
          </div>
        </div>

        {/* Pesos dos critérios */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> Pesos dos critérios IA
            </div>
            <span className="text-xs text-muted-foreground">total: {totalPeso}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(criterios) as CriterioIA[]).map((k) => (
              <div key={k}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{CRITERIOS_LABEL[k]}</span>
                  <span className="font-semibold">{criterios[k]}</span>
                </div>
                <Slider
                  value={[criterios[k]]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => setCriterios((c) => ({ ...c, [k]: v[0] }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => executar()} disabled={filtrar.isPending} className="gap-2">
            {filtrar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {filtrar.isPending ? "Analisando com IA…" : "Filtrar com IA"}
          </Button>
          <Button
            variant="secondary"
            onClick={executarTeste}
            disabled={filtrar.isPending}
            className="gap-2"
            title="Roda em amostra pequena (8) sem persistir nada, para prever contagem por nível"
          >
            🧪 Modo teste (dry-run)
          </Button>
          {filtrar.data && (
            <Button variant="outline" size="sm" onClick={() => executar()} disabled={filtrar.isPending} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Reprocessar
            </Button>
          )}
          {filtrar.data && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Alta: <strong className="text-red-600">{stats.alta}</strong></span>
              <span>Média: <strong className="text-amber-600">{stats.media}</strong></span>
              <span>Baixa: <strong className="text-slate-600">{stats.baixa}</strong></span>
              {filtrar.data.modelo && <span>· {filtrar.data.provider}/{filtrar.data.modelo}</span>}
            </div>
          )}
        </div>

        {/* Resumo do modo teste */}
        {filtrar.data?.modo_teste && (
          <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧪</span>
                <div>
                  <div className="font-semibold text-amber-900">Modo teste — nada foi persistido</div>
                  <div className="text-xs text-amber-800">
                    Amostra de {filtrar.data.amostra ?? 8} candidatos · run {String(filtrar.data.run_id ?? "").slice(0, 8)}
                  </div>
                </div>
              </div>
              <Button size="sm" onClick={() => executar()} disabled={filtrar.isPending}>
                Aplicar de verdade
              </Button>
            </div>

            <div>
              <div className="text-xs font-semibold text-amber-900 mb-1.5">Contagem por nível de motivação (dor)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(["Frio", "Morno", "Quente", "Fervendo"] as const).map((nivel) => {
                  const n = filtrar.data?.contagem_nivel?.[nivel] ?? 0;
                  const color =
                    nivel === "Fervendo" ? "bg-red-600 text-white" :
                    nivel === "Quente" ? "bg-orange-500 text-white" :
                    nivel === "Morno" ? "bg-amber-400 text-amber-950" :
                    "bg-slate-200 text-slate-700";
                  return (
                    <div key={nivel} className={`rounded-md px-3 py-2 ${color}`}>
                      <div className="text-[10px] uppercase tracking-wide opacity-80">{nivel}</div>
                      <div className="text-xl font-bold">{n}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-amber-900 mb-1.5">Prioridade IA (nesta amostra)</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md bg-red-100 text-red-800 px-3 py-2">
                  <div className="text-[10px] uppercase">Alta</div>
                  <div className="text-lg font-bold">{filtrar.data.contagem_prioridade?.alta ?? 0}</div>
                </div>
                <div className="rounded-md bg-amber-100 text-amber-800 px-3 py-2">
                  <div className="text-[10px] uppercase">Média</div>
                  <div className="text-lg font-bold">{filtrar.data.contagem_prioridade?.media ?? 0}</div>
                </div>
                <div className="rounded-md bg-slate-100 text-slate-700 px-3 py-2">
                  <div className="text-[10px] uppercase">Baixa</div>
                  <div className="text-lg font-bold">{filtrar.data.contagem_prioridade?.baixa ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Métricas da execução */}
        {filtrar.data && !filtrar.isPending && (
          <FiltroIAMetricasPanel data={filtrar.data} />
        )}


        {/* Erro detalhado */}
        {filtrar.isError && (
          <FiltroIAErroAlert
            erro={
              ((filtrar.error as any)?.detalhes as FiltroIAErro) ?? {
                message: (filtrar.error as any)?.message ?? "Falha desconhecida",
              }
            }
            onRetry={() => executar()}
          />
        )}


        {/* Resultados */}
        {filtrar.isPending ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            IA analisando candidatos…
          </div>
        ) : resultados.length === 0 && filtrar.data ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum proprietário atende aos filtros. Reduza o <strong>score mínimo</strong> ou amplie o escopo.
          </div>
        ) : resultados.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {resultados.map((r) => (
              <ResultadoCard key={r.proprietario.id} r={r} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Configure os filtros e clique em <strong>Filtrar com IA</strong> para ver a lista priorizada.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
