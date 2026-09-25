import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  CalendarDays,
  Check,
  Crown,
  DollarSign,
  FileSignature,
  Flame,
  Kanban,
  Lock,
  MessageCircle,
  
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
  X,
} from "lucide-react";

/* ────── Hero ────── */
const HeroSection = () => (
  <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.12),transparent)]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(168,85,247,0.08),transparent)]" />
    <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-32 lg:py-36">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/30 text-sm px-4 py-1.5 hover:bg-blue-600/20">
          <Rocket className="w-4 h-4 mr-1.5" /> Plataforma #1 para Imobiliárias Inteligentes
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
          Pare de perder leads, tempo e{" "}
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            dinheiro
          </span>
        </h1>
        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          O CRM imobiliário completo que automatiza sua operação, organiza seus leads 
          e multiplica suas vendas — tudo em um só lugar.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {["IA integrada", "Pipeline visual", "WhatsApp automático", "Relatórios em 1 clique"].map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-sm text-slate-300"
            >
              <Check className="w-3.5 h-3.5 text-green-400" /> {t}
            </span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-base h-14 px-8 rounded-xl shadow-lg shadow-blue-600/25"
            onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}
          >
            Ver planos e preços <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  </section>
);

/* ────── Dores ────── */
const painPoints = [
  { icon: Target, title: "Leads perdidos em planilhas", desc: "Contatos esquecidos no WhatsApp, planilhas desatualizadas e oportunidades que nunca viram venda." },
  { icon: Flame, title: "Follow-ups que nunca acontecem", desc: "Sem lembrete, sem sistema — o cliente esfria e compra com o concorrente." },
  { icon: DollarSign, title: "Comissões descontroladas", desc: "Cálculos manuais de comissão, sem visão clara do financeiro da imobiliária." },
  { icon: FileSignature, title: "Contratos em gaveta", desc: "Documentos espalhados, vencimentos esquecidos, multas e retrabalho constante." },
];

