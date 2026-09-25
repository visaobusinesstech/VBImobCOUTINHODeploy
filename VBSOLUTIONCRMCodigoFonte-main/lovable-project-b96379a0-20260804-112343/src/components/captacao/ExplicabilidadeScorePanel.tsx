import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  TrendingDown,
  Clock,
  Repeat,
  User,
  Info,
  ExternalLink,
  Search,
  Sparkles,
  Home,
  Phone,
  Mail,
  MapPin,
  Globe,
  Copy,
  MessageSquare,
  Eye,
  DollarSign,
  Zap,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { DiagnosticoNivelCard } from "@/components/captacao/DiagnosticoNivelCard";
import { SimuladorRegrasMotivacao } from "@/components/captacao/SimuladorRegrasMotivacao";
import { useMotivacaoConfig } from "@/hooks/useMotivacaoConfig";

interface TimelineEvent {
  at: string;
  type:
    | "found"
    | "republication"
    | "price_change"
    | "last_seen"
    | "score"
    | "whatsapp";
  title: string;
  description?: string;
  meta?: string;
}

const TIMELINE_META: Record<
  TimelineEvent["type"],
  { icon: any; color: string; ring: string }
> = {
  found: { icon: Eye, color: "bg-blue-500", ring: "ring-blue-100" },
  republication: { icon: Repeat, color: "bg-purple-500", ring: "ring-purple-100" },
  price_change: { icon: DollarSign, color: "bg-red-500", ring: "ring-red-100" },
  last_seen: { icon: Clock, color: "bg-slate-500", ring: "ring-slate-100" },
  score: { icon: Zap, color: "bg-amber-500", ring: "ring-amber-100" },
  whatsapp: { icon: MessageSquare, color: "bg-emerald-500", ring: "ring-emerald-100" },
};


// ---- Regras de contribuição (espelhadas do calcular_motivacao_proprietario) ----
// Peso máximo por sinal e limiares para explicar como o score foi formado.
const SIGNAL_META = {
  tempo: {
    label: "Tempo no mercado",
    icon: Clock,
    max: 40,
    color: "bg-orange-500",
    thresholds: [
      { at: 60, pts: 10, label: "≥ 60 dias" },
      { at: 90, pts: 25, label: "≥ 90 dias" },
      { at: 180, pts: 40, label: "≥ 180 dias" },
    ],
    unit: "dias",
    signalKey: "dias_no_mercado",
    positiveWhenAbove: true,
  },
  queda: {
    label: "Queda de preço",
    icon: TrendingDown,
    max: 35,
    color: "bg-red-500",
    thresholds: [
      { at: 5, pts: 25, label: "≥ 5%" },
      { at: 10, pts: 35, label: "≥ 10%" },
    ],
    unit: "%",
    signalKey: "queda_pct",
    positiveWhenAbove: true,
  },
  republicacao: {
    label: "Republicações",
    icon: Repeat,
    max: 40,
    color: "bg-purple-500",
    thresholds: [
      { at: 1, pts: 20, label: "1 republicação" },
      { at: 2, pts: 40, label: "≥ 2 republicações" },
    ],
    unit: "vezes",
    signalKey: "republicacoes",
    positiveWhenAbove: true,
  },
  fsbo: {
    label: "FSBO (direto do dono)",
    icon: User,
    max: 10,
    color: "bg-emerald-500",
    thresholds: [{ at: 1, pts: 10, label: "Origem direta" }],
    unit: "",
    signalKey: "fsbo",
    positiveWhenAbove: true,
  },
} as const;

type SignalKey = keyof typeof SIGNAL_META;

