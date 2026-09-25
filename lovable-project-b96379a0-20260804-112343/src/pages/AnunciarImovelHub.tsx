import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SEO_CIDADES } from "@/lib/seo/cidades";

export default function AnunciarImovelHub() {
  useEffect(() => {
    document.title = "Anunciar imóvel grátis — direto do proprietário | radarimobtech";
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta(
      "description",
      "Anuncie seu imóvel grátis, direto do proprietário, sem comissão. Escolha sua cidade e publique em 4 minutos.",
    );
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };
    setLink("canonical", "https://radarimobtech.shop/anunciar-imovel");
    setMeta("og:title", "Anunciar imóvel grátis — direto do proprietário", "property");
    setMeta("og:url", "https://radarimobtech.shop/anunciar-imovel", "property");
    setMeta("og:type", "website", "property");
  }, []);

  const grupos = SEO_CIDADES.reduce<Record<string, typeof SEO_CIDADES>>((acc, c) => {
    (acc[c.uf] ??= []).push(c);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Anuncie seu imóvel grátis, direto do proprietário
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          Sem comissão, sem imobiliária, com laudo de avaliação por IA na primeira publicação.
          Escolha sua cidade abaixo e veja o preço médio, tempo médio de venda e como anunciar em 4 minutos.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center px-5 py-3 rounded-md bg-primary text-primary-foreground font-medium"
          >
            Anunciar grátis agora
          </Link>
          <Link
            to="/quanto-vale-meu-imovel"
            className="inline-flex items-center px-5 py-3 rounded-md border border-input"
          >
            Avaliar meu imóvel
          </Link>
        </div>

        <div className="mt-14 space-y-10">
          {Object.entries(grupos).map(([uf, cidades]) => (
            <div key={uf}>
              <h2 className="text-2xl font-semibold mb-4">Anunciar imóvel em {uf}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {cidades.map((c) => (
                  <Link
                    key={c.slug}
                    to={`/anunciar-imovel/${c.slug}`}
                    className="p-4 rounded-lg border hover:border-primary hover:bg-accent transition-colors"
                  >
                    <div className="font-medium">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">Anunciar em {c.nome}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <section className="mt-16 rounded-xl border p-6 bg-card">
          <h2 className="text-xl font-semibold">Por que anunciar no radarimobtech?</h2>
          <ul className="mt-3 grid md:grid-cols-2 gap-2 text-sm">
            <li>• 100% grátis para o proprietário — sem comissão sobre a venda.</li>
            <li>• Laudo de avaliação por IA na primeira publicação (padrão premium).</li>
            <li>• Leads chegam direto no seu WhatsApp, sem intermediários.</li>
            <li>• Motor de precificação com dados reais do seu bairro.</li>
            <li>• Portal LGPD do titular — seus dados sob seu controle.</li>
            <li>• Publicação em menos de 4 minutos.</li>
          </ul>
        </section>
      </section>
    </main>
  );
}
