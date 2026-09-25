import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Flame, RefreshCw, TrendingDown, Clock, Repeat, User, ExternalLink, MessageCircle, Search,
  ChevronDown, ChevronUp, CheckCircle2, CircleDashed, Home, Info,
} from "lucide-react";
import {
  useProprietariosQuentes,
  useRecalcularMotivacao,
  type NivelMotivacao,
  type ProprietarioQuente,
} from "@/hooks/useProprietariosQuentes";
import { normalizeToE164 } from "@/lib/phoneE164";
import { MotivacaoConfigDialog } from "./MotivacaoConfigDialog";

const NIVEL_STYLES: Record<NivelMotivacao, { label: string; badge: string; ring: string }> = {
  fervendo: { label: "🔥 Fervendo", badge: "bg-red-600 text-white", ring: "ring-red-500/40" },
  quente: { label: "🔥 Quente", badge: "bg-orange-500 text-white", ring: "ring-orange-400/40" },
  morno: { label: "Morno", badge: "bg-amber-400 text-amber-950", ring: "ring-amber-300/40" },
  frio: { label: "Frio", badge: "bg-slate-300 text-slate-700", ring: "ring-slate-200" },
};

function formatBRL(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function SinalChip({ icon: Icon, label, tone }: { icon: any; label: string; tone: "red" | "orange" | "amber" | "slate" }) {
  const tones: Record<string, string> = {
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

type ScoreFator = {
  key: string;
  label: string;
  descricao: string;
  peso: "alto" | "médio" | "baixo";
  contribuicao?: string; // ex.: "+alta", "+média"
  como_ativar?: string;  // orientação quando ausente
};

function computarFatoresScore(p: ProprietarioQuente): { detectados: ScoreFator[]; ausentes: ScoreFator[] } {
  const s = p.motivacao_sinais ?? {};
  const dias = Number(s.dias_no_mercado ?? 0);
  const queda = Number(s.queda_pct ?? 0);
  const rep = Number(s.republicacoes ?? 0);
  const fsbo = !!s.fsbo;
  const temHistorico = Array.isArray(p.historico_precos) && p.historico_precos.length >= 2;

  const detectados: ScoreFator[] = [];
  const ausentes: ScoreFator[] = [];

  // Dias no mercado
  if (dias >= 60) {
    detectados.push({
      key: "dias_no_mercado",
      label: `${dias} dias no mercado`,
      descricao: dias >= 180 ? "Anúncio parado — alta pressão para negociar."
        : dias >= 90 ? "Anúncio maduro — proprietário costuma ficar mais flexível."
        : "Passou de 60 dias — começa a pesar no bolso.",
      peso: "alto",
      contribuicao: dias >= 180 ? "+alta" : dias >= 90 ? "+média" : "+baixa",
    });
  } else {
    ausentes.push({
      key: "dias_no_mercado",
      label: "Tempo no mercado (60d+)",
      descricao: `Ainda ${dias || 0}d desde o primeiro registro.`,
      peso: "alto",
      como_ativar: "Aguardar acompanhamento automático — o cron atualiza este contador diariamente.",
    });
  }

  // Queda de preço
  if (queda >= 5) {
    detectados.push({
      key: "queda_preco",
      label: `Reduziu ${queda}%`,
      descricao: queda >= 10 ? "Queda expressiva — sinal forte de urgência."
        : "Ajuste de preço detectado — proprietário disposto a negociar.",
      peso: "alto",
      contribuicao: queda >= 10 ? "+alta" : "+média",
    });
  } else {
    ausentes.push({
      key: "queda_preco",
      label: "Queda de preço (≥5%)",
      descricao: temHistorico ? "Preço estável no histórico registrado." : "Ainda não temos histórico suficiente para detectar queda.",
      peso: "alto",
      como_ativar: temHistorico
        ? "Nada a fazer — vamos avisar assim que houver ajuste."
        : "Aguardar 1–2 recoletas do anúncio para termos preços comparáveis.",
    });
  }

  // Republicações
  if (rep >= 1) {
    detectados.push({
      key: "republicacoes",
      label: `Reanunciou ${rep}×`,
      descricao: "Republicação indica frustração com o portal atual.",
      peso: "médio",
      contribuicao: rep >= 3 ? "+alta" : "+média",
    });
  } else {
    ausentes.push({
      key: "republicacoes",
      label: "Republicação do anúncio",
      descricao: "Anúncio único, sem republicações detectadas.",
      peso: "médio",
      como_ativar: "Só é ativado se o mesmo imóvel voltar a aparecer em outro portal/data.",
    });
  }

  // Direto do dono (FSBO)
  if (fsbo) {
    detectados.push({
      key: "fsbo",
      label: "Anúncio direto do dono",
      descricao: "Sem intermediário — abordagem tende a ter resposta mais rápida.",
      peso: "médio",
      contribuicao: "+média",
    });
  } else {
    ausentes.push({
      key: "fsbo",
      label: "Anúncio direto do dono",
      descricao: "Anúncio via imobiliária/portal com corretor.",
      peso: "médio",
      como_ativar: "Verificar manualmente se o telefone do anúncio é do proprietário.",
    });
  }

  // Preço acima da média (se disponível no raw)
  const precoAcima = Number((p as any).motivacao_sinais?.preco_acima_pct ?? 0);
  if (precoAcima >= 10) {
    detectados.push({
      key: "preco_acima",
      label: `Preço ${precoAcima}% acima da média`,
      descricao: "Sinal claro de que ajuste virá — bom momento para abordar.",
      peso: "médio",
      contribuicao: "+média",
    });
  } else if (precoAcima === 0) {
    ausentes.push({
      key: "preco_acima",
      label: "Preço acima da média do bairro",
      descricao: "Ainda não calculado ou dentro da média.",
      peso: "baixo",
      como_ativar: "Precisamos de mais anúncios no mesmo bairro para comparar.",
    });
  }

  return { detectados, ausentes };
}

function pesoBadge(peso: ScoreFator["peso"]) {
  const cls = peso === "alto" ? "bg-red-100 text-red-700 border-red-200"
    : peso === "médio" ? "bg-amber-100 text-amber-800 border-amber-200"
    : "bg-slate-100 text-slate-700 border-slate-200";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>peso {peso}</span>;
}

function LinhaProprietario({ p }: { p: ProprietarioQuente }) {
  const style = NIVEL_STYLES[p.motivacao_nivel] ?? NIVEL_STYLES.frio;
  const dias = p.motivacao_sinais?.dias_no_mercado ?? 0;
  const queda = p.motivacao_sinais?.queda_pct ?? 0;
  const rep = p.motivacao_sinais?.republicacoes ?? 0;
  const fsbo = p.motivacao_sinais?.fsbo;
  const [motivosAbertos, setMotivosAbertos] = useState(false);
  const { detectados, ausentes } = useMemo(() => computarFatoresScore(p), [p]);

  const abrirWhats = () => {
    const e164 = normalizeToE164(p.telefone ?? "");
    if (!e164.ok || !e164.digits) return;
    const msg =
      queda > 0
        ? `Olá ${p.nome_proprietario.split(" ")[0]}, vi que ajustou o preço do imóvel em ${p.bairro ?? p.cidade}. Posso apresentar um plano com compradores qualificados que temos na carteira?`
        : dias >= 90
        ? `Olá ${p.nome_proprietario.split(" ")[0]}, vi seu imóvel em ${p.bairro ?? p.cidade} anunciado há um tempo. Tenho uma estratégia diferente que pode acelerar o fechamento — posso te contar em 3 minutos?`
        : `Olá ${p.nome_proprietario.split(" ")[0]}, tenho interesse em conversar sobre seu imóvel em ${p.bairro ?? p.cidade}. Podemos falar?`;
    window.open(`https://wa.me/${e164.digits}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className={`rounded-lg border bg-card p-4 ring-1 ${style.ring} hover:shadow-sm transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${style.badge} font-semibold`}>{style.label} · {p.motivacao_score}</Badge>
            {p.operacao && <Badge variant="outline" className="capitalize">{p.operacao}</Badge>}
            {fsbo && <Badge variant="outline" className="text-emerald-700 border-emerald-300">Direto do dono</Badge>}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium truncate">{p.nome_proprietario}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {p.titulo_imovel ?? "—"} · {p.bairro ?? "—"}, {p.cidade ?? "—"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {dias >= 60 && (
              <SinalChip
                icon={Clock}
                label={`${dias}d no mercado`}
                tone={dias >= 180 ? "red" : dias >= 90 ? "orange" : "amber"}
              />
            )}
            {queda >= 5 && (
              <SinalChip
                icon={TrendingDown}
                label={`Reduziu ${queda}%`}
                tone={queda >= 10 ? "red" : "orange"}
              />
            )}
            {rep >= 1 && <SinalChip icon={Repeat} label={`Reanunciou ${rep}×`} tone="orange" />}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold">{formatBRL(p.ultimo_preco ?? p.preco)}</div>
          {queda >= 5 && p.historico_precos?.[0]?.preco && (
            <div className="text-[11px] text-muted-foreground line-through">
              {formatBRL(p.historico_precos[0].preco)}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2 flex-wrap">
        {(() => {
          const aprovado = p.status_revisao === "aprovado";
          return (
            <>
              <Button
                size="sm"
                onClick={abrirWhats}
                disabled={!p.telefone || !aprovado}
                className="gap-1.5"
                title={!aprovado ? "Aguardando aprovação LGPD da fonte" : ""}
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </Button>
              {!aprovado && (
                <Badge variant="outline" className="text-yellow-800 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-300">
                  Aguardando aprovação LGPD
                </Badge>
              )}
            </>
          );
        })()}
        {p.url_anuncio && (
          <Button size="sm" variant="outline" asChild>
            <a href={p.url_anuncio} target="_blank" rel="noreferrer" className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Anúncio
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 ml-auto"
          onClick={() => setMotivosAbertos((v) => !v)}
          aria-expanded={motivosAbertos}
        >
          <Info className="w-3.5 h-3.5" />
          {motivosAbertos ? "Ocultar motivos" : `Ver motivos do score (${detectados.length}/${detectados.length + ausentes.length})`}
          {motivosAbertos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {motivosAbertos && (
        <div className="mt-3 rounded-md border bg-muted/30 p-3 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sinais detectados ({detectados.length})
            </div>
            {detectados.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum sinal disparado ainda — o score deste proprietário está no piso.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {detectados.map((f) => (
                  <li key={f.key} className="text-xs bg-background rounded border border-emerald-100 px-2.5 py-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-emerald-800">{f.label}</span>
                      {pesoBadge(f.peso)}
                      {f.contribuicao && (
                        <span className="text-[10px] text-emerald-700 font-semibold">{f.contribuicao}</span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5">{f.descricao}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-2">
              <CircleDashed className="w-3.5 h-3.5" />
              Sinais ainda não detectados ({ausentes.length})
            </div>
            {ausentes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todos os sinais foram capturados 🔥</p>
            ) : (
              <ul className="space-y-1.5">
                {ausentes.map((f) => (
                  <li key={f.key} className="text-xs bg-background rounded border border-dashed border-slate-200 px-2.5 py-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">{f.label}</span>
                      {pesoBadge(f.peso)}
                    </div>
                    <p className="text-muted-foreground mt-0.5">{f.descricao}</p>
                    {f.como_ativar && (
                      <p className="text-[11px] text-primary/80 mt-1">
                        <Home className="inline w-3 h-3 mr-1" />
                        {f.como_ativar}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground pt-1 border-t">
            Score atual: <strong>{p.motivacao_score}</strong> · Nível: <strong>{style.label}</strong>.
            O cálculo combina peso alto (dias no mercado, queda de preço) e peso médio (republicação, anúncio direto).
          </p>
        </div>
      )}
    </div>
  );
}

export function ProprietariosQuentesPanel() {
  const [nivel, setNivel] = useState<NivelMotivacao>("frio");
  const [busca, setBusca] = useState("");
  const { data = [], isLoading } = useProprietariosQuentes(nivel);
  // Consulta separada só para as estatísticas (sempre traz tudo)
  const { data: todos = [] } = useProprietariosQuentes("frio");
  const recalc = useRecalcularMotivacao();

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (p) =>
        p.nome_proprietario.toLowerCase().includes(q) ||
        (p.bairro ?? "").toLowerCase().includes(q) ||
        (p.cidade ?? "").toLowerCase().includes(q) ||
        (p.titulo_imovel ?? "").toLowerCase().includes(q)
    );
  }, [data, busca]);

  const stats = useMemo(() => {
    const s = { fervendo: 0, quente: 0, morno: 0, frio: 0 };
    for (const p of todos) s[p.motivacao_nivel]++;
    return s;
  }, [todos]);

  // Após recalcular, se não houver morno+ mas houver frios, cai para "Todos"
  useEffect(() => {
    if (!recalc.isSuccess) return;
    const morneUp = stats.fervendo + stats.quente + stats.morno;
    if (morneUp === 0 && stats.frio > 0 && nivel !== "frio") {
      setNivel("frio");
    }
  }, [recalc.isSuccess, stats, nivel]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="w-5 h-5 text-orange-500" />
            Proprietários Quentes
            <span className="text-xs font-normal text-muted-foreground">
              · motor de detecção de dor
            </span>
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <MotivacaoConfigDialog />
            <Button
              size="sm"
              variant="outline"
              onClick={() => recalc.mutate()}
              disabled={recalc.isPending}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recalc.isPending ? "animate-spin" : ""}`} />
              Recalcular score
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>🔥 Fervendo: <strong className="text-red-600">{stats.fervendo}</strong></span>
          <span>🔥 Quente: <strong className="text-orange-600">{stats.quente}</strong></span>
          <span>Morno: <strong className="text-amber-600">{stats.morno}</strong></span>
          <span>Frio: <strong className="text-slate-600">{stats.frio}</strong></span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Tabs value={nivel} onValueChange={(v) => setNivel(v as NivelMotivacao)} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="fervendo">Fervendo</TabsTrigger>
              <TabsTrigger value="quente">Quente+</TabsTrigger>
              <TabsTrigger value="morno">Morno+</TabsTrigger>
              <TabsTrigger value="frio">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, bairro, cidade…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtrados.length === 0 ? (
          (() => {
            const totalProcessados = stats.frio + stats.morno + stats.quente + stats.fervendo;
            const acimaDoNivel =
              nivel === "morno" ? stats.morno + stats.quente + stats.fervendo
              : nivel === "quente" ? stats.quente + stats.fervendo
              : nivel === "fervendo" ? stats.fervendo
              : totalProcessados;
            const nivelLabel = nivel === "morno" ? "Morno+" : nivel === "quente" ? "Quente+" : nivel === "fervendo" ? "Fervendo" : "Todos";

            if (totalProcessados === 0) {
              return (
                <div className="py-12 text-center">
                  <Flame className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum proprietário capturado ainda. Rode uma busca e clique em <strong>Recalcular score</strong>.
                  </p>
                </div>
              );
            }

            if (nivel !== "frio" && acimaDoNivel === 0) {
              return (
                <div className="py-10 px-4 text-center rounded-lg border border-dashed bg-amber-50/50">
                  <Flame className="w-10 h-10 mx-auto text-amber-500/70" />
                  <p className="mt-3 text-sm font-semibold text-amber-900">
                    Processamos {totalProcessados} proprietário{totalProcessados > 1 ? "s" : ""}, mas nenhum atingiu o nível <em>{nivelLabel}</em> ainda.
                  </p>
                  <p className="mt-1 text-xs text-amber-800/80 max-w-md mx-auto">
                    Todos os {stats.frio} registros estão classificados como <strong>Frio</strong> porque ainda não temos sinais fortes
                    (60d+ no mercado, queda ≥5% ou republicação). Esses sinais aparecem ao longo do tempo, com novas coletas.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    <Button size="sm" onClick={() => setNivel("frio")} className="gap-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      Ver os {stats.frio} em Todos
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => recalc.mutate()}
                      disabled={recalc.isPending}
                      className="gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${recalc.isPending ? "animate-spin" : ""}`} />
                      Recalcular agora
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div className="py-12 text-center">
                <Flame className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">Nenhum resultado com esse filtro de busca.</p>
              </div>
            );
          })()
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtrados.map((p) => (
              <LinhaProprietario key={p.id} p={p} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
