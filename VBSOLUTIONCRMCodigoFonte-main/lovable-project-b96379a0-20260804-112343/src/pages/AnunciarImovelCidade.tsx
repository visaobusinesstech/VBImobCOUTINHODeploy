import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { findCidadeBySlug, SEO_CIDADES } from "@/lib/seo/cidades";
import { supabase } from "@/integrations/supabase/client";

interface Agregado {
  cidade: string;
  total_ativos: number;
  preco_medio: number;
  preco_mediano: number;
  preco_m2_medio: number;
  preco_m2_mediano: number;
  tempo_medio_dias: number;
  proprietarios_captados: number;
  bairros_top: { nome: string; total: number }[];
  atualizado_em: string;
}

const brl = (n: number) =>
  n > 0 ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—";

export default function AnunciarImovelCidade() {
  const { cidade: slug } = useParams<{ cidade: string }>();
  const cidade = slug ? findCidadeBySlug(slug) : null;
  const [dados, setDados] = useState<Agregado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cidade) return;
    const title = `Anunciar imóvel em ${cidade.nome} (${cidade.uf}) — grátis, direto do proprietário`;
    const desc = `Anuncie seu imóvel em ${cidade.nome} sem comissão. Veja preço médio, tempo de venda e publique em 4 minutos com laudo grátis.`;
    document.title = title;

    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };
    const canonical = `https://radarimobtech.shop/anunciar-imovel/${cidade.slug}`;
    setMeta("description", desc);
    setLink("canonical", canonical);
    setMeta("og:title", title, "property");
    setMeta("og:description", desc, "property");
    setMeta("og:url", canonical, "property");
    setMeta("og:type", "website", "property");
  }, [cidade]);

  useEffect(() => {
    if (!cidade) return;
    let mounted = true;
    setLoading(true);
    supabase.functions
      .invoke("mercado-publico", { body: null, method: "GET" as any })
      .catch(() => null)
      .then(() => {
        // Uses direct fetch to allow query params without body
      });
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercado-publico?cidade=${encodeURIComponent(
      cidade.nome,
    )}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (mounted) setDados(json);
      })
      .catch(() => mounted && setDados(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [cidade]);

  if (!cidade) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Cidade não encontrada</h1>
          <Link to="/anunciar-imovel" className="mt-4 inline-block text-primary underline">
            Ver todas as cidades
          </Link>
        </div>
      </main>
    );
  }

  const outras = SEO_CIDADES.filter((c) => c.uf === cidade.uf && c.slug !== cidade.slug).slice(0, 8);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="max-w-5xl mx-auto px-6 py-14">
        <nav className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:underline">Início</Link> ·{" "}
          <Link to="/anunciar-imovel" className="hover:underline">Anunciar imóvel</Link> ·{" "}
          <span>{cidade.nome}</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Anunciar imóvel em {cidade.nome} — {cidade.uf}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          Publique seu imóvel em {cidade.nome} <strong>direto do proprietário</strong>, sem comissão e sem imobiliária.
          Laudo de avaliação por IA na primeira publicação.
        </p>

        <div className="mt-6 flex gap-3 flex-wrap">
          <Link
            to="/auth"
            className="inline-flex items-center px-5 py-3 rounded-md bg-primary text-primary-foreground font-medium"
          >
            Anunciar grátis em {cidade.nome}
          </Link>
          <Link
            to="/quanto-vale-meu-imovel"
            className="inline-flex items-center px-5 py-3 rounded-md border border-input"
          >
            Ver quanto vale meu imóvel
          </Link>
        </div>

        <section className="mt-12 grid md:grid-cols-4 gap-4">
          <Card label="Imóveis ativos" value={loading ? "…" : String(dados?.total_ativos ?? 0)} />
          <Card label="Preço médio" value={loading ? "…" : brl(dados?.preco_medio ?? 0)} />
          <Card label="Preço médio por m²" value={loading ? "…" : brl(dados?.preco_m2_medio ?? 0)} />
          <Card label="Tempo médio no ar" value={loading ? "…" : `${dados?.tempo_medio_dias ?? 0} dias`} />
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Bairros mais anunciados em {cidade.nome}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {dados?.bairros_top?.length
              ? dados.bairros_top.map((b) => (
                  <span key={b.nome} className="px-3 py-1.5 rounded-full border text-sm">
                    {b.nome} <span className="text-muted-foreground">({b.total})</span>
                  </span>
                ))
              : (
                <p className="text-muted-foreground text-sm">
                  Ainda estamos mapeando os bairros. Anuncie e apareça primeiro.
                </p>
              )}
          </div>
        </section>

        <section className="mt-14 rounded-xl border p-6 bg-card">
          <h2 className="text-xl font-semibold">Como anunciar em {cidade.nome} em 4 minutos</h2>
          <ol className="mt-3 space-y-2 text-sm list-decimal ml-5">
            <li>Cadastre-se grátis (Google ou e-mail).</li>
            <li>Informe CEP + tipo de imóvel — preenchemos bairro e cidade.</li>
            <li>Adicione 3 fotos e o preço (IA sugere valor justo com base em {cidade.nome}).</li>
            <li>Publique. Contatos chegam no seu WhatsApp.</li>
          </ol>
        </section>

        {outras.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-semibold">Outras cidades em {cidade.uf}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {outras.map((c) => (
                <Link
                  key={c.slug}
                  to={`/anunciar-imovel/${c.slug}`}
                  className="px-3 py-1.5 rounded-full border text-sm hover:border-primary"
                >
                  Anunciar em {c.nome}
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="mt-12 text-xs text-muted-foreground">
          Dados agregados de imóveis públicos coletados de fontes abertas. Nenhum contato individual é exposto nesta
          página. Atualizado em {dados?.atualizado_em ? new Date(dados.atualizado_em).toLocaleDateString("pt-BR") : "—"}.
        </p>
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
