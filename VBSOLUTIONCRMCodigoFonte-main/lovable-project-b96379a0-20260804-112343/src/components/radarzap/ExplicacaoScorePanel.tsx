import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Info,
  Lightbulb,
} from "lucide-react";

type Lead = {
  id: string;
  mensagem_id: string | null;
  score: number;
  score_detalhes: Record<string, number> | null;
  is_principal: boolean;
  status: string;
  operacao: string | null;
  tipo_imovel: string | null;
  contato: string | null;
  bairro: string | null;
  cidade: string | null;
  preco: number | null;
  proprietario_nome: string | null;
  resumo: string | null;
  created_at: string;
};

type Msg = {
  id: string;
  texto: string;
  intencao: string | null;
  score_intencao: number | null;
  tem_imovel: boolean | null;
  extraido: any;
};

type Cfg = {
  peso_operacao: number;
  peso_contato_bom: number;
  peso_contato_parcial: number;
  peso_preco: number;
  peso_bairro: number;
  peso_cidade: number;
  peso_proprietario: number;
  peso_tipo: number;
  min_score_principal: number;
};

const DEFAULT_CFG: Cfg = {
  peso_operacao: 30,
  peso_contato_bom: 25,
  peso_contato_parcial: 10,
  peso_preco: 15,
  peso_bairro: 15,
  peso_cidade: 7,
  peso_proprietario: 10,
  peso_tipo: 5,
  min_score_principal: 40,
};

// Sinais por categoria — palavras/regex que provocam pontuação
const SINAIS: {
  key: keyof Cfg | "operacao" | "contato" | "preco" | "bairro" | "cidade" | "proprietario" | "tipo";
  label: string;
  cor: string; // classe tailwind bg para o highlight
  padroes: (l: Lead) => Array<RegExp | string>;
}[] = [
  {
    key: "operacao",
    label: "Operação",
    cor: "bg-emerald-200/70 dark:bg-emerald-800/50",
    padroes: () => [
      /\bvend[oa]?\b/gi,
      /\bvenda\b/gi,
      /\balug[ao]\b/gi,
      /\balugue?l\b/gi,
      /\blocacao\b/gi,
      /\bloca[cç][aã]o\b/gi,
      /\btemporada\b/gi,
      /\bpasso\s+ponto\b/gi,
    ],
  },
  {
    key: "contato",
    label: "Contato / telefone",
    cor: "bg-sky-200/70 dark:bg-sky-800/50",
    padroes: () => [
      /(\+?55\s?)?(\(?\d{2}\)?\s?)?9?\d{4}[-\s.]?\d{4}/g,
      /\bwhats?(app)?\b/gi,
      /\bzap\b/gi,
      /\bcontato\b/gi,
    ],
  },
  {
    key: "preco",
    label: "Preço",
    cor: "bg-amber-200/70 dark:bg-amber-800/50",
    padroes: () => [
      /r\$\s?[\d.,]+/gi,
      /\b\d{2,3}\s?(mil|k)\b/gi,
      /\b\d+(\.\d{3})+(,\d{2})?\b/g,
      /\bvalor\b/gi,
    ],
  },
  {
    key: "bairro",
    label: "Bairro",
    cor: "bg-fuchsia-200/70 dark:bg-fuchsia-800/50",
    padroes: (l) => (l.bairro ? [new RegExp(`\\b${escapeReg(l.bairro)}\\b`, "gi")] : []),
  },
  {
    key: "cidade",
    label: "Cidade",
    cor: "bg-indigo-200/70 dark:bg-indigo-800/50",
    padroes: (l) => (l.cidade && !l.bairro ? [new RegExp(`\\b${escapeReg(l.cidade)}\\b`, "gi")] : []),
  },
  {
    key: "tipo",
    label: "Tipo do imóvel",
    cor: "bg-teal-200/70 dark:bg-teal-800/50",
    padroes: (l) => {
      const tipos = [
        "apartamento",
        "apto",
        "ap ",
        "casa",
        "sobrado",
        "kitnet",
        "kit ",
        "studio",
        "loft",
        "cobertura",
        "sala",
        "loja",
        "galpao",
        "galpão",
        "terreno",
        "lote",
        "chacara",
        "chácara",
        "sitio",
        "sítio",
        "flat",
      ];
      const arr = tipos.map((t) => new RegExp(`\\b${escapeReg(t.trim())}\\b`, "gi"));
      if (l.tipo_imovel) arr.push(new RegExp(`\\b${escapeReg(l.tipo_imovel)}\\b`, "gi"));
      return arr;
    },
  },
  {
    key: "proprietario",
    label: "Proprietário",
    cor: "bg-rose-200/70 dark:bg-rose-800/50",
    padroes: (l) => [/\bpropriet[aá]rio\b/gi, /\bdono\b/gi, ...(l.proprietario_nome ? [new RegExp(`\\b${escapeReg(l.proprietario_nome)}\\b`, "gi")] : [])],
  },
];

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Hit = { start: number; end: number; sinal: (typeof SINAIS)[number] };

