import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, XCircle, Zap, Brain, MessageCircle, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

const PATH = "/comparativo/kenlo-vs-radarimobtech";
const TITLE = "Kenlo vs radarimobtech: qual CRM imobiliário escolher em 2026";
const DESCRIPTION =
  "Comparativo direto entre Kenlo e radarimobtech: preço, IA de avaliação, WhatsApp automático, captação inteligente e melhor CRM imobiliário para corretor autônomo e imobiliárias pequenas.";

const FEATURES: Array<{ feature: string; kenlo: boolean | string; radar: boolean | string; highlight?: boolean }> = [
  { feature: "CRM de leads e pipeline visual (Kanban)", kenlo: true, radar: true },
  { feature: "Gestão de contratos de locação e venda", kenlo: true, radar: true },
  { feature: "Financeiro integrado (aluguel, comissões, DRE)", kenlo: true, radar: true },
  { feature: "IA para avaliação de imóveis (CMA automático)", kenlo: "Limitado", radar: true, highlight: true },
  { feature: "Extração de dados de anúncio por link (IA)", kenlo: false, radar: true, highlight: true },
  { feature: "Detecção de dor do proprietário (>45 dias no mercado)", kenlo: false, radar: true, highlight: true },
  { feature: "WhatsApp Business com follow-up automático diário", kenlo: "Complemento pago", radar: true, highlight: true },
  { feature: "Fila de distribuição de leads round-robin", kenlo: true, radar: true },
  { feature: "Landing pages programáticas por cidade/bairro (SEO)", kenlo: false, radar: true, highlight: true },
  { feature: "Auditoria Lighthouse semanal + alertas de regressão", kenlo: false, radar: true, highlight: true },
  { feature: "Portal de LGPD para o titular dos dados", kenlo: "Sob demanda", radar: true },
  { feature: "Multi-tenant nativo com RLS por imobiliária", kenlo: true, radar: true },
  { feature: "Trial grátis sem cartão", kenlo: "Sob demanda comercial", radar: true, highlight: true },
  { feature: "Onboarding assistido por IA", kenlo: false, radar: true, highlight: true },
];

const FAQ = [
  {
    q: "Kenlo ou radarimobtech: qual é melhor para corretor autônomo?",
    a: "Para corretor autônomo e imobiliárias pequenas (até 20 corretores) a radarimobtech tende a ser melhor porque entrega IA de avaliação, extração automática de anúncios e captação inteligente com detecção de dor do proprietário sem plano corporativo. A Kenlo (ex-Ingaia) é forte em imobiliária tradicional de grande porte, mas cobra por módulos e não inclui SEO programático nem WhatsApp automatizado nativo.",
  },
  {
    q: "Qual é a diferença de preço entre Kenlo e radarimobtech?",
    a: "A Kenlo trabalha com pacotes por módulo e cobrança comercial customizada. A radarimobtech tem planos transparentes com trial grátis de 7 dias sem cartão, cobrindo CRM, contratos, financeiro, IA e SEO no mesmo assinatura.",
  },
  {
    q: "A radarimobtech substitui a Kenlo em todas as funcionalidades?",
    a: "Cobre 100% das funções essenciais (CRM, contratos, financeiro, portais XML, WhatsApp) e adiciona IA de avaliação, captação com detecção de dor, SEO programático e auditoria Lighthouse. Se sua imobiliária depende de integrações muito específicas com CRMs legados corporativos, vale mapear caso a caso.",
  },
  {
    q: "Consigo migrar meus dados da Kenlo para a radarimobtech?",
    a: "Sim. Suportamos importação de leads, imóveis, contratos e proprietários via CSV. Nossa equipe orienta o mapeamento inicial para evitar duplicidade.",
  },
  {
    q: "A radarimobtech atende quais cidades?",
    a: "Todo o Brasil. Temos landing pages programáticas de SEO por cidade e bairro, com foco atual no DF, GO, SP, RJ, MG, PR, SC, RS.",
  },
];