interface Proprietario {
  id: string;
  nome_proprietario: string | null;
  telefone: string | null;
  telefone_e164: string | null;
  email: string | null;
  cidade: string | null;
  bairro: string | null;
  titulo_imovel: string | null;
  operacao: string | null;
  preco: number | null;
  ultimo_preco: number | null;
  url_anuncio: string | null;
  origem: string | null;
  observacoes: string | null;
  motivacao_score: number | null;
  motivacao_nivel: string | null;
  motivacao_sinais: any;
  motivacao_calculada_em: string | null;
  primeiro_visto_em: string | null;
  ultimo_visto_em: string | null;
  historico_precos: any;
  republicacoes: number | null;
  imovel_id_ref: string | null;
  dados_extraidos_raw: any;
}

const NIVEL_COLORS: Record<string, string> = {
  fervendo: "bg-red-500 text-white",
  quente: "bg-orange-500 text-white",
  morno: "bg-yellow-500 text-white",
  frio: "bg-slate-400 text-white",
};

function portalFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const map: Record<string, string> = {
      "zapimoveis.com.br": "Zap Imóveis",
      "vivareal.com.br": "Viva Real",
      "olx.com.br": "OLX",
      "quintoandar.com.br": "QuintoAndar",
      "imovelweb.com.br": "ImóvelWeb",
      "chavesnamao.com.br": "Chaves na Mão",
      "dfimoveis.com.br": "DF Imóveis",
      "wimoveis.com.br": "W Imóveis",
    };
    return map[host] ?? host;
  } catch {
    return null;
  }
}

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Falha ao copiar")
  );
}


