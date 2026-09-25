import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams, Navigate, NavLink } from "react-router-dom";
import { z } from "zod";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { bairrosDaCidade, findBairro } from "@/lib/seo/bairros";
import { findCidadeBySlug } from "@/lib/seo/cidades";
import { generateContent, h1 as h1Of, metaDesc, type Modo } from "@/lib/seo/bairroContent";
import { MapPin, Home, KeyRound, CheckCircle2, Phone, Mail, User, TrendingUp, Building2, Bus } from "lucide-react";

const leadSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(8, "Telefone inválido").max(20),
  mensagem: z.string().trim().min(5, "Descreva seu interesse").max(1000),
});

function parseModo(v: string | null): Modo {
  if (v === "venda" || v === "aluguel") return v;
  return "ambos";
}

export default function ImoveisCidadeBairro() {
  const { cidade: cidadeSlug, bairro: bairroSlug } = useParams<{ cidade: string; bairro: string }>();
  const [searchParams] = useSearchParams();
  const modo = parseModo(searchParams.get("modo"));
  const cidade = cidadeSlug ? findCidadeBySlug(cidadeSlug) : null;
  const bairro = cidadeSlug && bairroSlug ? findBairro(cidadeSlug, bairroSlug) : null;

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", mensagem: "" });

  const content = useMemo(() => (bairro ? generateContent(bairro) : null), [bairro]);

  if (!cidadeSlug || !bairroSlug) return <Navigate to="/" replace />;
  if (!cidade || !bairro || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Localidade não encontrada</h1>
          <p className="text-muted-foreground mt-2">Volte para o portal e explore outras regiões.</p>
          <Link to="/portal" className="text-primary underline mt-4 inline-block">Ir para o portal</Link>
        </div>
      </div>
    );
  }

  const path = `/imoveis/${bairro.cidadeSlug}/${bairro.slug}${modo !== "ambos" ? `?modo=${modo}` : ""}`;
  const canonical = `https://radarimobtech.shop/imoveis/${bairro.cidadeSlug}/${bairro.slug}`;
  const heading = h1Of(bairro, modo);
  const title = `${heading} | radarimobtech`;
  const description = metaDesc(bairro, content, modo);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "RealEstateAgent",
      name: "radarimobtech",
      areaServed: { "@type": "Place", name: `${bairro.nome}, ${cidade.nome} - ${cidade.uf}` },
      url: canonical,
      telephone: "+55-61-0000-0000",
      priceRange: "R$$$",
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `Imóveis em ${bairro.nome}, ${cidade.nome}`,
      description,
      brand: { "@type": "Brand", name: "radarimobtech" },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
        offerCount: "50",
        lowPrice: "180000",
        highPrice: "3500000",
      },
      areaServed: {
        "@type": "Place",
        name: `${bairro.nome}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: cidade.nome,
          addressRegion: cidade.uf,
          addressCountry: "BR",
        },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Portal", item: "https://radarimobtech.shop/portal" },
        { "@type": "ListItem", position: 2, name: cidade.nome, item: `https://radarimobtech.shop/anunciar-imovel/${cidade.slug}` },
        { "@type": "ListItem", position: 3, name: bairro.nome, item: canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `Quanto custa um imóvel em ${bairro.nome}, ${cidade.nome}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `O preço em ${bairro.nome} varia conforme metragem, padrão de acabamento e andar. Fale com um especialista local para uma avaliação gratuita.`,
          },
        },
        {
          "@type": "Question",
          name: `Vale a pena morar em ${bairro.nome}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${bairro.nome} atrai ${content.perfil}, com ${content.diferencial}. É uma das regiões mais procuradas de ${cidade.nome}.`,
          },
        },
      ],
    },
  ];

  const bairrosRelated = bairrosDaCidade(cidade.slug).filter((b) => b.slug !== bairro.slug).slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = leadSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("contatos_landing").insert({
      nome: parsed.data.nome,
      email: parsed.data.email,
      telefone: parsed.data.telefone,
      mensagem: `[${bairro.nome} / ${cidade.nome}-${cidade.uf}] ${parsed.data.mensagem}`,
      source_url: canonical,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    setSent(true);
    setForm({ nome: "", email: "", telefone: "", mensagem: "" });
    // GA4 via GTM — captura de lead orgânico por bairro
    import("@/lib/analytics").then((a) =>
      a.trackFormSubmission({
        form_id: `bairro-${bairro.cidadeSlug}-${bairro.slug}`,
        form_name: `Captação bairro ${bairro.nome} / ${cidade.nome}`,
        lead_type: "captura_bairro",
        extra: { cidade: cidade.slug, bairro: bairro.slug, modo },
      }),
    );
    toast.success("Recebemos seu contato! Um especialista falará com você em breve.");
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo title={title} description={description} path={path} type="website" jsonLd={jsonLd} />

      {/* Hero */}
      <header className="border-b bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <nav className="text-xs text-muted-foreground mb-3">
            <Link to="/portal" className="hover:underline">Portal</Link>
            <span className="mx-1">›</span>
            <Link to={`/anunciar-imovel/${cidade.slug}`} className="hover:underline">{cidade.nome}</Link>
            <span className="mx-1">›</span>
            <span>{bairro.nome}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            {heading}
          </h1>
          <p className="mt-4 text-slate-600 max-w-3xl leading-relaxed">
            Descubra as melhores oportunidades em <strong>{bairro.nome}</strong>: {content.tipos}, atualizados
            diariamente por corretores locais. Uma região que atrai {content.perfil}, com {content.diferencial}.
          </p>

          {/* Alternador venda / aluguel / ambos */}
          <div className="mt-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
            {(["ambos", "venda", "aluguel"] as Modo[]).map((m) => (
              <NavLink
                key={m}
                to={`/imoveis/${cidade.slug}/${bairro.slug}${m === "ambos" ? "" : `?modo=${m}`}`}
                className={`px-4 py-1.5 rounded-md transition ${
                  modo === m ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m === "ambos" ? "Venda e aluguel" : m === "venda" ? "Venda" : "Aluguel"}
              </NavLink>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <a href="#lead" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90">
              Fale com um especialista
            </a>
            <a href="#lead" className="inline-flex items-center gap-2 border border-slate-300 text-slate-800 px-5 py-2.5 rounded-md text-sm font-medium hover:bg-slate-50">
              Agende sua visita
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-10">
        <section className="md:col-span-2 space-y-10">
          {/* Faixa de preço em destaque */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <Home className="h-4 w-4" /> Faixa de venda em {bairro.nome}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {content.faixaVenda[0]} <span className="text-slate-400 text-lg">–</span> {content.faixaVenda[1]}
              </div>
              <p className="mt-1 text-xs text-slate-500">Valores de referência atualizados por corretores locais.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <KeyRound className="h-4 w-4" /> Faixa de aluguel em {bairro.nome}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {content.faixaAluguel[0]} <span className="text-slate-400 text-lg">–</span> {content.faixaAluguel[1]}
              </div>
              <p className="mt-1 text-xs text-slate-500">Inclui unidades compactas até apartamentos de alto padrão.</p>
            </div>
          </div>

          {/* Sobre o bairro */}
          <article>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Sobre morar em {bairro.nome}
            </h2>
            <p className="mt-3 text-slate-700 leading-relaxed">
              {bairro.nome} é uma das localidades mais procuradas de {cidade.nome} ({cidade.uf}). A região reúne {content.diferencial}, o que a torna
              ideal para {content.perfil}. O mix de {content.tipos} atende desde primeira moradia até investimento com foco em locação.
            </p>
            <p className="mt-3 text-slate-700 leading-relaxed">
              Nossa equipe monitora diariamente novos anúncios em {bairro.nome}, incluindo oportunidades direto com o proprietário e imóveis
              exclusivos ainda não publicados em grandes portais.
            </p>

            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Bus className="h-4 w-4 text-primary" /> Mobilidade
                </div>
                <p className="text-sm text-slate-600 mt-1">{content.transporte}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Building2 className="h-4 w-4 text-primary" /> Serviços e comércio
                </div>
                <p className="text-sm text-slate-600 mt-1">{content.amenidades}</p>
              </div>
            </div>

            <ul className="mt-5 grid sm:grid-cols-2 gap-2">
              {content.destaques.map((d) => (
                <li key={d} className="flex gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {d}
                </li>
              ))}
            </ul>
          </article>

          {/* Venda */}
          {(modo === "ambos" || modo === "venda") && (
            <article>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" /> Comprar imóvel em {bairro.nome}
              </h2>
              <p className="mt-3 text-slate-700 leading-relaxed">
                Se você quer <strong>comprar um imóvel em {bairro.nome}</strong>, contamos com {content.tipos} para diferentes perfis e orçamentos —
                de {content.faixaVenda[0]} a {content.faixaVenda[1]}. Ajudamos em toda a jornada: avaliação de mercado, negociação, análise
                de documentação, financiamento e entrega das chaves.
              </p>
              <ul className="mt-3 space-y-2 text-slate-700">
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Avaliação gratuita do imóvel de interesse</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Simulação de financiamento com os principais bancos</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Assessoria jurídica na compra e venda</li>
              </ul>
            </article>
          )}

          {/* Aluguel */}
          {(modo === "ambos" || modo === "aluguel") && (
            <article>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Alugar imóvel em {bairro.nome}
              </h2>
              <p className="mt-3 text-slate-700 leading-relaxed">
                Para <strong>alugar em {bairro.nome}</strong>, oferecemos opções entre {content.faixaAluguel[0]} e {content.faixaAluguel[1]}, com
                garantia flexível (fiador, seguro-fiança ou caução) e contrato 100% digital. Verificamos documentação em até 48h e cuidamos da
                vistoria de entrada e saída.
              </p>
            </article>
          )}

          {/* Investir */}
          <article>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Investir em {bairro.nome}
            </h2>
            <p className="mt-3 text-slate-700 leading-relaxed">{content.investimento}</p>
          </article>

          {/* FAQ */}
          <article>
            <h2 className="text-2xl font-semibold">Perguntas frequentes sobre {bairro.nome}</h2>
            <div className="mt-3 space-y-4 text-slate-700">
              <div>
                <h3 className="font-medium">Quanto custa um imóvel em {bairro.nome}?</h3>
                <p className="mt-1">O preço varia conforme metragem, padrão de acabamento e andar. Solicite uma avaliação gratuita para o imóvel de seu interesse.</p>
              </div>
              <div>
                <h3 className="font-medium">Vale a pena morar em {bairro.nome}?</h3>
                <p className="mt-1">{bairro.nome} atrai {content.perfil}, com {content.diferencial} — é uma das regiões mais consolidadas de {cidade.nome}.</p>
              </div>
              <div>
                <h3 className="font-medium">Como agendar uma visita?</h3>
                <p className="mt-1">Preencha o formulário ao lado que um corretor local entra em contato em até 1 hora útil.</p>
              </div>
            </div>
          </article>

          {/* Bairros relacionados */}
          {bairrosRelated.length > 0 && (
            <article>
              <h2 className="text-xl font-semibold">Outros bairros em {cidade.nome}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {bairrosRelated.map((b) => (
                  <li key={b.slug}>
                    <Link
                      to={`/imoveis/${cidade.slug}/${b.slug}`}
                      className="inline-block text-sm border border-slate-200 rounded-full px-3 py-1 hover:bg-slate-50 hover:border-slate-300"
                    >
                      {b.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          )}
        </section>

        {/* Lead form */}
        <aside id="lead" className="md:sticky md:top-6 h-fit">
          <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm">
            {sent ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                <h3 className="mt-3 font-semibold">Recebemos seu contato!</h3>
                <p className="text-sm text-muted-foreground mt-1">Um especialista em {bairro.nome} falará com você em breve.</p>
                <Button variant="outline" className="mt-4" onClick={() => setSent(false)}>Enviar outra mensagem</Button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Fale com um especialista em {bairro.nome}</h2>
                <p className="text-sm text-muted-foreground mt-1">Receba imóveis selecionados e agende sua visita.</p>
                <form onSubmit={submit} className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="nome" className="text-xs">Nome</Label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="nome" className="pl-8" value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} required maxLength={100} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-xs">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" className="pl-8" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required maxLength={255} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="telefone" className="text-xs">Telefone / WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="telefone" className="pl-8" value={form.telefone} onChange={(e) => setForm((s) => ({ ...s, telefone: e.target.value }))} required maxLength={20} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="mensagem" className="text-xs">Interesse</Label>
                    <Textarea
                      id="mensagem"
                      rows={4}
                      placeholder={`Ex: apartamento 3 quartos em ${bairro.nome} até R$ 900 mil`}
                      value={form.mensagem}
                      onChange={(e) => setForm((s) => ({ ...s, mensagem: e.target.value }))}
                      required
                      maxLength={1000}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Enviando..." : "Receber informações detalhadas"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Ao enviar você concorda com nossa política de privacidade (LGPD).
                  </p>
                </form>
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
