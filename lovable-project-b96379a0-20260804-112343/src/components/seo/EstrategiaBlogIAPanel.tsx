import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useConteudosSEO } from "@/hooks/useConteudosSEO";
import {
  Sparkles, Target, TrendingUp, Users, Search, Lightbulb,
  Loader2, Trash2, Plus, X, ListChecks, FileText, Wand2,
} from "lucide-react";
import ArtigoGeracaoProgress, { GeracaoState, StageKey } from "./ArtigoGeracaoProgress";

type Nicho = string;

interface AnaliseResultado {
  resumo?: string;
  tendencias?: { titulo: string; descricao: string; urgencia?: string }[];
  concorrentes?: { nome: string; abordagem: string; gap_oportunidade: string }[];
  keywords?: { termo: string; volume_estimado?: string; concorrencia?: string; intencao?: string }[];
  temas_prioritarios?: { tema: string; potencial_seo?: string; potencial_engajamento?: string; por_que?: string }[];
  riscos?: string[];
  proximos_passos?: string[];
}

interface Analise {
  id: string;
  nichos: Nicho[];
  topicos: string | null;
  resultado: AnaliseResultado;
  created_at: string;
}

interface Sugestao {
  id: string;
  titulo: string;
  angulo: string | null;
  formato: string | null;
  keyword_primaria: string | null;
  keywords_secundarias: string[];
  estrutura: { h2: string; bullets: string[] }[];
  publico_alvo: string | null;
  potencial_seo: string | null;
  potencial_engajamento: string | null;
  status: string;
  created_at: string;
}

const NICHOS_SUGERIDOS = [
  "Aluguel Residencial", "Venda de Apartamentos", "Alto Padrão", "Investimento Imobiliário",
  "Financiamento", "Primeira Compra", "Locação Comercial", "Terrenos", "Reforma", "Documentação",
  "Mercado DF", "Home Office", "Imóveis na Planta", "Permuta",
];

const badgeTone = (v?: string | null) => {
  const t = (v ?? "").toLowerCase();
  if (["alto", "alta"].includes(t)) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (["medio", "média", "media"].includes(t)) return "bg-amber-100 text-amber-800 border-amber-200";
  if (["baixo", "baixa"].includes(t)) return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
};