function ContributionRow({
  signalKey,
  bonus,
  signalValue,
}: {
  signalKey: SignalKey;
  bonus: number;
  signalValue: any;
}) {
  const meta = SIGNAL_META[signalKey];
  const Icon = meta.icon;
  const pct = Math.round(((bonus ?? 0) / meta.max) * 100);
  const active = (bonus ?? 0) > 0;

  // próximo threshold para atingir o próximo patamar
  const numericValue =
    typeof signalValue === "boolean"
      ? signalValue
        ? 1
        : 0
      : Number(signalValue ?? 0);
  const nextThreshold = meta.thresholds.find((t) => numericValue < t.at);
  const currentThreshold = [...meta.thresholds]
    .reverse()
    .find((t) => numericValue >= t.at);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-8 w-8 rounded-md flex items-center justify-center ${
              active ? meta.color + " text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-sm">{meta.label}</div>
            <div className="text-xs text-muted-foreground">
              Valor atual:{" "}
              <b className="text-foreground">
                {typeof signalValue === "boolean"
                  ? signalValue
                    ? "sim"
                    : "não"
                  : `${numericValue}${meta.unit ? " " + meta.unit : ""}`}
              </b>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-lg font-bold ${
              active ? "text-emerald-600" : "text-muted-foreground"
            }`}
          >
            {active ? "+" : ""}
            {bonus ?? 0}
          </div>
          <div className="text-[10px] text-muted-foreground">
            máx {meta.max} pts
          </div>
        </div>
      </div>

      <Progress value={pct} className="h-2" />

      <div className="flex flex-wrap gap-1 pt-1">
        {meta.thresholds.map((t) => {
          const reached = numericValue >= t.at;
          return (
            <Badge
              key={t.at}
              variant={reached ? "default" : "outline"}
              className={`text-[10px] ${
                reached ? meta.color + " text-white border-transparent" : ""
              }`}
            >
              {t.label} → +{t.pts}
            </Badge>
          );
        })}
      </div>

      {nextThreshold && (
        <div className="text-xs text-muted-foreground flex items-start gap-1 pt-1 border-t">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Para ganhar <b>+{nextThreshold.pts - (currentThreshold?.pts ?? 0)}</b>{" "}
            pts adicionais, este sinal precisa chegar a{" "}
            <b>
              {nextThreshold.at}
              {meta.unit ? " " + meta.unit : ""}
            </b>
            .
          </span>
        </div>
      )}
    </div>
  );
}

export function ExplicabilidadeScorePanel() {
  const { user } = useAuth();
  const uid = user?.id;
  const { data: motivacaoConfig } = useMotivacaoConfig();
  const [busca, setBusca] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: opcoes = [] } = useQuery({
    queryKey: ["explicabilidade-opcoes", uid, busca],
    enabled: !!uid,
    queryFn: async () => {
      let q = supabase
        .from("lista_proprietarios_captacao")
        .select(
          "id,nome_proprietario,cidade,bairro,titulo_imovel,motivacao_score,motivacao_nivel"
        )
        .eq("imobiliaria_id", uid!)
        .not("motivacao_score", "is", null)
        .order("motivacao_score", { ascending: false })
        .limit(50);
      if (busca.trim()) {
        q = q.ilike("nome_proprietario", `%${busca.trim()}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: prop } = useQuery({
    queryKey: ["explicabilidade-detalhe", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from("lista_proprietarios_captacao")
        .select(
          "id,nome_proprietario,telefone,telefone_e164,email,cidade,bairro,titulo_imovel,operacao,preco,ultimo_preco,url_anuncio,origem,observacoes,motivacao_score,motivacao_nivel,motivacao_sinais,motivacao_calculada_em,primeiro_visto_em,ultimo_visto_em,historico_precos,republicacoes,imovel_id_ref,dados_extraidos_raw"
        )
        .eq("id", selectedId!)
        .maybeSingle();
      return data as Proprietario | null;
    },
  });

  const { data: contatos = [] } = useQuery({
    queryKey: ["explicabilidade-contatos", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_contatos_captacao")
        .select("id,sent_at,telefone_digits,mensagem_preview,url_anuncio")
        .eq("lista_proprietario_id", selectedId!)
        .order("sent_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!prop) return [];
    const events: TimelineEvent[] = [];

    if (prop.primeiro_visto_em) {
      events.push({
        at: prop.primeiro_visto_em,
        type: "found",
        title: "Anúncio encontrado",
        description: portalFromUrl(prop.url_anuncio) ?? prop.origem ?? "Fonte pública",
      });
    }

    const historico = Array.isArray(prop.historico_precos) ? prop.historico_precos : [];
    let prev: number | null = null;
    [...historico]
      .sort((a: any, b: any) => new Date(a?.data ?? 0).getTime() - new Date(b?.data ?? 0).getTime())
      .forEach((h: any, idx: number) => {
        const preco = Number(h?.preco ?? 0);
        if (!preco || !h?.data) return;
        if (prev === null) {
          prev = preco;
          return;
        }
        if (preco !== prev) {
          const diff = preco - prev;
          const pct = prev ? ((diff / prev) * 100).toFixed(1) : "0";
          events.push({
            at: h.data,
            type: "price_change",
            title: diff < 0 ? "Queda de preço" : "Aumento de preço",
            description: `De R$ ${prev.toLocaleString("pt-BR")} para R$ ${preco.toLocaleString("pt-BR")}`,
            meta: `${diff < 0 ? "" : "+"}${pct}%`,
          });
        }
        prev = preco;
        void idx;
      });

    const rep = prop.republicacoes ?? 0;
    if (rep > 0 && prop.ultimo_visto_em) {
      events.push({
        at: prop.ultimo_visto_em,
        type: "republication",
        title: `Republicação detectada`,
        description: `${rep} republicação${rep > 1 ? "ões" : ""} registrada${rep > 1 ? "s" : ""}`,
      });
    }

    if (prop.motivacao_calculada_em) {
      events.push({
        at: prop.motivacao_calculada_em,
        type: "score",
        title: "Score recalculado",
        description: `Nível ${prop.motivacao_nivel ?? "—"} · ${prop.motivacao_score ?? 0} pts`,
      });
    }

    if (
      prop.ultimo_visto_em &&
      prop.ultimo_visto_em !== prop.primeiro_visto_em &&
      rep === 0
    ) {
      events.push({
        at: prop.ultimo_visto_em,
        type: "last_seen",
        title: "Anúncio revisto",
        description: "Última verificação automática",
      });
    }

    contatos.forEach((c: any) => {
      events.push({
        at: c.sent_at,
        type: "whatsapp",
        title: "WhatsApp enviado ao proprietário",
        description: c.mensagem_preview
          ? String(c.mensagem_preview).slice(0, 140)
          : `Contato para ${c.telefone_digits}`,
        meta: c.telefone_digits,
      });
    });

    return events
      .filter((e) => !!e.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [prop, contatos]);

  const decomposicao = useMemo(() => {
    if (!prop?.motivacao_sinais) return null;
    const s = prop.motivacao_sinais;
    const bonus = s.bonus ?? {};
    const rows: {
      key: SignalKey;
      bonus: number;
      value: any;
    }[] = [
      { key: "tempo", bonus: bonus.tempo ?? 0, value: s.dias_no_mercado ?? 0 },
      { key: "queda", bonus: bonus.queda ?? 0, value: s.queda_pct ?? 0 },
      {
        key: "republicacao",
        bonus: bonus.republicacao ?? 0,
        value: s.republicacoes ?? 0,
      },
      { key: "fsbo", bonus: bonus.fsbo ?? 0, value: !!s.fsbo },
    ];
    const total = rows.reduce((a, r) => a + (r.bonus ?? 0), 0);
    return { rows, total };
  }, [prop]);


  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Coluna 1: seletor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" /> Selecionar proprietário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Buscar por nome…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Select
            value={selectedId ?? ""}
            onValueChange={(v) => setSelectedId(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`${opcoes.length} proprietários`} />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((o: any) => (
                <SelectItem key={o.id} value={o.id}>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${
                        NIVEL_COLORS[o.motivacao_nivel ?? "frio"]
                      } text-[10px] px-1.5`}
                    >
                      {o.motivacao_score ?? 0}
                    </Badge>
                    <span className="truncate max-w-[200px]">
                      {o.nome_proprietario ?? "—"}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="max-h-[520px] overflow-auto space-y-1 border-t pt-2">
            {opcoes.map((o: any) => (
              <button
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                className={`w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted flex items-center justify-between gap-2 ${
                  selectedId === o.id ? "bg-muted" : ""
                }`}
              >
                <div className="truncate flex-1">
                  <div className="truncate font-medium">
                    {o.nome_proprietario ?? "—"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[o.bairro, o.cidade].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Badge
                  className={`${
                    NIVEL_COLORS[o.motivacao_nivel ?? "frio"]
                  } shrink-0`}
                >
                  {o.motivacao_score ?? 0}
                </Badge>
              </button>
            ))}
            {opcoes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhum proprietário com score calculado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coluna 2: decomposição */}
      <div className="space-y-4">
        {!prop ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-40" />
              Selecione um proprietário para ver a decomposição do{" "}
              <b>ai_score</b>.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">
                      {prop.nome_proprietario ?? "Proprietário"}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[prop.bairro, prop.cidade, prop.operacao]
                        .filter(Boolean)
                        .join(" · ")}
                      {prop.imovel_id_ref && ` · Ref ${prop.imovel_id_ref}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {prop.url_anuncio && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(prop.url_anuncio!, "_blank", "noopener")
                        }
                      >
                        <ExternalLink className="h-3 w-3 mr-1" /> Anúncio
                      </Button>
                    )}
                    <Badge
                      className={`${
                        NIVEL_COLORS[prop.motivacao_nivel ?? "frio"]
                      } text-sm px-3 py-1`}
                    >
                      {prop.motivacao_nivel?.toUpperCase()} ·{" "}
                      {prop.motivacao_score ?? 0}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Barra composta – contribuição relativa */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Composição do score (100 pts máx.)</span>
                    <span>
                      soma dos sinais:{" "}
                      <b className="text-foreground">
                        {decomposicao?.total ?? 0}
                      </b>{" "}
                      → score final{" "}
                      <b className="text-foreground">
                        {prop.motivacao_score ?? 0}
                      </b>
                    </span>
                  </div>
                  <TooltipProvider>
                    <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                      {decomposicao?.rows.map((r) => {
                        const meta = SIGNAL_META[r.key];
                        const pct = r.bonus;
                        if (pct <= 0) return null;
                        return (
                          <Tooltip key={r.key}>
                            <TooltipTrigger asChild>
                              <div
                                className={`${meta.color} h-full`}
                                style={{ width: `${pct}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                <b>{meta.label}</b>: +{r.bonus} pts
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {decomposicao?.rows.map((r) => {
                      const meta = SIGNAL_META[r.key];
                      return (
                        <div
                          key={r.key}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-sm ${meta.color}`}
                          />
                          <span className="text-muted-foreground">
                            {meta.label}
                          </span>
                          <b>{r.bonus > 0 ? `+${r.bonus}` : r.bonus}</b>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {motivacaoConfig && (
              <DiagnosticoNivelCard
                input={{
                  primeiro_visto_em: prop.primeiro_visto_em,
                  ultimo_preco: prop.ultimo_preco,
                  preco: prop.preco,
                  historico_precos: prop.historico_precos,
                  republicacoes: prop.republicacoes,
                  origem: prop.origem,
                }}
                config={motivacaoConfig}
                scoreAtual={prop.motivacao_score}
                nivelAtual={prop.motivacao_nivel}
              />
            )}

            <SimuladorRegrasMotivacao
              input={{
                primeiro_visto_em: prop.primeiro_visto_em,
                ultimo_preco: prop.ultimo_preco,
                preco: prop.preco,
                historico_precos: prop.historico_precos,
                republicacoes: prop.republicacoes,
                origem: prop.origem,
              }}
              scoreAtual={prop.motivacao_score}
              nivelAtual={prop.motivacao_nivel}
            />

            {/* Imóvel & Anúncio de referência */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="h-4 w-4" /> Imóvel & anúncio de referência
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Título do imóvel</div>
                    <div className="font-medium">{prop.titulo_imovel ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Operação</div>
                    <div className="font-medium capitalize">{prop.operacao ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Localização
                    </div>
                    <div className="font-medium">
                      {[prop.bairro, prop.cidade].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Referência interna</div>
                    <div className="font-medium">{prop.imovel_id_ref ?? "—"}</div>
                  </div>
                  {(() => {
                    const raw = prop.dados_extraidos_raw ?? {};
                    const extras: [string, any][] = [
                      ["Tipo", raw.tipo_imovel ?? raw.tipo],
                      ["Área", raw.area ? `${raw.area} m²` : null],
                      ["Quartos", raw.quartos],
                      ["Suítes", raw.suites],
                      ["Vagas", raw.vagas],
                      ["Condomínio", raw.condominio ? `R$ ${Number(raw.condominio).toLocaleString("pt-BR")}` : null],
                      ["IPTU", raw.iptu ? `R$ ${Number(raw.iptu).toLocaleString("pt-BR")}` : null],
                      ["Endereço", raw.endereco],
                    ];
                    return extras
                      .filter(([, v]) => v !== null && v !== undefined && v !== "")
                      .map(([k, v]) => (
                        <div key={k}>
                          <div className="text-xs text-muted-foreground">{k}</div>
                          <div className="font-medium">{String(v)}</div>
                        </div>
                      ));
                  })()}
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" />
                      Onde está anunciado:
                      <b className="text-foreground">
                        {portalFromUrl(prop.url_anuncio) ?? prop.origem ?? "—"}
                      </b>
                    </div>
                    {prop.url_anuncio && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyText(prop.url_anuncio!, "Link")}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copiar link
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            window.open(prop.url_anuncio!, "_blank", "noopener")
                          }
                        >
                          <ExternalLink className="h-3 w-3 mr-1" /> Abrir anúncio
                        </Button>
                      </div>
                    )}
                  </div>
                  {prop.url_anuncio ? (
                    <a
                      href={prop.url_anuncio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-primary underline break-all"
                    >
                      {prop.url_anuncio}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Nenhum link de anúncio salvo para este proprietário.
                    </p>
                  )}
                </div>

                {prop.observacoes && (
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Observações da captação</div>
                    <div className="text-sm whitespace-pre-wrap">{prop.observacoes}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dados do proprietário */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" /> Dados do proprietário
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Nome</div>
                  <div className="font-medium">{prop.nome_proprietario ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Telefone
                  </div>
                  <div className="font-medium flex items-center gap-2">
                    {prop.telefone_e164 ?? prop.telefone ?? "—"}
                    {(prop.telefone_e164 ?? prop.telefone) && (
                      <button
                        onClick={() =>
                          copyText(prop.telefone_e164 ?? prop.telefone!, "Telefone")
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {prop.telefone_e164 && (
                    <a
                      href={`https://wa.me/${prop.telefone_e164.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Abrir no WhatsApp
                    </a>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> E-mail
                  </div>
                  <div className="font-medium">{prop.email ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Origem da captação</div>
                  <div className="font-medium">{prop.origem ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Republicações</div>
                  <div className="font-medium">{prop.republicacoes ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Último visto</div>
                  <div className="font-medium">
                    {prop.ultimo_visto_em
                      ? new Date(prop.ultimo_visto_em).toLocaleDateString("pt-BR")
                      : "—"}
                  </div>
                </div>
              </CardContent>
            </Card>


            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Contribuição por sinal
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {decomposicao?.rows.map((r) => (
                  <ContributionRow
                    key={r.key}
                    signalKey={r.key}
                    bonus={r.bonus}
                    signalValue={r.value}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" /> Linha do tempo
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    {timeline.length} eventos
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhum evento registrado para este proprietário ainda.
                  </p>
                ) : (
                  <ol className="relative border-l-2 border-muted ml-3 space-y-4">
                    {timeline.map((ev, i) => {
                      const meta = TIMELINE_META[ev.type];
                      const Icon = meta.icon;
                      const d = new Date(ev.at);
                      return (
                        <li key={i} className="ml-6">
                          <span
                            className={`absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ${meta.color} text-white ring-4 ${meta.ring}`}
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">
                                {ev.title}
                                {ev.meta && (
                                  <Badge variant="secondary" className="ml-2 text-[10px]">
                                    {ev.meta}
                                  </Badge>
                                )}
                              </div>
                              {ev.description && (
                                <div className="text-xs text-muted-foreground mt-0.5 break-words">
                                  {ev.description}
                                </div>
                              )}
                            </div>
                            <time className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {d.toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>



            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Evidências</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Primeiro visto
                  </div>
                  <div className="font-medium">
                    {prop.primeiro_visto_em
                      ? new Date(prop.primeiro_visto_em).toLocaleDateString(
                          "pt-BR"
                        )
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Preço atual
                  </div>
                  <div className="font-medium">
                    {prop.ultimo_preco ?? prop.preco
                      ? `R$ ${Number(
                          prop.ultimo_preco ?? prop.preco
                        ).toLocaleString("pt-BR")}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Score calculado em
                  </div>
                  <div className="font-medium">
                    {prop.motivacao_calculada_em
                      ? new Date(prop.motivacao_calculada_em).toLocaleString(
                          "pt-BR"
                        )
                      : "—"}
                  </div>
                </div>
                {Array.isArray(prop.historico_precos) &&
                  prop.historico_precos.length > 0 && (
                    <div className="md:col-span-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        Histórico de preços
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {prop.historico_precos.map((h: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {h.data
                              ? new Date(h.data).toLocaleDateString("pt-BR")
                              : `#${i + 1}`}{" "}
                            · R$ {Number(h.preco ?? 0).toLocaleString("pt-BR")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