function encontrarHits(texto: string, lead: Lead): Hit[] {
  const hits: Hit[] = [];
  for (const s of SINAIS) {
    for (const p of s.padroes(lead)) {
      const re = typeof p === "string" ? new RegExp(escapeReg(p), "gi") : p;
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(texto)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        hits.push({ start: m.index, end: m.index + m[0].length, sinal: s });
        if (!re.global) break;
      }
    }
  }
  // remove sobreposições — mantém o primeiro
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const limpos: Hit[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue;
    limpos.push(h);
    cursor = h.end;
  }
  return limpos;
}

function TextoRealcado({ texto, lead }: { texto: string; lead: Lead }) {
  const hits = useMemo(() => encontrarHits(texto, lead), [texto, lead]);
  if (!hits.length) return <span className="whitespace-pre-wrap">{texto}</span>;
  const partes: React.ReactNode[] = [];
  let idx = 0;
  hits.forEach((h, i) => {
    if (h.start > idx) partes.push(<span key={`t${i}`}>{texto.slice(idx, h.start)}</span>);
    partes.push(
      <mark
        key={`m${i}`}
        className={`${h.sinal.cor} rounded px-0.5`}
        title={h.sinal.label}
      >
        {texto.slice(h.start, h.end)}
      </mark>,
    );
    idx = h.end;
  });
  if (idx < texto.length) partes.push(<span key="tail">{texto.slice(idx)}</span>);
  return <span className="whitespace-pre-wrap leading-relaxed">{partes}</span>;
}

const FATOR_LABEL: Record<string, string> = {
  operacao: "Operação (venda/aluguel/temporada declarada)",
  contato: "Telefone/WhatsApp identificado",
  preco: "Preço presente na mensagem",
  bairro: "Bairro identificado",
  cidade: "Cidade identificada (sem bairro)",
  proprietario: "Nome do proprietário identificado",
  tipo: "Tipo do imóvel identificado",
};

const FATOR_PESO_MAX = (k: string, c: Cfg) =>
  ({
    operacao: c.peso_operacao,
    contato: c.peso_contato_bom,
    preco: c.peso_preco,
    bairro: c.peso_bairro,
    cidade: c.peso_cidade,
    proprietario: c.peso_proprietario,
    tipo: c.peso_tipo,
  } as Record<string, number>)[k] || 0;

