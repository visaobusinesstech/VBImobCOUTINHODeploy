import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Globe, Facebook, FileText, AlertTriangle, Pencil, Save, RotateCcw, Loader2, Link2, Send, XCircle, ListChecks, Sparkles, Wand2, Search, History, Tag, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { SeoOnPageChecklist } from "./SeoOnPageChecklist";
import { CopyButton } from "./CopyButton";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { KeywordsSuggestPanel } from "./KeywordsSuggestPanel";
import { computeSeoChecks, getCriticalChecks } from "@/lib/seoChecklist";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PreviewPostDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  post: any | null;
  brandName?: string;
  baseUrl?: string;
  /** Se fornecido, mostra botão "Salvar" que persiste as alterações do editor. */
  onSave?: (patch: { titulo: string; slug: string; meta_description: string }) => Promise<void> | void;
  /** Se fornecido, mostra botão de publicar/despublicar direto no dialog. */
  onTogglePublish?: (novoStatus: "publicado" | "rascunho") => Promise<void> | void;
}

function slugify(txt: string) {
  return (txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function len(s?: string) { return (s || "").length; }
function lenBadge(current: number, ideal: [number, number]) {
  const [min, max] = ideal;
  if (current === 0) return { variant: "outline" as const, label: "vazio" };
  if (current < min) return { variant: "outline" as const, label: `curto (${current})` };
  if (current > max) return { variant: "destructive" as const, label: `longo (${current})` };
  return { variant: "default" as const, label: `ok (${current})` };
}

/**
 * Gera uma meta description a partir do título + contexto do post (introdução/1ª seção).
 * Fica entre 120–160 caracteres sempre que possível.
 */
function generateMetaFromTitle(titulo: string, contexto?: { introducao?: string; secoes?: Array<{ conteudo?: string }>; tags?: string[] }) {
  const t = (titulo || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const intro = (contexto?.introducao || contexto?.secoes?.[0]?.conteudo || "")
    .replace(/\s+/g, " ")
    .trim();
  const tagsStr = (contexto?.tags || []).slice(0, 3).join(", ");
  const base = intro
    ? `${t}. ${intro}`
    : tagsStr
      ? `${t}. Guia prático sobre ${tagsStr} — dicas, exemplos e o que você precisa saber.`
      : `${t}. Guia completo com dicas práticas, exemplos reais e o que você precisa saber antes de decidir.`;
  const clean = base.replace(/\s+/g, " ").trim();
  if (clean.length <= 158) return clean;
  const cut = clean.slice(0, 157);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 120 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?-]+$/, "") + "…";
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeForMatch(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
/** Divide `text` em partes marcando os trechos que casam com qualquer termo em `terms` (acento-insensível). */
function highlightParts(text: string, terms: string[]): Array<{ text: string; match: boolean }> {
  const cleaned = terms.map((t) => t.trim()).filter((t) => t.length >= 2);
  if (!text || cleaned.length === 0) return [{ text: text || "", match: false }];
  const normText = normalizeForMatch(text);
  const pattern = new RegExp(cleaned.map((t) => escapeRegex(normalizeForMatch(t))).join("|"), "gi");
  const out: Array<{ text: string; match: boolean }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(normText)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), match: false });
    out.push({ text: text.slice(m.index, m.index + m[0].length), match: true });
    last = m.index + m[0].length;
    if (m[0].length === 0) pattern.lastIndex++;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out;
}
function Highlighted({ text, terms, boldClass = "font-semibold text-[#202124]" }: { text: string; terms: string[]; boldClass?: string }) {
  const parts = highlightParts(text, terms);
  return (
    <>
      {parts.map((p, i) => (p.match ? <mark key={i} className={`bg-yellow-100 rounded-sm px-0.5 ${boldClass}`}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  );
}
/** Barra de progresso com faixa ideal (verde), zonas curta/longa (âmbar/vermelho). */
function LengthMeter({ current, min, max, hardMax, unit = "chars" }: { current: number; min: number; max: number; hardMax?: number; unit?: string }) {
  const cap = hardMax ?? Math.max(max + 40, Math.round(max * 1.4));
  const pct = Math.min(100, (current / cap) * 100);
  const state: "empty" | "short" | "ok" | "over" | "hard" =
    current === 0 ? "empty" : current < min ? "short" : current <= max ? "ok" : hardMax && current > hardMax ? "hard" : "over";
  const color =
    state === "ok" ? "bg-emerald-500" :
    state === "short" ? "bg-amber-500" :
    state === "over" ? "bg-orange-500" :
    state === "hard" ? "bg-red-500" : "bg-slate-300";
  const label =
    state === "empty" ? "vazio" :
    state === "short" ? `curto — faltam ${min - current}` :
    state === "ok" ? "tamanho ideal ✓" :
    state === "over" ? `acima do ideal (+${current - max})` :
    `pode ser cortado no Google (+${current - (hardMax ?? max)})`;
  const idealStart = (min / cap) * 100;
  const idealWidth = ((max - min) / cap) * 100;
  return (
    <div className="space-y-1">
      <div className="relative h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="absolute top-0 h-full bg-emerald-100" style={{ left: `${idealStart}%`, width: `${idealWidth}%` }} />
        <div className={`absolute top-0 left-0 h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{current} {unit} · ideal {min}–{max}{hardMax ? ` (Google corta em ~${hardMax})` : ""}</span>
        <span className={
          state === "ok" ? "text-emerald-600 font-medium" :
          state === "hard" ? "text-red-600 font-medium" :
          state === "over" ? "text-orange-600" :
          state === "short" ? "text-amber-600" : ""
        }>{label}</span>
      </div>
    </div>
  );
}



export function PreviewPostDialog({ open, onOpenChange, post, brandName, baseUrl, onSave, onTogglePublish }: PreviewPostDialogProps) {
  const site = baseUrl || (typeof window !== "undefined" ? window.location.origin : "https://radarimobtech.shop");

  const original = useMemo(() => {
    if (!post) return null;
    const c = post.conteudo || {};
    const titulo = post.titulo || c.titulo || c.title || "";
    const slug = post.slug || slugify(titulo);
    const meta = post.meta_description || c.meta_description || c.metaDescription || c.introducao?.slice(0, 155) || "";
    const introducao = c.introducao || c.descricao_curta || "";
    const secoes: Array<{ titulo?: string; conteudo?: string }> = Array.isArray(c.secoes) ? c.secoes : [];
    const conclusao = c.conclusao || c.cta || "";
    const tags: string[] = Array.isArray(c.tags) ? c.tags : Array.isArray(c.palavras_chave) ? c.palavras_chave : [];
    const fontes: Array<{ nome?: string; autor?: string; url?: string; tipo?: string; licenca?: string }> = Array.isArray(c.fontes) ? c.fontes : [];
    const creditos_imagens: Array<{ descricao?: string; autor?: string; fonte?: string; url?: string; licenca?: string }> = Array.isArray(c.creditos_imagens) ? c.creditos_imagens : [];
    return { titulo, slug, meta, introducao, secoes, conclusao, tags, fontes, creditos_imagens };
  }, [post]);

  const { user } = useAuth();
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [meta, setMeta] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [bloquearCritico, setBloquearCritico] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const { data } = await supabase
        .from("conteudo_seo_autopublish_config" as any)
        .select("bloquear_publicacao_seo_critico")
        .eq("imobiliaria_id", user.id)
        .maybeSingle();
      setBloquearCritico(Boolean((data as any)?.bloquear_publicacao_seo_critico));
    })();
  }, [user, open]);

  useEffect(() => {
    if (!original) return;
    setTitulo(original.titulo);
    setSlug(original.slug);
    setMeta(original.meta);
    setSlugTouched(false);
  }, [original]);

  // Auto-slug from title while user hasn't manually touched the slug
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(titulo));
  }, [titulo, slugTouched]);

  if (!post || !original) return null;

  const url = `${site.replace(/\/$/, "")}/blog/${slug}`;
  const titleBadge = lenBadge(len(titulo), [30, 60]);
  const metaBadge = lenBadge(len(meta), [120, 160]);
  const slugBadge = lenBadge(len(slug), [3, 75]);

  // Termos destacados no SERP: usa o termo digitado (separado por espaço/vírgula) OU
  // as tags do post como fallback, para simular como o Google emphasiza a query.
  const highlightTerms = useMemo(() => {
    const manual = searchTerm
      .split(/[,;]+|\s{2,}/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
    if (manual.length > 0) return manual;
    return (original.tags || []).slice(0, 4);
  }, [searchTerm, original.tags]);

  const dirty =
    titulo !== original.titulo ||
    slug !== original.slug ||
    meta !== original.meta;

  const criticalChecks = useMemo(
    () => getCriticalChecks(computeSeoChecks({
      titulo, slug, meta,
      introducao: original.introducao,
      conclusao: original.conclusao,
      secoes: original.secoes,
      tags: original.tags,
    })),
    [titulo, slug, meta, original.introducao, original.conclusao, original.secoes, original.tags]
  );
  const publishBlockedByCritico = bloquearCritico && criticalChecks.length > 0;

  const reset = () => {
    setTitulo(original.titulo);
    setSlug(original.slug);
    setMeta(original.meta);
    setSlugTouched(false);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ titulo, slug, meta_description: meta });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Preview do post
          </DialogTitle>
          <DialogDescription>
            Ajuste título, meta description e slug — a pré-visualização abaixo atualiza em tempo real.
          </DialogDescription>
        </DialogHeader>

        {/* Editor */}
        <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Pencil className="w-3.5 h-3.5" /> Editor
              {dirty && <Badge variant="outline" className="text-[10px]">alterações não salvas</Badge>}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5"
              disabled={!titulo.trim() || saving || publishing}
              title="Regenerar slug e meta description a partir do título atual"
              onClick={() => {
                const novoSlug = slugify(titulo);
                const novaMeta = generateMetaFromTitle(titulo, {
                  introducao: original.introducao,
                  secoes: original.secoes,
                  tags: original.tags,
                });
                setSlug(novoSlug);
                setSlugTouched(false);
                setMeta(novaMeta);
                toast.success("Slug e meta description regenerados a partir do título.");
              }}
            >
              <Wand2 className="w-3.5 h-3.5" />
              Regenerar slug + meta
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pv-titulo" className="text-xs">Título</Label>
              <div className="flex items-center gap-2">
                <Badge variant={titleBadge.variant} className="text-[10px]">{titleBadge.label} · ideal 30–60</Badge>
                <CopyButton value={titulo} label="Título" />
              </div>
            </div>
            <Input
              id="pv-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título do post"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pv-slug" className="text-xs flex items-center gap-1"><Link2 className="w-3 h-3" /> Slug</Label>
              <div className="flex items-center gap-2">
                <Badge variant={slugBadge.variant} className="text-[10px]">{slugBadge.label}</Badge>
                {slugTouched && (
                  <button
                    type="button"
                    onClick={() => setSlugTouched(false)}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                    title="Voltar a gerar automaticamente do título"
                  >
                    auto do título
                  </button>
                )}
                <CopyButton value={slug} label="Slug" />
                <CopyButton value={url} label="URL completa" buttonText="URL" />
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
              <span className="pl-2 text-xs text-muted-foreground select-none">/blog/</span>
              <Input
                id="pv-slug"
                value={slug}
                onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                placeholder="meu-post"
                className="h-9 border-0 focus-visible:ring-0 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pv-meta" className="text-xs">Meta description</Label>
              <div className="flex items-center gap-2">
                <Badge variant={metaBadge.variant} className="text-[10px]">{metaBadge.label} · ideal 120–160</Badge>
                <CopyButton value={meta} label="Meta description" />
              </div>
            </div>
            <Textarea
              id="pv-meta"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Resumo persuasivo mostrado no Google e nas redes sociais."
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </div>

        {publishBlockedByCritico && (
          <div className="mt-3 rounded-lg border-2 border-red-300 bg-red-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-red-800 text-sm">
                  Publicação bloqueada — {criticalChecks.length} problema(s) crítico(s) de SEO
                </div>
                <div className="text-xs text-red-700 mt-0.5">
                  Corrija os itens abaixo (ou desative o bloqueio em <strong>Configurações → Publicação automática</strong>) para liberar a publicação.
                </div>
              </div>
            </div>
            <ul className="space-y-2 pl-1">
              {criticalChecks.map((c) => (
                <li key={c.id} className="rounded-md border border-red-200 bg-white p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-red-900">{c.titulo}</span>
                    <Badge variant="outline" className="text-[10px] text-red-700 border-red-300">{c.categoria}</Badge>
                  </div>
                  <div className="text-xs text-red-800/80 mt-1 ml-5">{c.detalhe}</div>
                  <div className="text-xs text-red-900 mt-1 ml-5">→ {c.recomendacao}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Tabs defaultValue="google" className="mt-2">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="google" className="gap-1.5"><Globe className="w-3.5 h-3.5" /> Google</TabsTrigger>
            <TabsTrigger value="social" className="gap-1.5"><Facebook className="w-3.5 h-3.5" /> Social</TabsTrigger>
            <TabsTrigger value="post" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Post</TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1.5"><ListChecks className="w-3.5 h-3.5" /> Checklist</TabsTrigger>
            <TabsTrigger value="keywords" className="gap-1.5"><Tag className="w-3.5 h-3.5" /> Keywords</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5"><History className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
          </TabsList>

          {/* Google SERP */}
          <TabsContent value="google" className="pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Prévia do resultado no Google</span>
              <CopyButton
                value={`${titulo}\n${url}\n${meta || original.introducao?.slice(0, 160) || ""}`}
                label="Snippet do Google"
                buttonText="Copiar snippet"
                variant="outline"
                size="sm"
              />
            </div>

            {/* Simulação de query de busca */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
              <Label htmlFor="pv-serp-query" className="text-xs flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Simule uma busca (opcional)
              </Label>
              <div className="flex items-center gap-1 rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
                <Search className="w-3.5 h-3.5 text-muted-foreground ml-2" />
                <Input
                  id="pv-serp-query"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={original.tags?.length ? `Ex.: ${original.tags.slice(0, 2).join(", ")}` : "Ex.: apartamento à venda em Águas Claras"}
                  className="h-8 border-0 focus-visible:ring-0 text-xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="text-[10px] text-muted-foreground hover:text-foreground pr-2"
                    title="Limpar"
                  >
                    limpar
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {searchTerm.trim()
                  ? <>Destacando <strong>{highlightTerms.length}</strong> termo(s) no snippet abaixo (como o Google faz na busca real).</>
                  : original.tags?.length
                    ? <>Sem termo digitado — destacando as <strong>tags</strong> do post como pré-visualização.</>
                    : <>Digite palavras-chave para ver como o Google destacaria o snippet.</>}
              </p>
            </div>

            {/* SERP simulado */}
            <div className="rounded-lg border bg-white p-4 max-w-[600px]">
              <div className="text-xs text-[#202124] flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                  {(brandName || "R").charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <div className="font-medium">{brandName || "radarimobtech"}</div>
                  <div className="text-[#4d5156]">
                    <Highlighted text={url} terms={highlightTerms} boldClass="font-semibold text-[#202124]" />
                  </div>
                </div>
              </div>
              <h3 className="text-[#1a0dab] text-xl leading-snug mt-1 hover:underline cursor-pointer">
                <Highlighted text={titulo || "Título do post"} terms={highlightTerms} boldClass="font-bold text-[#1a0dab]" />
              </h3>
              <p className="text-sm text-[#4d5156] mt-1">
                <Highlighted
                  text={meta || original.introducao?.slice(0, 160) || "Adicione uma meta description para melhor performance no Google."}
                  terms={highlightTerms}
                  boldClass="font-semibold text-[#202124]"
                />
              </p>
            </div>

            {/* Contadores ideais */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5" /> Contagem ideal de caracteres
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] font-medium mb-1">Título</div>
                  <LengthMeter current={len(titulo)} min={30} max={60} hardMax={70} />
                </div>
                <div>
                  <div className="text-[11px] font-medium mb-1">Meta description</div>
                  <LengthMeter current={len(meta)} min={120} max={160} hardMax={165} />
                </div>
                <div>
                  <div className="text-[11px] font-medium mb-1">Slug (URL)</div>
                  <LengthMeter current={len(slug)} min={3} max={75} />
                </div>
              </div>
            </div>

            {len(meta) === 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                Meta description vazia — o Google vai gerar um trecho automático, que pode não vender bem o post.
              </div>
            )}
            {highlightTerms.length > 0 && !highlightTerms.some((t) => normalizeForMatch(`${titulo} ${meta} ${url}`).includes(normalizeForMatch(t))) && (
              <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                Nenhum dos termos ({highlightTerms.join(", ")}) aparece no título, meta ou URL — considere incluir para melhorar o ranqueamento.
              </div>
            )}
          </TabsContent>

          {/* Social */}
          <TabsContent value="social" className="pt-4">
            <div className="flex items-center justify-between mb-2 max-w-[500px]">
              <span className="text-xs text-muted-foreground">Prévia Open Graph (Facebook/LinkedIn)</span>
              <CopyButton
                value={`${titulo}\n${meta || original.introducao?.slice(0, 200) || ""}\n${url}`}
                label="Snippet social (Open Graph)"
                buttonText="Copiar OG"
                variant="outline"
                size="sm"
              />
            </div>
            <div className="rounded-lg border overflow-hidden max-w-[500px] bg-white">
              <div className="aspect-[1.91/1] bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-500 text-xs">
                Prévia da imagem (og:image) — 1200×630
              </div>
              <div className="p-3 bg-[#f2f3f5] border-t">
                <div className="text-[11px] uppercase text-[#606770] tracking-wide">
                  {(site.replace(/^https?:\/\//, "")).toUpperCase()}
                </div>
                <div className="text-[15px] font-semibold text-[#1c1e21] leading-tight mt-0.5 line-clamp-2">
                  {titulo || "Título do post"}
                </div>
                <div className="text-[12px] text-[#606770] line-clamp-2 mt-0.5">
                  {meta || original.introducao?.slice(0, 120) || "—"}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Rendered post */}
          <TabsContent value="post" className="pt-4">
            <article className="prose prose-sm max-w-none">
              <h1 className="text-2xl font-bold">{titulo}</h1>
              {original.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 not-prose mb-3">
                  {original.tags.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">#{t}</Badge>)}
                </div>
              )}
              {original.introducao && <p className="text-muted-foreground italic">{original.introducao}</p>}
              {original.secoes.map((s, i) => (
                <div key={i}>
                  {s.titulo && <h2 className="text-lg font-semibold mt-4">{s.titulo}</h2>}
                  {s.conteudo && <p className="whitespace-pre-wrap text-sm">{s.conteudo}</p>}
                </div>
              ))}
              {original.conclusao && (
                <>
                  <h2 className="text-lg font-semibold mt-4">Conclusão</h2>
                  <p className="whitespace-pre-wrap text-sm">{original.conclusao}</p>
                </>
              )}

              {(original.fontes.length > 0 || original.creditos_imagens.length > 0) && (
                <div className="not-prose mt-6 border-t pt-4 space-y-4">
                  {original.fontes.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">📚 Fontes e Referências</h3>
                      <ol className="list-decimal ml-5 space-y-1 text-xs text-muted-foreground">
                        {original.fontes.map((f, i) => (
                          <li key={i}>
                            {f.url ? (
                              <a href={f.url} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-primary">
                                {f.nome || f.url}
                              </a>
                            ) : (
                              <span>{f.nome || "Fonte"}</span>
                            )}
                            {f.autor && <span> — {f.autor}</span>}
                            {f.tipo && <span className="ml-1 opacity-70">[{f.tipo}]</span>}
                            {f.licenca && <span className="ml-1 opacity-70">({f.licenca})</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {original.creditos_imagens.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">🖼️ Créditos de Imagens</h3>
                      <ul className="list-disc ml-5 space-y-1 text-xs text-muted-foreground">
                        {original.creditos_imagens.map((c, i) => (
                          <li key={i}>
                            {c.descricao && <span className="italic">{c.descricao} — </span>}
                            {c.autor && <span>{c.autor}</span>}
                            {c.fonte && <span> / {c.fonte}</span>}
                            {c.url && (
                              <> · <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-primary">link</a></>
                            )}
                            {c.licenca && <span className="ml-1 opacity-70">({c.licenca})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground italic">
                    Conteúdo em conformidade com a Lei 9.610/98 (Direitos Autorais) e LGPD. Verifique cada fonte antes de publicar.
                  </p>
                </div>
              )}

              {!original.introducao && original.secoes.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Este conteúdo não tem corpo renderizável (introdução/seções). Provavelmente é meta-tags ou descrição de imóvel.</p>
              )}
            </article>
          </TabsContent>

          {/* Checklist SEO On-Page */}
          <TabsContent value="checklist" className="pt-4">
            <SeoOnPageChecklist
              titulo={titulo}
              slug={slug}
              meta={meta}
              introducao={original.introducao}
              conclusao={original.conclusao}
              secoes={original.secoes}
              tags={original.tags}
            />
          </TabsContent>

          {/* Sugestão de Keywords com IA */}
          <TabsContent value="keywords" className="pt-4">
            <KeywordsSuggestPanel
              titulo={titulo}
              meta_description={meta}
              tags={original.tags}
              introducao={original.introducao}
              conclusao={original.conclusao}
              secoes={original.secoes}
              nicho="imobiliário Brasil"
              onApplyMeta={(m) => setMeta(m)}
            />
          </TabsContent>

          {/* Histórico de versões */}
          <TabsContent value="historico" className="pt-4">
            <VersionHistoryPanel
              conteudoId={post?.id ?? null}
              current={{ titulo, slug, meta }}
              onRevert={({ titulo: t, slug: s, meta_description: m }) => {
                setTitulo(t);
                setSlug(s);
                setSlugTouched(true);
                setMeta(m);
              }}
            />
          </TabsContent>
        </Tabs>

        {(onSave || onTogglePublish) && (
          <DialogFooter className="gap-2 flex-wrap sm:justify-between">
            <div className="flex items-center gap-2">
              {onTogglePublish && (
                post?.status === "publicado" ? (
                  <Button
                    variant="outline"
                    disabled={publishing || saving}
                    onClick={async () => {
                      setPublishing(true);
                      try { await onTogglePublish("rascunho"); } finally { setPublishing(false); }
                    }}
                  >
                    {publishing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                    Despublicar
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    disabled={publishing || saving || dirty || !titulo.trim() || !slug.trim() || publishBlockedByCritico}
                    title={publishBlockedByCritico ? `Bloqueado: ${criticalChecks.length} item(ns) crítico(s) no checklist SEO` : dirty ? "Salve as alterações antes de publicar" : undefined}
                    onClick={async () => {
                      setPublishing(true);
                      try { await onTogglePublish("publicado"); } finally { setPublishing(false); }
                    }}
                  >
                    {publishing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                    Publicar agora
                  </Button>
                )
              )}
              {post?.status && (
                <Badge variant={post.status === "publicado" ? "default" : "outline"} className="text-[10px]">
                  {post.status === "publicado" ? "Publicado" : "Rascunho"}
                </Badge>
              )}
            </div>
            {onSave && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={reset} disabled={!dirty || saving || publishing}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Reverter
                </Button>
                <Button onClick={handleSave} disabled={!dirty || saving || publishing || !titulo.trim() || !slug.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Salvar alterações
                </Button>
              </div>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
