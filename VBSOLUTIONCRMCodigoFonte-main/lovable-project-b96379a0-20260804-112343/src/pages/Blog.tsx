import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ArrowRight, ChevronLeft, ChevronRight, Rss } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Post {
  id: string;
  slug: string;
  titulo: string;
  tipo: string;
  meta_description: string | null;
  cidade: string | null;
  bairro: string | null;
  tags: string[] | null;
  publicado_em: string | null;
  created_at: string;
}

const PAGE_SIZE = 9;

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const qParam = searchParams.get("q") || "";
  const tipoParam = searchParams.get("tipo") || "";
  const cidadeParam = searchParams.get("cidade") || "";
  const tagsParam = (searchParams.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [qInput, setQInput] = useState(qParam);
  const [tipos, setTipos] = useState<string[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => { setQInput(qParam); }, [qParam]);

  const setTagsParam = (tags: string[]) => {
    const next = new URLSearchParams(searchParams);
    if (tags.length) next.set("tags", tags.join(",")); else next.delete("tags");
    next.delete("page");
    setSearchParams(next);
  };

  const toggleTag = (t: string) => {
    const has = tagsParam.includes(t);
    setTagsParam(has ? tagsParam.filter((x) => x !== t) : [...tagsParam, t]);
  };

  // RSS/Atom auto-discovery links in <head>
  useEffect(() => {
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blog-rss`;
    const params = new URLSearchParams();
    if (tipoParam) params.set("tipo", tipoParam);
    if (cidadeParam) params.set("cidade", cidadeParam);
    const qs = params.toString();
    const links: HTMLLinkElement[] = [];
    const make = (type: string, href: string, title: string) => {
      const el = document.createElement("link");
      el.rel = "alternate";
      el.type = type;
      el.href = href;
      el.title = title;
      document.head.appendChild(el);
      links.push(el);
    };
    make("application/rss+xml", `${base}${qs ? `?${qs}` : ""}`, "Blog radarimobtech (RSS)");
    make("application/atom+xml", `${base}?${qs ? `${qs}&` : ""}format=atom`, "Blog radarimobtech (Atom)");
    return () => { links.forEach((l) => l.remove()); };
  }, [tipoParam, cidadeParam]);


  // Load available filter options once
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("conteudos_seo")
        .select("tipo,cidade,tags")
        .eq("status", "publicado")
        .not("slug", "is", null)
        .limit(1000);
      const rows = (data as any[]) || [];
      setTipos(Array.from(new Set(rows.map((r) => r.tipo).filter(Boolean))).sort());
      setCidades(Array.from(new Set(rows.map((r) => r.cidade).filter(Boolean))).sort());
      const tagCount = new Map<string, number>();
      rows.forEach((r) => (Array.isArray(r.tags) ? r.tags : []).forEach((t: string) => {
        if (t) tagCount.set(t, (tagCount.get(t) || 0) + 1);
      }));
      setAllTags(Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 40));
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("conteudos_seo")
        .select("id,slug,titulo,tipo,meta_description,cidade,bairro,tags,publicado_em,created_at", { count: "exact" })
        .eq("status", "publicado")
        .not("slug", "is", null)
        .order("publicado_em", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (tipoParam) query = query.eq("tipo", tipoParam);
      if (cidadeParam) query = query.eq("cidade", cidadeParam);
      if (tagsParam.length) query = query.contains("tags", tagsParam);
      if (qParam.trim()) {
        const s = qParam.trim().replace(/[%,]/g, " ");
        query = query.or(`titulo.ilike.%${s}%,meta_description.ilike.%${s}%,cidade.ilike.%${s}%,bairro.ilike.%${s}%`);
      }
      const { data, count } = await query;
      if (cancelled) return;
      setPosts(((data as any[]) || []) as Post[]);
      setTotal(count || 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [page, qParam, tipoParam, cidadeParam, tagsParam.join(",")]);



  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (qInput.trim()) next.set("q", qInput.trim()); else next.delete("q");
    next.delete("page");
    setSearchParams(next);
  };

  const goTo = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) next.delete("page"); else next.set("page", String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageTitle = page > 1
    ? `Blog radarimobtech — Página ${page}`
    : "Blog radarimobtech — Conteúdo para corretores e imobiliárias";

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={pageTitle}
        description="Artigos, guias e análises sobre captação, CRM imobiliário, avaliação de imóveis e mercado brasileiro."
        path={page > 1 ? `/blog?page=${page}` : "/blog"}
        type="website"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Blog radarimobtech",
          url: "https://radarimobtech.shop/blog",
          blogPost: posts.slice(0, 10).map((p) => ({
            "@type": "BlogPosting",
            headline: p.titulo,
            url: `https://radarimobtech.shop/blog/${p.slug}`,
            datePublished: p.publicado_em || p.created_at,
          })),
        }}
      />

      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <Link to="/" className="text-sm text-muted-foreground hover:underline">← radarimobtech</Link>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight">Blog</h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
            Conteúdo estratégico para corretores, imobiliárias e proprietários no Brasil.
          </p>
          <form onSubmit={submitSearch} className="mt-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, descrição, cidade ou bairro..."
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="pl-9"
            />
          </form>


          {(() => {
            const origin = typeof window !== "undefined" ? window.location.origin : "https://radarimobtech.shop";
            const seg = (s: string) => encodeURIComponent(s);
            let rssUrl = `${origin}/rss`;
            let atomUrl = `${origin}/atom`;
            if (tipoParam && cidadeParam) {
              rssUrl = `${origin}/rss/categoria/${seg(tipoParam)}/cidade/${seg(cidadeParam)}`;
              atomUrl = `${origin}/atom/categoria/${seg(tipoParam)}/cidade/${seg(cidadeParam)}`;
            } else if (tipoParam) {
              rssUrl = `${origin}/rss/categoria/${seg(tipoParam)}`;
              atomUrl = `${origin}/atom/categoria/${seg(tipoParam)}`;
            } else if (cidadeParam) {
              rssUrl = `${origin}/rss/cidade/${seg(cidadeParam)}`;
              atomUrl = `${origin}/atom/cidade/${seg(cidadeParam)}`;
            }
            const activeLabel = [tipoParam, cidadeParam].filter(Boolean).join(" · ") || "todos os posts";
            return (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <a
                    href={rssUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 hover:bg-muted transition"
                    title={`Feed RSS — ${activeLabel}`}
                  >
                    <Rss className="w-3.5 h-3.5" /> RSS ({activeLabel})
                  </a>
                  <a
                    href={atomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 hover:bg-muted transition"
                    title={`Feed Atom — ${activeLabel}`}
                  >
                    <Rss className="w-3.5 h-3.5" /> Atom ({activeLabel})
                  </a>
                  <span className="text-muted-foreground">Assine em seu leitor favorito</span>
                </div>
                {tipos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-muted-foreground">Feeds por categoria:</span>
                    {tipos.map((t) => (
                      <a
                        key={t}
                        href={`${origin}/rss/categoria/${seg(t)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-muted transition"
                        title={`RSS da categoria ${t}`}
                      >
                        <Rss className="w-3 h-3" /> {t}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}


          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={tipoParam}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set("tipo", e.target.value); else next.delete("tipo");
                next.delete("page");
                setSearchParams(next);
              }}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <select
              value={cidadeParam}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set("cidade", e.target.value); else next.delete("cidade");
                next.delete("page");
                setSearchParams(next);
              }}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              aria-label="Filtrar por cidade"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {(tipoParam || cidadeParam || qParam || tagsParam.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchParams(new URLSearchParams())}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {allTags.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Tags populares</div>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((t) => {
                  const active = tagsParam.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                      aria-pressed={active}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(tipoParam || cidadeParam || tagsParam.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tipoParam && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => {
                  const next = new URLSearchParams(searchParams); next.delete("tipo"); next.delete("page"); setSearchParams(next);
                }}>
                  Categoria: {tipoParam} ✕
                </Badge>
              )}
              {cidadeParam && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => {
                  const next = new URLSearchParams(searchParams); next.delete("cidade"); next.delete("page"); setSearchParams(next);
                }}>
                  Cidade: {cidadeParam} ✕
                </Badge>
              )}
              {tagsParam.map((t) => (
                <Badge key={t} variant="default" className="cursor-pointer" onClick={() => toggleTag(t)}>
                  #{t} ✕
                </Badge>
              ))}
            </div>
          )}
        </div>
      </header>



      <main className="max-w-5xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            {qParam ? "Nenhum artigo encontrado para essa busca." : "Nenhum artigo publicado ainda. Volte em breve."}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              {total} {total === 1 ? "artigo" : "artigos"}
              {qParam && <> para "<strong>{qParam}</strong>"</>} · Página {page} de {totalPages}
            </p>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="group">
                  <Card className="h-full transition hover:shadow-md hover:border-primary/40">
                    <CardHeader>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="secondary">{p.tipo}</Badge>
                        {p.cidade && <Badge variant="outline">{p.cidade}</Badge>}
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition line-clamp-2">
                        {p.titulo}
                      </CardTitle>
                      {p.meta_description && (
                        <CardDescription className="line-clamp-3">{p.meta_description}</CardDescription>
                      )}
                      {p.tags && p.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.tags.slice(0, 4).map((t) => (
                            <span key={t} className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                    </CardHeader>
                    <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {format(new Date(p.publicado_em || p.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                      <span className="inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition">
                        Ler <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginação do blog">
                <Button variant="outline" size="sm" onClick={() => goTo(page - 1)} disabled={page <= 1} className="gap-1">
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                  const p = i + 1;
                  return (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => goTo(p)}
                      className="w-9"
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" onClick={() => goTo(page + 1)} disabled={page >= totalPages} className="gap-1">
                  Próxima <ChevronRight className="w-4 h-4" />
                </Button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}