export default function EstrategiaBlogIAPanel() {
  const { user } = useAuth();
  const imobiliariaId = user?.id;

  const navigate = useNavigate();
  const { salvarConteudo } = useConteudosSEO();

  const [loading, setLoading] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [geracao, setGeracao] = useState<GeracaoState>({ open: false, stage: "preparando", startedAt: null, error: null });
  const [ultimaSugestao, setUltimaSugestao] = useState<Sugestao | null>(null);
  const updateStage = (stage: StageKey) => setGeracao((g) => ({ ...g, stage }));

  const [nichos, setNichos] = useState<Nicho[]>([]);
  const [topicos, setTopicos] = useState("");
  const [novoNicho, setNovoNicho] = useState("");
  const [quantidade, setQuantidade] = useState(8);

  const [analises, setAnalises] = useState<Analise[]>([]);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [analiseAtivaId, setAnaliseAtivaId] = useState<string | null>(null);

  const analiseAtiva = useMemo(
    () => analises.find((a) => a.id === analiseAtivaId) ?? analises[0] ?? null,
    [analises, analiseAtivaId],
  );

  useEffect(() => {
    if (!imobiliariaId) return;
    void carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imobiliariaId]);

  async function carregarTudo() {
    setLoading(true);
    try {
      const [{ data: cfg }, { data: an }, { data: su }] = await Promise.all([
        supabase.from("imobiliaria_config")
          .select("blog_nichos, blog_topicos")
          .eq("user_id", imobiliariaId!).maybeSingle(),
        (supabase.from("blog_analises_ia" as any) as any)
          .select("*").eq("imobiliaria_id", imobiliariaId!)
          .order("created_at", { ascending: false }).limit(20),
        (supabase.from("blog_sugestoes_ia" as any) as any)
          .select("*").eq("imobiliaria_id", imobiliariaId!)
          .order("created_at", { ascending: false }).limit(60),
      ]);
      const cfgNichos = Array.isArray((cfg as any)?.blog_nichos) ? ((cfg as any).blog_nichos as string[]) : [];
      setNichos(cfgNichos);
      setTopicos((cfg as any)?.blog_topicos ?? "");
      setAnalises((an ?? []) as unknown as Analise[]);
      setSugestoes((su ?? []) as unknown as Sugestao[]);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  function addNicho(v: string) {
    const t = v.trim();
    if (!t) return;
    if (nichos.some((n) => n.toLowerCase() === t.toLowerCase())) return;
    if (nichos.length >= 20) return toast.warning("Máximo de 20 nichos");
    setNichos([...nichos, t]);
    setNovoNicho("");
  }

  function removeNicho(v: string) {
    setNichos(nichos.filter((n) => n !== v));
  }

  async function salvarConfig() {
    if (!imobiliariaId) return;
    try {
      const { error } = await supabase.from("imobiliaria_config").upsert(
        { user_id: imobiliariaId, blog_nichos: nichos as any, blog_topicos: topicos },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      toast.success("Configuração salva");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? e));
    }
  }

  async function executar(action: "analisar" | "sugerir") {
    if (!nichos.length && !topicos.trim()) {
      toast.error("Defina ao menos um nicho ou descreva os tópicos.");
      return;
    }
    const setBusy = action === "analisar" ? setAnalisando : setSugerindo;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("blog-estrategia-ia", {
        body: {
          action,
          nichos,
          topicos,
          quantidade,
          analise_id: action === "sugerir" ? analiseAtiva?.id : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(action === "analisar" ? "Análise gerada" : "Sugestões geradas");
      await carregarTudo();
      if (action === "analisar" && (data as any)?.analise_id) {
        setAnaliseAtivaId((data as any).analise_id);
      }
    } catch (e: any) {
      toast.error("Falha na IA: " + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function apagarSugestao(id: string) {
    const { error } = await (supabase.from("blog_sugestoes_ia" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSugestoes(sugestoes.filter((s) => s.id !== id));
  }

  async function marcarSugestao(id: string, status: string) {
    const { error } = await (supabase.from("blog_sugestoes_ia" as any) as any).update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setSugestoes(sugestoes.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  async function gerarArtigoCompleto(s: Sugestao) {
    setGerandoId(s.id);
    setUltimaSugestao(s);
    setGeracao({ open: true, stage: "preparando", startedAt: Date.now(), error: null, titulo: s.titulo });
    try {
      const estruturaTxt = (s.estrutura ?? [])
        .map((sec, i) => `H2 ${i + 1}: ${sec.h2}${sec.bullets?.length ? "\n  - " + sec.bullets.join("\n  - ") : ""}`)
        .join("\n");
      const contexto = [
        s.angulo ? `Ângulo editorial: ${s.angulo}` : "",
        s.publico_alvo ? `Público-alvo: ${s.publico_alvo}` : "",
        s.keyword_primaria ? `Keyword primária: ${s.keyword_primaria}` : "",
        s.keywords_secundarias?.length ? `Keywords secundárias: ${s.keywords_secundarias.join(", ")}` : "",
        s.formato ? `Formato: ${s.formato}` : "",
        estruturaTxt ? `Siga esta estrutura sugerida:\n${estruturaTxt}` : "",
        "Otimize título, meta description e slug para SEO. Use linguagem natural, densidade equilibrada da keyword primária, escaneabilidade (listas, subtítulos) e CTAs sutis ao final.",
      ].filter(Boolean).join("\n\n");

      const tema = `${s.titulo}\n\n${contexto}`;

      updateStage("pesquisando");
      // pequeno atraso perceptível entre estágios para UX
      const t1 = setTimeout(() => updateStage("redigindo"), 4000);
      const t2 = setTimeout(() => updateStage("otimizando"), 30000);

      const { data, error } = await supabase.functions.invoke("gerar-conteudo-seo", {
        body: {
          tipo: "post_blog",
          dados: {
            tema,
            use_serper: true,
            options: {
              tamanho: "medio",
              pontoDeVista: "terceira_pessoa",
              tom: "Informativo e consultivo",
              citarFontes: true,
            },
          },
        },
      });
      clearTimeout(t1); clearTimeout(t2);
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.success === false) {
        throw new Error((data as any).message || "Falha ao gerar artigo");
      }

      updateStage("salvando");
      const result = (data as any).conteudo;
      const saved = await salvarConteudo({
        tipo: "post_blog",
        titulo: result?.titulo || s.titulo,
        conteudo: result,
      });
      if (!saved) throw new Error("Não foi possível salvar o rascunho");

      await marcarSugestao(s.id, "gerada");
      updateStage("concluido");
      toast.success("Artigo gerado e salvo como rascunho", {
        action: { label: "Abrir", onClick: () => navigate("/conteudo-seo") },
      });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setGeracao((g) => ({ ...g, error: msg }));
      toast.error("Falha ao gerar artigo");
    } finally {
      setGerandoId(null);
    }
  }



  return (
    <div className="space-y-6">
      {/* Configuração de Nichos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" /> Nicho & Tópicos do Blog
          </CardTitle>
          <CardDescription>
            Defina o(s) nicho(s) de mercado e temas centrais. A IA usa isso como base para análise e sugestões.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Nichos / Tags</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {nichos.map((n) => (
                <Badge key={n} variant="secondary" className="gap-1 pl-3 pr-1 py-1">
                  {n}
                  <button onClick={() => removeNicho(n)} className="ml-1 hover:bg-muted rounded p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {!nichos.length && <span className="text-xs text-muted-foreground">Nenhum nicho definido ainda.</span>}
            </div>
            <div className="flex gap-2">
              <Input
                value={novoNicho}
                onChange={(e) => setNovoNicho(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNicho(novoNicho); } }}
                placeholder="Ex.: Aluguel de alto padrão em Brasília"
                list="nichos-sug"
              />
              <datalist id="nichos-sug">
                {NICHOS_SUGERIDOS.map((s) => <option key={s} value={s} />)}
              </datalist>
              <Button type="button" variant="outline" onClick={() => addNicho(novoNicho)}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {NICHOS_SUGERIDOS.filter((s) => !nichos.includes(s)).slice(0, 8).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addNicho(s)}
                  className="text-xs px-2 py-1 rounded border border-dashed hover:bg-muted"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Tópicos livres (contexto adicional)</label>
            <Textarea
              value={topicos}
              onChange={(e) => setTopicos(e.target.value)}
              placeholder="Descreva público-alvo, região, diferenciais, temas que quer priorizar ou evitar..."
              rows={4}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={salvarConfig} variant="outline" disabled={loading}>Salvar configuração</Button>
            <Button onClick={() => executar("analisar")} disabled={analisando}>
              {analisando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Analisar nicho com IA
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-muted-foreground">Qtd. sugestões</label>
              <Input
                type="number" min={1} max={20}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value) || 8)}
                className="w-20"
              />
              <Button onClick={() => executar("sugerir")} disabled={sugerindo} variant="secondary">
                {sugerindo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-2" />}
                Gerar sugestões
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="analise" className="w-full">
        <TabsList>
          <TabsTrigger value="analise" className="gap-1.5"><TrendingUp className="w-4 h-4" />Análise</TabsTrigger>
          <TabsTrigger value="sugestoes" className="gap-1.5"><Lightbulb className="w-4 h-4" />Sugestões ({sugestoes.length})</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5"><ListChecks className="w-4 h-4" />Histórico ({analises.length})</TabsTrigger>
        </TabsList>

        {/* ANÁLISE */}
        <TabsContent value="analise" className="space-y-4">
          {!analiseAtiva && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Nenhuma análise ainda. Configure os nichos acima e clique em <b>Analisar nicho com IA</b>.
            </CardContent></Card>
          )}
          {analiseAtiva && (
            <>
              {analiseAtiva.resultado?.resumo && (
                <Card><CardContent className="pt-6">
                  <p className="text-sm leading-relaxed">{analiseAtiva.resultado.resumo}</p>
                </CardContent></Card>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" />Tendências</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {analiseAtiva.resultado?.tendencias?.map((t, i) => (
                      <div key={i} className="border-l-2 border-primary/40 pl-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{t.titulo}</span>
                          {t.urgencia && <Badge variant="outline" className={badgeTone(t.urgencia)}>{t.urgencia}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.descricao}</p>
                      </div>
                    )) ?? <p className="text-xs text-muted-foreground">—</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Concorrentes & Gaps</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {analiseAtiva.resultado?.concorrentes?.map((c, i) => (
                      <div key={i} className="text-sm">
                        <div className="font-medium">{c.nome}</div>
                        <div className="text-xs text-muted-foreground">{c.abordagem}</div>
                        <div className="text-xs text-emerald-700 mt-1">Gap: {c.gap_oportunidade}</div>
                      </div>
                    )) ?? <p className="text-xs text-muted-foreground">—</p>}
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Search className="w-4 h-4" />Palavras-chave</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground border-b">
                          <tr><th className="text-left py-2">Termo</th><th>Volume</th><th>Concorrência</th><th>Intenção</th></tr>
                        </thead>
                        <tbody>
                          {analiseAtiva.resultado?.keywords?.map((k, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-1.5">{k.termo}</td>
                              <td className="text-center"><Badge variant="outline" className={badgeTone(k.volume_estimado)}>{k.volume_estimado}</Badge></td>
                              <td className="text-center"><Badge variant="outline" className={badgeTone(k.concorrencia === "baixa" ? "alto" : k.concorrencia === "alta" ? "baixo" : "medio")}>{k.concorrencia}</Badge></td>
                              <td className="text-center text-xs">{k.intencao}</td>
                            </tr>
                          )) ?? <tr><td colSpan={4} className="py-3 text-center text-xs text-muted-foreground">—</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" />Temas prioritários</CardTitle></CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-3">
                    {analiseAtiva.resultado?.temas_prioritarios?.map((t, i) => (
                      <div key={i} className="border rounded p-3">
                        <div className="font-medium text-sm mb-1">{t.tema}</div>
                        <div className="flex gap-1.5 mb-1">
                          {t.potencial_seo && <Badge variant="outline" className={badgeTone(t.potencial_seo)}>SEO: {t.potencial_seo}</Badge>}
                          {t.potencial_engajamento && <Badge variant="outline" className={badgeTone(t.potencial_engajamento)}>Eng.: {t.potencial_engajamento}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.por_que}</p>
                      </div>
                    )) ?? <p className="text-xs text-muted-foreground">—</p>}
                  </CardContent>
                </Card>

                {!!analiseAtiva.resultado?.proximos_passos?.length && (
                  <Card className="md:col-span-2">
                    <CardHeader><CardTitle className="text-base">Próximos passos</CardTitle></CardHeader>
                    <CardContent><ul className="list-disc pl-5 text-sm space-y-1">
                      {analiseAtiva.resultado.proximos_passos.map((p, i) => <li key={i}>{p}</li>)}
                    </ul></CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* SUGESTÕES */}
        <TabsContent value="sugestoes" className="space-y-3">
          {!sugestoes.length && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Nenhuma sugestão ainda. Clique em <b>Gerar sugestões</b> acima.
            </CardContent></Card>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {sugestoes.map((s) => (
              <Card key={s.id} className={s.status === "descartada" ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{s.titulo}</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => apagarSugestao(s.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {s.formato && <Badge variant="outline">{s.formato}</Badge>}
                    {s.potencial_seo && <Badge variant="outline" className={badgeTone(s.potencial_seo)}>SEO {s.potencial_seo}</Badge>}
                    {s.potencial_engajamento && <Badge variant="outline" className={badgeTone(s.potencial_engajamento)}>Eng. {s.potencial_engajamento}</Badge>}
                    {s.status !== "nova" && <Badge>{s.status}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {s.angulo && <p className="text-xs text-muted-foreground italic">{s.angulo}</p>}
                  {s.keyword_primaria && (
                    <div className="text-xs">
                      <span className="font-medium">KW primária: </span>
                      <Badge variant="secondary">{s.keyword_primaria}</Badge>
                      {s.keywords_secundarias?.map((k) => (
                        <Badge key={k} variant="outline" className="ml-1">{k}</Badge>
                      ))}
                    </div>
                  )}
                  {!!s.estrutura?.length && (
                    <details>
                      <summary className="text-xs cursor-pointer text-primary flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Estrutura ({s.estrutura.length} seções)
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs">
                        {s.estrutura.map((sec, i) => (
                          <li key={i}>
                            <div className="font-medium">{sec.h2}</div>
                            <ul className="list-disc pl-4 text-muted-foreground">
                              {sec.bullets?.map((b, j) => <li key={j}>{b}</li>)}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {s.publico_alvo && <p className="text-xs"><b>Público:</b> {s.publico_alvo}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => gerarArtigoCompleto(s)}
                      disabled={gerandoId === s.id}
                      className="gap-1.5"
                    >
                      {gerandoId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      Gerar artigo completo
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => marcarSugestao(s.id, "aprovada")}>Aprovar</Button>
                    <Button size="sm" variant="ghost" onClick={() => marcarSugestao(s.id, "descartada")}>Descartar</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico" className="space-y-2">
          {analises.map((a) => (
            <Card key={a.id} className={analiseAtiva?.id === a.id ? "border-primary" : ""}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{new Date(a.created_at).toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground">{(a.nichos ?? []).join(", ") || "—"}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setAnaliseAtivaId(a.id)}>Ver</Button>
              </CardContent>
            </Card>
          ))}
          {!analises.length && <p className="text-sm text-muted-foreground py-6 text-center">Sem histórico ainda.</p>}
        </TabsContent>
      </Tabs>

      <ArtigoGeracaoProgress
        state={geracao}
        onClose={() => setGeracao((g) => ({ ...g, open: false }))}
        onRetry={ultimaSugestao ? () => gerarArtigoCompleto(ultimaSugestao) : undefined}
      />
    </div>
  );
}
