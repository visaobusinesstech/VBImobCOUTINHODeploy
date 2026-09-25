import { Link } from "react-router-dom";
import { trackFreeTrialStarted } from "@/lib/analytics";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  TrendingUp,
  Target,
  BarChart3,
  Rocket,
  MapPin,
  FileText,
  Zap,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Globe,
  Users,
  LineChart,
} from "lucide-react";

const PATH = "/solucoes/seo-imobiliario";

const FAQ = [
  {
    q: "O que é SEO imobiliário e por que ele é essencial para corretores?",
    a: "SEO imobiliário é o conjunto de técnicas que faz seus imóveis e sua imobiliária aparecerem nas primeiras posições do Google quando proprietários e compradores buscam por termos como 'vender apartamento em Brasília' ou 'melhor imobiliária no DF'. É essencial porque 92% dos negócios imobiliários começam com uma busca online — quem não aparece, não vende.",
  },
  {
    q: "Quanto tempo leva para ver resultados de SEO com a radarimobtech?",
    a: "Os primeiros ganhos de visibilidade (indexação, meta tags, sitemap, Core Web Vitals) aparecem em 7 a 30 dias. Rankings em palavras-chave de cauda longa começam em 30-90 dias. Autoridade consolidada em 3-6 meses. A plataforma automatiza monitoramento contínuo com Lighthouse semanal e alertas de regressão.",
  },
  {
    q: "A ferramenta gera leads qualificados de verdade?",
    a: "Sim. Além do SEO técnico, geramos landing pages programáticas por cidade, capturamos formulários de proprietários interessados em vender/alugar, aplicamos IA para pontuar motivação e distribuímos automaticamente para o corretor certo via fila round-robin.",
  },
  {
    q: "Preciso saber de SEO técnico para usar?",
    a: "Não. A radarimobtech aplica automaticamente title, meta description, canonical, Open Graph, JSON-LD (Product/Organization/FAQ), sitemap dinâmico e robots.txt em todas as suas páginas. Você acompanha resultados por dashboards visuais.",
  },
  {
    q: "Funciona para imobiliária pequena ou só grandes?",
    a: "Funciona para os dois. Multi-tenant nativo: cada imobiliária tem isolamento total de dados, dashboards próprios e SEO próprio. Planos escalam do corretor autônomo até redes com dezenas de unidades.",
  },
  {
    q: "Integra com portais como VivaReal, ZAP e OLX?",
    a: "Sim. Exportamos feeds XML padrão dos principais portais e sincronizamos automaticamente, para que seus anúncios apareçam tanto no seu site otimizado quanto nos maiores marketplaces do Brasil.",
  },
];

const BENEFITS = [
  {
    icon: Search,
    title: "Visibilidade orgânica no Google",
    desc: "Meta tags, canonical, Open Graph, JSON-LD e sitemap dinâmico aplicados em cada rota — sem código.",
  },
  {
    icon: Users,
    title: "Leads qualificados de proprietários",
    desc: "Landing pages por cidade + formulários de captação + IA que pontua a real intenção de vender ou alugar.",
  },
  {
    icon: TrendingUp,
    title: "Aumento mensurável de vendas",
    desc: "Ranqueamento em palavras-chave de alta intenção como 'avaliar imóvel' e 'anunciar apartamento grátis'.",
  },
  {
    icon: BarChart3,
    title: "Auditoria e monitoramento contínuos",
    desc: "Lighthouse semanal, alertas de regressão automáticos e histórico de Core Web Vitals por rota.",
  },
  {
    icon: MapPin,
    title: "SEO local para sua cidade",
    desc: "30+ landing pages programáticas por cidade otimizadas para 'imobiliária em [cidade]' e variações.",
  },
  {
    icon: ShieldCheck,
    title: "Conforme LGPD",
    desc: "Portal do titular, rastreamento de consentimento e políticas automáticas de retenção de dados.",
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Otimização On-Page automática",
    items: [
      "Title tags únicas por rota (50-60 chars)",
      "Meta descriptions persuasivas (150-160 chars)",
      "Open Graph + Twitter Cards para redes sociais",
      "JSON-LD (Product, Organization, FAQ, BreadcrumbList)",
      "Canonical URLs e hreflang quando aplicável",
    ],
  },
  {
    icon: Rocket,
    title: "Performance e Core Web Vitals",
    items: [
      "Lazy loading, code splitting e image optimization",
      "LCP, CLS, FCP e TBT monitorados por rota",
      "Alertas quando qualquer score cai acima do limiar",
      "Configuração de dispositivos (mobile/desktop) por rota",
      "Relatórios semanais via Google PageSpeed Insights",
    ],
  },
  {
    icon: Globe,
    title: "SEO programático em escala",
    items: [
      "Landing pages por cidade geradas automaticamente",
      "Sitemap dinâmico com imóveis publicados",
      "robots.txt e canonicals sempre corretos",
      "Conteúdo de blog assistido por IA (Gemini)",
      "Publicação nativa e integração com WordPress",
    ],
  },
  {
    icon: LineChart,
    title: "Analytics e decisões orientadas por dados",
    items: [
      "Dashboard de auditoria SEO com filtros e drill-down",
      "Exportação CSV e PDF dos relatórios",
      "Checklist de correções com histórico e responsáveis",
      "Rastreamento de origem de leads por canal",
      "ROI por palavra-chave e por landing page",
    ],
  },
];