export default function ExplicacaoScorePanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [mensagens, setMensagens] = useState<Record<string, Msg>>({});
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: leadsData, error: e1 }, { data: cfgData }] = await Promise.all([
        supabase
          .from("radarzap_leads")
          .select(
            "id,mensagem_id,score,score_detalhes,is_principal,status,operacao,tipo_imovel,contato,bairro,cidade,preco,proprietario_nome,resumo,created_at",
          )
          .eq("imobiliaria_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("radarzap_scoring_config")
          .select("*")
          .eq("imobiliaria_id", user.id)
          .maybeSingle(),
      ]);
      if (e1) throw e1;
      const ls = (leadsData as Lead[]) || [];
      setLeads(ls);
      if (cfgData) setCfg({ ...DEFAULT_CFG, ...(cfgData as any) });

      const ids = ls.map((l) => l.mensagem_id).filter(Boolean) as string[];
      if (ids.length) {
        const { data: msgs } = await supabase
          .from("radarzap_mensagens")
          .select("id,texto,intencao,score_intencao,tem_imovel,extraido")
          .in("id", ids);
        const map: Record<string, Msg> = {};
        (msgs || []).forEach((m: any) => (map[m.id] = m));
        setMensagens(map);
      } else {
        setMensagens({});
      }
    } catch (e: any) {
      toast.error("Falha ao carregar", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const m = l.mensagem_id ? mensagens[l.mensagem_id] : null;
      return (
        (l.proprietario_nome || "").toLowerCase().includes(q) ||
        (l.contato || "").toLowerCase().includes(q) ||
        (l.bairro || "").toLowerCase().includes(q) ||
        (l.cidade || "").toLowerCase().includes(q) ||
        (m?.texto || "").toLowerCase().includes(q)
      );
    });
  }, [leads, mensagens, busca]);

  const toggle = (id: string) =>
    setAberto((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" /> Explicação do Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Veja a mensagem original que originou cada lead com os sinais destacados e entenda
            exatamente por que ela recebeu determinada pontuação e classificação.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome, contato, bairro, cidade ou trecho da mensagem…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button size="sm" variant="outline" onClick={carregar} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {SINAIS.map((s) => (
              <span key={s.key} className={`px-2 py-0.5 rounded ${s.cor}`}>
                {s.label}
              </span>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Mínimo para virar principal e ir ao pipeline: <b>{cfg.min_score_principal}</b>.
          </div>
        </CardContent>
      </Card>

      {loading && leads.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 inline animate-spin mr-2" /> Carregando…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum lead encontrado.
          </CardContent>
        </Card>
      )}

      {filtered.map((l) => {
        const msg = l.mensagem_id ? mensagens[l.mensagem_id] : null;
        const det = l.score_detalhes || {};
        const passou = l.score >= cfg.min_score_principal;
        const isOpen = aberto.has(l.id);
        const contribuicoes = Object.entries(det)
          .filter(([, v]) => Number(v) > 0)
          .sort((a, b) => Number(b[1]) - Number(a[1]));
        const topFator = contribuicoes[0];
        return (
          <Card key={l.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {l.proprietario_nome || "Sem nome"}
                    </span>
                    <Badge variant="outline">{l.status}</Badge>
                    <Badge className={passou ? "bg-emerald-600" : "bg-amber-600"}>
                      {passou ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      score {l.score} / mín {cfg.min_score_principal}
                    </Badge>
                    {msg?.score_intencao != null && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3" /> Intenção IA: {msg.score_intencao}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                    <span>{l.operacao || "—"} · {l.tipo_imovel || "—"}</span>
                    <span>{l.bairro || "—"}{l.cidade ? ` · ${l.cidade}` : ""}</span>
                    <span>Contato: {l.contato || "—"}</span>
                    {topFator && (
                      <span>
                        Principal sinal: <b>{FATOR_LABEL[topFator[0]] || topFator[0]}</b> (+{topFator[1]})
                      </span>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toggle(l.id)}>
                  {isOpen ? "Ocultar" : "Explicar"}
                </Button>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs font-medium mb-1 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Mensagem original com sinais destacados
                  </div>
                  <div className="rounded border bg-muted/40 p-3 text-sm">
                    {msg?.texto ? (
                      <TextoRealcado texto={msg.texto} lead={l} />
                    ) : (
                      <span className="text-muted-foreground italic">
                        Mensagem original indisponível (lead pode ter sido importado sem mensagem
                        de origem).
                      </span>
                    )}
                  </div>
                  {msg?.tem_imovel === false && (
                    <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <Info className="h-3 w-3" /> A IA não detectou imóvel nesta mensagem.
                    </div>
                  )}
                  {l.resumo && (
                    <div className="text-xs text-muted-foreground mt-2">
                      <b>Resumo da IA:</b> {l.resumo}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-medium mb-1">
                    Composição do score — o que mais influenciou
                  </div>
                  <div className="space-y-1.5">
                    {contribuicoes.length === 0 && (
                      <div className="text-xs text-muted-foreground">
                        Nenhum fator pontuou. Faltam dados-chave (operação, contato, preço,
                        localização).
                      </div>
                    )}
                    {contribuicoes.map(([k, v]) => {
                      const max = FATOR_PESO_MAX(k, cfg);
                      const pct = max ? Math.min(100, (Number(v) / max) * 100) : 0;
                      return (
                        <div key={k} className="text-xs">
                          <div className="flex items-center justify-between">
                            <span>{FATOR_LABEL[k] || k}</span>
                            <span className="text-emerald-600">+{v} / {max}</span>
                          </div>
                          <Progress value={pct} className="h-1.5 mt-0.5" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t pt-2 text-xs">
                  <div className="font-medium mb-1 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Decisão de qualificação
                  </div>
                  <div className={passou ? "text-emerald-700" : "text-amber-700"}>
                    {passou
                      ? l.is_principal
                        ? "✓ Score suficiente e este é o registro principal do grupo — enviado ao pipeline de captação."
                        : "Score suficiente, mas outro registro do mesmo grupo tem score maior — tratado como sinal duplicado."
                      : `✗ Score ${l.score} abaixo do mínimo ${cfg.min_score_principal} — permanece em Leads/Aprovações e não vira card no pipeline.`}
                  </div>
                  {!passou && (
                    <div className="text-muted-foreground mt-1">
                      Para subir o score, garanta que a mensagem contenha:{" "}
                      {[
                        !det.operacao && "operação (venda/aluguel)",
                        !det.contato && "telefone/WhatsApp",
                        !det.preco && "preço",
                        !det.bairro && !det.cidade && "bairro ou cidade",
                        !det.tipo && "tipo do imóvel",
                      ]
                        .filter(Boolean)
                        .join(", ") || "mais sinais qualificados"}
                      .
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
