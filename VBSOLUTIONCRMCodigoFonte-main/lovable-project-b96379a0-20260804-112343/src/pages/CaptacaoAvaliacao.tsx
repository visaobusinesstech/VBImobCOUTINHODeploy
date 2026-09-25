import React from "react";
import { AvaliacaoImovelForm } from "@/components/forms/AvaliacaoImovelForm";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  Megaphone,
  MapPin,
  Send,
  Search,
  FileCheck,
  Star,
  ArrowRight,
  Zap,
} from "lucide-react";

const WHATSAPP_NUMBER = "5561984593746";
const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Gostaria de uma avaliação gratuita do meu imóvel.")}`;

/* ────── Hero ────── */
const HeroSection = () => (
  <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />
    <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
        {/* Copy */}
        <div className="space-y-6 text-center lg:text-left animate-in fade-in slide-in-from-left duration-700">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight font-[Space_Grotesk]">
            Descubra quanto vale seu imóvel em minutos
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-xl mx-auto lg:mx-0">
            Receba uma avaliação profissional e comece a vender com segurança e rapidez.
          </p>
          <div className="flex flex-wrap justify-center lg:justify-start gap-3">
            {["Avaliação gratuita", "Sem compromisso", "Resposta rápida"].map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full bg-green-600/20 border border-green-500/30 px-4 py-1.5 text-sm font-medium text-green-300"
              >
                <ShieldCheck className="w-4 h-4" /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl animate-in fade-in slide-in-from-right duration-700">
          <h2 className="text-xl font-bold mb-5 text-center">Solicite sua avaliação</h2>
          <AvaliacaoImovelForm variant="hero" />
        </div>
      </div>
    </div>
  </section>
);

/* ────── Por que avaliar ────── */
const cardData = [
  { icon: TrendingUp, title: "Preço justo baseado no mercado", desc: "Análise comparativa com dados reais da sua região." },
  { icon: Zap, title: "Maior chance de venda rápida", desc: "Imóveis com preço correto saem até 3x mais rápido." },
  { icon: Megaphone, title: "Divulgação estratégica", desc: "Presença nos principais portais e redes sociais." },
  { icon: MapPin, title: "Especialistas locais", desc: "Profissionais que conhecem cada bairro da cidade." },
];

const BenefitsSection = () => (
  <section className="py-16 md:py-24 bg-background">
    <div className="mx-auto max-w-6xl px-4 text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
        Por que avaliar com a gente?
      </h2>
      <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
        Trabalhamos para que você tenha a melhor experiência do início ao fim.
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cardData.map(({ icon: Icon, title, desc }) => (
          <Card
            key={title}
            className="group border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-200"
          >
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ────── Processo ────── */
const steps = [
  { icon: Send, label: "Você envia os dados", desc: "Preencha o formulário em segundos." },
  { icon: Search, label: "Nós avaliamos com especialistas", desc: "Análise profissional e dados de mercado." },
  { icon: FileCheck, label: "Você recebe proposta e próximos passos", desc: "Retorno rápido com orientações claras." },
];

const ProcessSection = () => (
  <section className="py-16 md:py-24 bg-muted/40">
    <div className="mx-auto max-w-4xl px-4 text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
        Simples, rápido e sem burocracia
      </h2>
      <p className="text-muted-foreground mb-12">Como funciona o processo</p>
      <div className="grid gap-8 md:grid-cols-3">
        {steps.map(({ icon: Icon, label, desc }, i) => (
          <div key={label} className="flex flex-col items-center gap-3 animate-in fade-in duration-500" style={{ animationDelay: `${i * 150}ms` }}>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-xl font-bold shadow-md">
              {i + 1}
            </div>
            <Icon className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">{label}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ────── Prova Social ────── */
const metrics = [
  { value: "1.200+", label: "Imóveis avaliados" },
  { value: "850+", label: "Vendidos com sucesso" },
  { value: "2.500+", label: "Clientes satisfeitos" },
];

const testimonials = [
  { name: "Marcos R.", bairro: "Asa Sul", text: "Recebi proposta em poucos dias após a avaliação. Surpreendente!" },
  { name: "Camila S.", bairro: "Águas Claras", text: "Profissionalismo do início ao fim. Vendemos acima do esperado." },
  { name: "João P.", bairro: "Sudoeste", text: "Atendimento rápido e transparente. Recomendo a todos." },
];

const SocialProofSection = () => (
  <section className="py-16 md:py-24 bg-background">
    <div className="mx-auto max-w-6xl px-4">
      <div className="grid gap-4 sm:grid-cols-3 mb-14">
        {metrics.map(({ value, label }) => (
          <div key={label} className="text-center py-6 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-3xl md:text-4xl font-extrabold text-primary">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
        O que nossos clientes dizem
      </h2>
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map(({ name, bairro, text }) => (
          <Card key={name} className="border-border/60">
            <CardContent className="p-6 space-y-3">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-foreground italic">"{text}"</p>
              <p className="text-xs text-muted-foreground font-medium">
                {name} — {bairro}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ────── Urgência ────── */
const UrgencySection = () => (
  <section className="py-16 md:py-20 bg-gradient-to-r from-primary to-blue-700 text-white">
    <div className="mx-auto max-w-3xl px-4 text-center space-y-5">
      <h2 className="text-2xl md:text-4xl font-extrabold leading-tight">
        Imóveis bem avaliados vendem até 3× mais rápido
      </h2>
      <p className="text-lg text-blue-100">
        Não perca dinheiro anunciando pelo preço errado.
      </p>
      <Button
        size="lg"
        className="bg-green-500 hover:bg-green-600 text-white font-bold text-base h-12 px-8 transition-all duration-200"
        onClick={() => document.getElementById("formulario-completo")?.scrollIntoView({ behavior: "smooth" })}
        aria-label="Solicitar avaliação agora"
      >
        Solicitar avaliação agora <ArrowRight className="w-5 h-5 ml-1" />
      </Button>
    </div>
  </section>
);

/* ────── Formulário Completo ────── */
const FullFormSection = () => (
  <section id="formulario-completo" className="py-16 md:py-24 bg-muted/40">
    <div className="mx-auto max-w-2xl px-4">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-2">
        Preencha para receber sua avaliação
      </h2>
      <p className="text-muted-foreground text-center mb-8">
        Quanto mais detalhes, mais precisa será a análise.
      </p>
      <Card className="border-border/60 shadow-lg">
        <CardContent className="p-6 md:p-8">
          <AvaliacaoImovelForm variant="full" />
        </CardContent>
      </Card>
    </div>
  </section>
);

/* ────── FAQ ────── */
const faqItems = [
  { q: "A avaliação é realmente gratuita?", a: "Sim, 100% gratuita e sem compromisso. Nosso objetivo é ajudar você a entender o valor real do seu imóvel." },
  { q: "Em quanto tempo recebo retorno?", a: "Normalmente em até 24 horas úteis após o envio dos dados." },
  { q: "Preciso fechar contrato?", a: "Não. A avaliação é independente. Você decide se quer prosseguir conosco." },
  { q: "Como vocês divulgam meu imóvel?", a: "Utilizamos os principais portais imobiliários, redes sociais e nossa base qualificada de compradores." },
];

const FAQSection = () => (
  <section className="py-16 md:py-24 bg-background">
    <div className="mx-auto max-w-2xl px-4">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
        Perguntas frequentes
      </h2>
      <Accordion type="single" collapsible className="space-y-2">
        {faqItems.map(({ q, a }, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4 bg-card">
            <AccordionTrigger className="text-left font-medium text-foreground">{q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

/* ────── Demonstração CRM ────── */
const DemoCRMSection = () => (
  <section className="py-16 md:py-24 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-900 text-white">
    <div className="mx-auto max-w-4xl px-4">
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 px-4 py-1.5 text-sm font-medium text-blue-300 mb-4">
          <Zap className="w-4 h-4" /> Para Corretores e Imobiliárias
        </span>
        <h2 className="text-2xl md:text-4xl font-extrabold mb-3">
          Quer uma demonstração <span className="text-blue-400">gratuita</span> do nosso CRM?
        </h2>
        <p className="text-slate-300 text-lg max-w-2xl mx-auto">
          Conheça a plataforma que está revolucionando o mercado imobiliário. Agende uma demonstração personalizada sem compromisso.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          {[
            "CRM completo com pipeline visual",
            "Avaliação de imóveis com IA",
            "Gestão financeira integrada",
            "Automações de WhatsApp",
            "7 dias de teste grátis",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
              </div>
              <span className="text-sm text-slate-200">{item}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Gostaria de agendar uma demonstração gratuita do CRM.")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-base h-14 transition-all duration-200">
              <MessageCircle className="w-5 h-5 mr-2" /> Agendar demonstração pelo WhatsApp
            </Button>
          </a>
          <a href="https://radarimobtech.shop" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 font-bold text-base h-14 transition-all duration-200">
              Conhecer a plataforma <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  </section>
);

/* ────── CTA Final ────── */
const FinalCTASection = () => (
  <section className="py-16 md:py-20 bg-slate-900 text-white text-center">
    <div className="mx-auto max-w-2xl px-4 space-y-5">
      <h2 className="text-2xl md:text-4xl font-extrabold">
        Seu imóvel pode valer mais do que você imagina
      </h2>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          size="lg"
          className="bg-green-500 hover:bg-green-600 text-white font-bold text-base h-12 px-8 transition-all duration-200"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Descobrir valor agora"
        >
          Avaliar meu imóvel agora <ArrowRight className="w-5 h-5 ml-1" />
        </Button>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Gostaria de agendar uma demonstração gratuita do CRM.")}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 font-bold text-base h-12 px-8">
            <MessageCircle className="w-5 h-5 mr-1" /> Demonstração CRM
          </Button>
        </a>
      </div>
    </div>
  </section>
);

/* ────── Floating WhatsApp ────── */
const FloatingWhatsApp = () => (
  <a
    href={whatsappLink}
    target="_blank"
    rel="noopener noreferrer"
    className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-xl transition-all duration-200 hover:scale-110"
    aria-label="Abrir WhatsApp"
  >
    <MessageCircle className="w-7 h-7" />
  </a>
);

/* ────── Página ────── */
const CaptacaoAvaliacao = () => (
  <div className="min-h-screen">
    <HeroSection />
    <BenefitsSection />
    <ProcessSection />
    <SocialProofSection />
    <UrgencySection />
    <FullFormSection />
    <FAQSection />
    <DemoCRMSection />
    <FinalCTASection />
    <FloatingWhatsApp />
  </div>
);

export default CaptacaoAvaliacao;