const STEPS = [
  {
    n: "01",
    title: "Ativação instantânea",
    desc: "Crie sua conta, conecte seu domínio ou use o subdomínio radarimobtech. SEO técnico ativo em minutos.",
  },
  {
    n: "02",
    title: "Otimização automática",
    desc: "A plataforma aplica meta tags, sitemap e schema em todas as páginas — inclusive nas fichas de imóveis.",
  },
  {
    n: "03",
    title: "Captação de proprietários",
    desc: "Landing pages por cidade + IA de detecção de dor geram leads qualificados prontos para o corretor.",
  },
  {
    n: "04",
    title: "Monitoramento e ganho contínuo",
    desc: "Lighthouse semanal, alertas de regressão e checklist de correções mantêm seu SEO sempre saudável.",
  },
];

export default function SolucoesSeoImobiliario() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "radarimobtech — Software de SEO Imobiliário",
      description:
        "Ferramenta de SEO para imóveis com automação técnica, geração de leads para corretores e otimização de busca para corretores e imobiliárias.",
      brand: { "@type": "Brand", name: "radarimobtech" },
      offers: {
        "@type": "Offer",
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
        url: `https://radarimobtech.shop${PATH}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: "https://radarimobtech.shop/" },
        { "@type": "ListItem", position: 2, name: "Soluções", item: "https://radarimobtech.shop/solucoes" },
        {
          "@type": "ListItem",
          position: 3,
          name: "SEO Imobiliário",
          item: `https://radarimobtech.shop${PATH}`,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="SEO Imobiliário: Ferramenta que Gera Leads | radarimobtech"
        description="Software de marketing para imobiliárias com SEO automatizado, geração de leads para corretores e aumento real de vendas de imóveis. Teste grátis."
        path={PATH}
        type="product"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <header className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Rocket className="h-3.5 w-3.5" /> Ferramenta de SEO para imóveis
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              SEO Imobiliário que <span className="text-primary">gera leads</span> e{" "}
              <span className="text-primary">aumenta vendas</span> — sem depender de agência.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              A radarimobtech automatiza toda a otimização de busca para corretores e imobiliárias:
              meta tags, performance, landing pages por cidade e captação de proprietários com IA.
              Mais visibilidade online imobiliária, mais oportunidades reais.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link
                  to="/auth"
                  onClick={() => trackFreeTrialStarted({ button_text: "Testar grátis por 7 dias", source: "seo_solucoes_hero" })}
                >
                  Testar grátis por 7 dias <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/anunciar-imovel">Ver landing pages ao vivo</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Sem cartão · Ativação em minutos · Multi-tenant · LGPD
            </p>
          </div>
        </div>
      </header>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Marketing digital imobiliário que resolve as dores do dia a dia
          </h2>
          <p className="mt-4 text-muted-foreground">
            Baixa visibilidade, leads frios e site lento não são mais problema. A plataforma faz o
            trabalho pesado de SEO enquanto você foca em fechar negócios.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <Card key={b.title} className="border-border/60 transition hover:border-primary/40 hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{b.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Features / how */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Tudo o que uma boa estratégia de SEO precisa — em um único software
            </h2>
            <p className="mt-4 text-muted-foreground">
              Da otimização técnica ao conteúdo, do monitoramento à captação. Um único painel para
              elevar sua visibilidade online imobiliária.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="border-border/60">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-xl">{f.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {f.items.map((it) => (
                        <li key={it} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="text-foreground/80">{it}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Do zero ao primeiro lead qualificado em 4 passos
          </h2>
          <p className="mt-4 text-muted-foreground">
            Um caminho claro, sem código, sem agência, sem esperar meses por resultado.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="relative rounded-xl border bg-card p-6 transition hover:border-primary/40"
            >
              <div className="text-4xl font-bold text-primary/20">{s.n}</div>
              <h3 className="mt-2 font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="border-y bg-primary/5">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 text-center md:grid-cols-4">
            {[
              { n: "92%", t: "das buscas por imóveis começam no Google" },
              { n: "30+", t: "cidades com landing pages SEO prontas" },
              { n: "6h", t: "de intervalo entre monitoramentos automáticos" },
              { n: "100%", t: "das rotas com meta tags e schema válido" },
            ].map((s) => (
              <div key={s.n}>
                <div className="text-4xl font-bold text-primary md:text-5xl">{s.n}</div>
                <p className="mt-2 text-sm text-muted-foreground">{s.t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Perguntas frequentes sobre SEO imobiliário
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tire suas dúvidas antes de começar. Se preferir, fale com nosso time.
          </p>
        </div>

        <div className="mt-10">
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((f, i) => (
              <AccordionItem key={i} value={`q-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium">
                  <span className="flex items-start gap-2">
                    <FileText className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    {f.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t bg-gradient-to-b from-background to-primary/5">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
            Pare de perder clientes para quem aparece antes de você no Google
          </h2>
          <p className="mt-4 text-muted-foreground md:text-lg">
            Ative a radarimobtech e transforme seu site em uma máquina de captação de proprietários
            e compradores. Sem contrato de fidelidade, sem taxas escondidas.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link
                to="/auth"
                onClick={() => trackFreeTrialStarted({ button_text: "Começar teste grátis", source: "seo_solucoes_footer" })}
              >
                Começar teste grátis <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/landing">Falar com especialista</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