const PainSection = () => (
  <section className="py-16 md:py-24 bg-background">
    <div className="mx-auto max-w-6xl px-4">
      <div className="text-center mb-14">
        <Badge variant="outline" className="text-destructive border-destructive/30 mb-3">
          Diagnóstico
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          Você se identifica com alguma dessas dores?
        </h2>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          Se sim, você está perdendo dinheiro todos os dias sem perceber.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {painPoints.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors">
            <CardContent className="flex gap-4 p-6">
              <div className="shrink-0 rounded-xl bg-destructive/10 p-3 h-fit">
                <Icon className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ────── Solução / Features ────── */
const features = [
  { icon: Kanban, title: "Pipeline Visual (CRM)", desc: "Arraste leads entre etapas, nunca perca uma oportunidade. Visualize todo seu funil de vendas." },
  { icon: Brain, title: "Inteligência Artificial", desc: "Avaliação automática de imóveis, geração de descrições, scoring de leads e análise preditiva." },
  { icon: MessageCircle, title: "WhatsApp Integrado", desc: "Histórico completo de conversas, templates e envio direto sem sair da plataforma." },
  { icon: CalendarDays, title: "Agenda Inteligente", desc: "Visitas com check-in/check-out, lembretes automáticos e confirmação via link." },
  { icon: DollarSign, title: "Financeiro Completo", desc: "Comissões, DRE, relatórios por unidade, previsão de receita e inadimplência." },
  { icon: FileSignature, title: "Gestão de Contratos", desc: "Alertas de vencimento, checklist documental, anexos organizados por ano." },
  { icon: Users, title: "Gestão de Corretores", desc: "Permissões granulares por módulo, desempenho individual e produtividade da equipe." },
  { icon: Search, title: "Q-Capture & Radar", desc: "Captação inteligente de imóveis, monitoramento de oportunidades e análise de mercado." },
  { icon: BarChart3, title: "Dashboards em Tempo Real", desc: "Métricas de performance, metas, ROI por canal e relatórios exportáveis em PDF." },
  { icon: Shield, title: "Segurança Avançada", desc: "Isolamento total de dados, controle de acesso modular e auditoria completa." },
  { icon: Smartphone, title: "100% Responsivo", desc: "Use no celular, tablet ou desktop — sua imobiliária no bolso, em qualquer lugar." },
  { icon: Lock, title: "Propostas & Proprietários", desc: "Geração de propostas profissionais em PDF e CRM completo de proprietários com histórico." },
];

const FeaturesSection = () => (
  <section className="py-16 md:py-24 bg-muted/40">
    <div className="mx-auto max-w-6xl px-4">
      <div className="text-center mb-14">
        <Badge className="bg-primary/10 text-primary border-primary/30 mb-3 hover:bg-primary/10">
          <Zap className="w-3.5 h-3.5 mr-1" /> Solução Completa
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          Tudo que sua imobiliária precisa em um só sistema
        </h2>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          +20 módulos integrados para você focar no que importa: fechar negócios.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="group border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-200">
            <CardContent className="flex gap-4 p-5">
              <div className="shrink-0 rounded-lg bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors h-fit">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);


/* ────── Prova Social ────── */
const metrics = [
  { value: "500+", label: "Corretores ativos" },
  { value: "15.000+", label: "Leads gerenciados" },
  { value: "98%", label: "Satisfação" },
  { value: "3x", label: "Mais conversões" },
];

const testimonials = [
  { name: "Carlos M.", role: "Corretor autônomo", text: "Antes eu perdia leads no WhatsApp. Agora tenho tudo organizado e meu faturamento triplicou em 3 meses." },
  { name: "Patricia S.", role: "Diretora comercial", text: "O financeiro integrado me dá visão total das comissões e inadimplência. Era o que faltava na operação." },
  { name: "Roberto L.", role: "Dono de imobiliária", text: "Consegui reduzir a equipe administrativa em 40% e focar no que importa: fechar negócios." },
];

const SocialProofSection = () => (
  <section className="py-16 md:py-24 bg-muted/40">
    <div className="mx-auto max-w-6xl px-4">
      <div className="grid gap-4 sm:grid-cols-4 mb-14">
        {metrics.map(({ value, label }) => (
          <div key={label} className="text-center py-6 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-3xl md:text-4xl font-extrabold text-primary">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
        Quem usa, recomenda
      </h2>
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map(({ name, role, text }) => (
          <Card key={name} className="border-border/60">
            <CardContent className="p-6 space-y-3">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-foreground italic">"{text}"</p>
              <div>
                <p className="text-sm font-semibold text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ────── Planos ────── */
const plans = [
  {
    name: "Básico",
    price: "19,90",
    priceFrom: "49,90",
    desc: "O essencial para começar",
    badge: null,
    features: ["Pipeline de leads", "Agenda simples", "Gestão de contatos", "Até 50 imóveis", "Até 200 leads", "Sem recursos de IA"],
    gradient: "from-slate-500 to-slate-600",
    border: "border-slate-500/30",
  },
  {
    name: "Intermediário",
    price: "59,90",
    priceFrom: "129,90",
    desc: "Para corretores organizados",
    badge: null,
    features: ["Tudo do Básico +", "Avaliação com IA (5/mês)", "Financeiro básico", "Até 200 imóveis", "Até 1000 leads", "Integração portais"],
    gradient: "from-emerald-500 to-emerald-600",
    border: "border-emerald-500/30",
  },
  {
    name: "Avançado",
    price: "97,90",
    priceFrom: "249,90",
    desc: "O melhor para profissionais",
    badge: "Mais popular",
    features: ["Tudo do Intermediário +", "20 avaliações IA/mês", "Financeiro completo", "Gestão de contratos", "Até 1000 imóveis", "Relatórios PDF"],
    gradient: "from-blue-500 to-blue-600",
    border: "border-blue-500/30",
  },
  {
    name: "Completo",
    price: "197,90",
    priceFrom: "397,90",
    desc: "Inteligência total",
    badge: "VIP",
    features: ["Tudo do Avançado +", "50 avaliações IA/mês", "Imóveis ilimitados", "Corretores ilimitados", "Radar de oportunidades", "Suporte prioritário", "Onboarding dedicado"],
    gradient: "from-purple-500 to-purple-600",
    border: "border-purple-500/30",
  },
  {
    name: "Imobiliária Ilimitado",
    price: "2.997,90",
    priceFrom: "4.997,90",
    desc: "Para grandes imobiliárias",
    badge: "Enterprise",
    features: ["Tudo Liberado", "IA Ilimitada", "Usuários Ilimitados", "Treinamento VIP", "Consultoria Estratégica", "API Dedicada", "SLA 2h"],
    gradient: "from-rose-500 to-rose-600",
    border: "border-rose-500/30",
  },
];

const PlansSection = () => (
  <section id="planos" className="py-16 md:py-24 bg-background">
    <div className="mx-auto max-w-6xl px-4">
      <div className="text-center mb-14">
        <Badge className="bg-green-600/10 text-green-600 border-green-600/30 mb-3 hover:bg-green-600/10">
          <Crown className="w-3.5 h-3.5 mr-1" /> Planos
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          Invista menos do que uma comissão para ganhar muito mais
        </h2>
        <p className="text-muted-foreground mt-2">Cancele quando quiser. Sem fidelidade.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={`relative overflow-hidden ${plan.border} hover:shadow-xl transition-all duration-200 ${plan.badge === "Mais popular" ? "ring-2 ring-blue-500/50 scale-[1.02]" : ""}`}>
            {plan.badge && (
              <div className={`absolute top-0 right-0 bg-gradient-to-r ${plan.gradient} text-white text-xs font-bold px-3 py-1 rounded-bl-lg`}>
                {plan.badge}
              </div>
            )}
            <CardContent className="p-6 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.desc}</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground line-through">R$ {plan.priceFrom}</span>
                <span className="text-4xl font-extrabold text-foreground">R$ {plan.price}</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full bg-gradient-to-r ${plan.gradient} text-white font-bold h-12 rounded-lg`}
                onClick={() => window.open(`https://wa.me/5561984593746?text=${encodeURIComponent(`Olá! Tenho interesse no plano ${plan.name} do Radar ImobTech.`)}`, "_blank")}
              >
                Quero esse plano <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

/* ────── Urgência ────── */
const UrgencySection = () => (
  <section className="py-16 md:py-20 bg-gradient-to-r from-blue-600 to-purple-700 text-white">
    <div className="mx-auto max-w-3xl px-4 text-center space-y-5">
      <h2 className="text-2xl md:text-4xl font-extrabold leading-tight">
        Enquanto você hesita, seu concorrente já está usando
      </h2>
      <p className="text-lg text-blue-100">
        Cada dia sem um CRM profissional é dinheiro deixado na mesa.
      </p>
      <Button
        size="lg"
        className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-base h-14 px-8 rounded-xl shadow-lg"
        onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}
      >
        Começar agora <Rocket className="w-5 h-5 ml-2" />
      </Button>
    </div>
  </section>
);

/* ────── FAQ ────── */
const faqItems = [
  { q: "Preciso instalar alguma coisa?", a: "Não! O sistema é 100% online (SaaS). Basta acessar pelo navegador no celular ou computador." },
  { q: "Meus dados ficam seguros?", a: "Sim. Utilizamos criptografia, isolamento total de dados por conta e controle de acesso granular." },
  { q: "Posso migrar meus dados?", a: "Sim! Oferecemos importação de leads e imóveis via planilha Excel de forma simples e rápida." },
  { q: "Tem contrato de fidelidade?", a: "Não. Você pode cancelar a qualquer momento sem multa ou burocracia." },
  { q: "Como funciona o suporte?", a: "Suporte via WhatsApp em horário comercial. Planos Enterprise têm suporte prioritário e onboarding dedicado." },
  { q: "A IA consome créditos extras?", a: "Cada plano inclui uma cota de uso de IA. Funcionalidades como avaliação de imóvel e geração de conteúdo são incluídas." },
];

const FAQSection = () => (
  <section className="py-16 md:py-24 bg-muted/40">
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

/* ────── CTA Final ────── */
const FinalCTASection = () => (
  <section className="py-16 md:py-20 bg-slate-950 text-white text-center">
    <div className="mx-auto max-w-2xl px-4 space-y-5">
      <h2 className="text-2xl md:text-4xl font-extrabold">
        Sua imobiliária merece um sistema à altura
      </h2>
      <p className="text-slate-400">
        Junte-se a centenas de corretores que já transformaram sua operação.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Button
          size="lg"
          className="bg-green-500 hover:bg-green-600 text-white font-bold text-base h-14 px-8 rounded-xl"
          onClick={() => window.open(`https://wa.me/5561984593746?text=${encodeURIComponent("Olá! Quero conhecer o Radar ImobTech.")}`, "_blank")}
        >
          <MessageCircle className="w-5 h-5 mr-2" /> Falar pelo WhatsApp
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10 font-semibold text-base h-14 px-8 rounded-xl"
          onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}
        >
          Ver planos
        </Button>
      </div>
    </div>
  </section>
);

/* ────── Floating WhatsApp ────── */
const FloatingWhatsApp = () => (
  <a
    href={`https://wa.me/5561984593746?text=${encodeURIComponent("Olá! Quero saber mais sobre o Radar ImobTech.")}`}
    target="_blank"
    rel="noopener noreferrer"
    className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-xl transition-all duration-200 hover:scale-110"
    aria-label="Abrir WhatsApp"
  >
    <MessageCircle className="w-7 h-7" />
  </a>
);

/* ────── Página ────── */
const VendaCRM = () => {

  return (
    <div className="min-h-screen">
      <HeroSection />
      <PainSection />
      <FeaturesSection />
      
      <SocialProofSection />
      <PlansSection />
      <UrgencySection />
      <FAQSection />
      <FinalCTASection />
      <FloatingWhatsApp />
    </div>
  );
};

export default VendaCRM;
