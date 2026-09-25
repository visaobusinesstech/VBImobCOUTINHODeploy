import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
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
  publicado_em: string | null;
  created_at: string;
  updated_at: string;
  conteudo: any;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("conteudos_seo")
        .select("*")
        .eq("status", "publicado")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) setNotFound(true);
      else setPost(data as any);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Seo title="Artigo não encontrado" description="Este artigo não existe ou foi removido." path={`/blog/${slug}`} noindex />
        <p className="text-lg">Artigo não encontrado.</p>
        <Link to="/blog" className="text-primary underline">Voltar ao blog</Link>
      </div>
    );
  }

  const c = post.conteudo || {};
  const introducao: string = c.introducao || "";
  const secoes: Array<{ titulo?: string; conteudo?: string }> = Array.isArray(c.secoes) ? c.secoes : [];
  const conclusao: string = c.conclusao || "";
  const tags: string[] = Array.isArray(c.tags) ? c.tags : [];
  const fontes: Array<{ nome?: string; autor?: string; url?: string; tipo?: string; licenca?: string }> =
    Array.isArray(c.fontes) ? c.fontes : [];
  const creditos: Array<{ descricao?: string; autor?: string; fonte?: string; url?: string; licenca?: string }> =
    Array.isArray(c.creditos_imagens) ? c.creditos_imagens : [];

  const publishedIso = post.publicado_em || post.created_at;
  const canonicalPath = `/blog/${post.slug}`;
  const canonicalUrl = `https://radarimobtech.shop${canonicalPath}`;
  const heroImage: string =
    c.imagem_destaque ||
    c.imagem_capa ||
    creditos.find((cr) => cr.url)?.url ||
    "https://radarimobtech.shop/pwa-512.png";

  const description = post.meta_description || introducao.slice(0, 155);

  const wordCount = [introducao, ...secoes.map((s) => s.conteudo || ""), conclusao]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 220));

  const articleSchema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.titulo,
    description,
    image: [heroImage],
    datePublished: publishedIso,
    dateModified: post.updated_at,
    inLanguage: "pt-BR",
    articleSection: post.tipo,
    keywords: tags.length ? tags.join(", ") : undefined,
    wordCount: wordCount || undefined,
    timeRequired: `PT${readingMinutes}M`,
    url: canonicalUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    author: {
      "@type": "Organization",
      name: "radarimobtech",
      url: "https://radarimobtech.shop",
    },
    publisher: {
      "@type": "Organization",
      name: "radarimobtech",
      url: "https://radarimobtech.shop",
      logo: {
        "@type": "ImageObject",
        url: "https://radarimobtech.shop/pwa-512.png",
        width: 512,
        height: 512,
      },
    },
    isPartOf: {
      "@type": "Blog",
      name: "Blog radarimobtech",
      url: "https://radarimobtech.shop/blog",
    },
    ...(fontes.length
      ? {
          citation: fontes
            .filter((f) => f.url || f.nome)
            .map((f) => ({
              "@type": "CreativeWork",
              name: f.nome || f.url,
              url: f.url,
              author: f.autor ? { "@type": "Person", name: f.autor } : undefined,
              license: f.licenca,
            })),
        }
      : {}),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: "https://radarimobtech.shop/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://radarimobtech.shop/blog" },
      { "@type": "ListItem", position: 3, name: post.titulo, item: canonicalUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${post.titulo} | Blog radarimobtech`}
        description={description}
        path={canonicalPath}
        type="article"
        image={heroImage}
        jsonLd={[articleSchema, breadcrumbSchema]}
      />


      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Link to="/blog" className="text-sm text-muted-foreground hover:underline">
            ← Blog
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary">{post.tipo}</Badge>
          {post.cidade && <Badge variant="outline">{post.cidade}</Badge>}
          {post.bairro && <Badge variant="outline">{post.bairro}</Badge>}
        </div>

        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
          {post.titulo}
        </h1>

        <p className="mt-4 text-sm text-muted-foreground">
          Publicado em {format(new Date(publishedIso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>

        {introducao && (
          <p className="mt-8 text-lg leading-relaxed text-foreground whitespace-pre-wrap">
            {introducao}
          </p>
        )}

        <div className="mt-8 space-y-8">
          {secoes.map((s, i) => (
            <section key={i}>
              {s.titulo && <h2 className="text-2xl font-semibold mt-2 mb-3">{s.titulo}</h2>}
              {s.conteudo && (
                <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {s.conteudo}
                </p>
              )}
            </section>
          ))}
        </div>

        {conclusao && (
          <section className="mt-10 pt-8 border-t">
            <h2 className="text-2xl font-semibold mb-3">Conclusão</h2>
            <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90">
              {conclusao}
            </p>
          </section>
        )}

        {tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t} variant="outline">#{t}</Badge>
            ))}
          </div>
        )}

        {fontes.length > 0 && (
          <section className="mt-12 pt-8 border-t">
            <h2 className="text-xl font-semibold mb-3">📚 Fontes e Referências</h2>
            <ul className="space-y-2 text-sm">
              {fontes.map((f, i) => (
                <li key={i}>
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
                      {f.nome || f.url}
                    </a>
                  ) : (
                    <span>{f.nome}</span>
                  )}
                  {f.autor && <span className="text-muted-foreground"> — {f.autor}</span>}
                  {f.licenca && <span className="text-muted-foreground"> ({f.licenca})</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {creditos.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-semibold mb-3">🖼️ Créditos de Imagens</h2>
            <ul className="space-y-2 text-sm">
              {creditos.map((c, i) => (
                <li key={i}>
                  {c.descricao && <strong>{c.descricao}: </strong>}
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
                      {c.fonte || c.url}
                    </a>
                  ) : (
                    <span>{c.fonte}</span>
                  )}
                  {c.autor && <span className="text-muted-foreground"> — {c.autor}</span>}
                  {c.licenca && <span className="text-muted-foreground"> ({c.licenca})</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 pt-8 border-t text-center">
          <Link to="/blog" className="text-primary underline">← Ver todos os artigos</Link>
        </div>
      </article>
    </div>
  );
}