const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    author: { "@type": "Organization", name: "radarimobtech" },
    publisher: { "@type": "Organization", name: "radarimobtech" },
    mainEntityOfPage: `https://radarimobtech.shop${PATH}`,
    datePublished: "2026-07-21",
    dateModified: "2026-07-21",
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
      { "@type": "ListItem", position: 2, name: "Comparativos", item: "https://radarimobtech.shop/comparativo" },
      { "@type": "ListItem", position: 3, name: "Kenlo vs radarimobtech", item: `https://radarimobtech.shop${PATH}` },
    ],
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Sim" />;
  if (value === false) return <XCircle className="h-5 w-5 text-slate-300" aria-label="Não" />;
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

export default function ComparativoKenloRadarimobtech() {
  return (
    <div className="min-h-screen bg-background">
      <Seo title={TITLE} description={DESCRIPTION} path={PATH} type="article" jsonLd={JSON_LD} />

      <header className="border-b bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <Badge variant="secondary" className="mb-4">Comparativo 2026</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Kenlo vs radarimobtech: qual CRM imobiliário escolher em 2026
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Análise honesta e feature-by-feature entre a Kenlo (antiga Ingaia) e a radarimobtech, o
            CRM imobiliário com IA, WhatsApp automatizado e SEO nativo para corretor autônomo e
            imobiliárias que querem crescer sem depender de consultoria.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Button asChild size="lg">
              <Link to="/auth">Testar radarimobtech grátis <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/solucoes/seo-imobiliario">Ver SEO imobiliário</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold mb-6">Resumo em 30 segundos</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Brain, title: "IA embarcada", desc: "Avaliação automática, extração de anúncios e pontuação de motivação do proprietário." },
            { icon: MessageCircle, title: "WhatsApp automático", desc: "Follow-up diário via API Business com templates aprovados por imobiliária." },
            { icon: Sparkles, title: "SEO programático", desc: "Centenas de landing pages por cidade e bairro geradas automaticamente." },
          ].map((c) => (
            <Card key={c.title}>
              <CardHeader>
                <c.icon className="h-6 w-6 text-primary mb-2" />
                <CardTitle className="text-base">{c.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{c.desc}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold mb-6">Comparativo detalhado</h2>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/2">Recurso</TableHead>
                <TableHead className="text-center">Kenlo</TableHead>
                <TableHead className="text-center">radarimobtech</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FEATURES.map((f) => (
                <TableRow key={f.feature} className={f.highlight ? "bg-primary/5" : ""}>
                  <TableCell className="font-medium">{f.feature}</TableCell>
                  <TableCell className="text-center"><div className="flex justify-center"><Cell value={f.kenlo} /></div></TableCell>
                  <TableCell className="text-center"><div className="flex justify-center"><Cell value={f.radar} /></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Comparativo elaborado com base em informações públicas dos sites e planos comerciais dos
          fornecedores em julho de 2026. Se algum dado estiver desatualizado, entre em contato para
          revisão.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold mb-6">Quando escolher cada um</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Escolha a Kenlo se…</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Você opera uma imobiliária de grande porte (50+ corretores) com processos ISO já consolidados.</p>
              <p>• Precisa de integrações corporativas específicas com ERPs de construtoras.</p>
              <p>• Tem equipe interna para operar e customizar módulos separadamente.</p>
            </CardContent>
          </Card>
          <Card className="border-primary">
            <CardHeader>
              <Badge className="w-fit mb-2">Recomendado</Badge>
              <CardTitle>Escolha a radarimobtech se…</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• É corretor autônomo ou imobiliária de até 30 corretores buscando crescimento.</p>
              <p>• Quer IA para avaliar, captar e responder proprietários sem contratar tech.</p>
              <p>• Precisa de SEO orgânico funcionando sem contratar agência.</p>
              <p>• Prefere assinatura transparente com trial grátis, sem consultoria obrigatória.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold mb-6">Perguntas frequentes</h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="border-t bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-semibold mb-3">Migre para a radarimobtech em 7 dias</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Importação assistida de leads, imóveis e contratos. Sem taxa de setup. Trial grátis
            de 7 dias com todos os recursos de IA liberados.
          </p>
          <Button asChild size="lg">
            <Link to="/auth">Começar teste grátis <Zap className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
