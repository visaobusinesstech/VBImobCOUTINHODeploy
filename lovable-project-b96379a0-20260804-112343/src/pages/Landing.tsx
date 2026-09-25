import { useState, useEffect, useRef } from "react";
import { Seo } from "@/components/Seo";
import { Link } from "react-router-dom";
import { LoginDialog } from "@/components/LoginDialog";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, useInView } from "framer-motion";
import {
  Building2, Kanban, Users, DollarSign, FileSignature, CalendarDays, Search, Shield,
  ChevronRight, Check, Star, ArrowRight, BarChart3, Globe, Smartphone, Lock, TrendingUp,
  Menu, X, Send, Loader2, Play, Brain, Target, Crown, Sparkles, Rocket,
  ChevronDown, Bot, LayoutGrid, LineChart, Megaphone, Zap, Eye, MessageCircle,
  MapPin, Award, Flame, Diamond, CircleDollarSign, Gem, Trophy, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackFreeTrialStarted, trackFreeTrialSignupSuccess, trackFormSubmission } from "@/lib/analytics";
import { SocialProof } from "@/components/landing/SocialProof";
import { AuditoriaGratisDialog } from "@/components/landing/AuditoriaGratisDialog";

// ==================== ANIMATIONS ====================
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number) => ({
    opacity: 1, scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

// ==================== PLANS ====================
const plans = [
  {
    name: "Gratuito",
    planId: "gratuito",
    emoji: "🟢",
    price: "0",
    priceFrom: null,
    desc: "Teste grátis por 7 dias com acesso a todos os recursos",
    badge: "Trial 7 dias",
    gradient: "from-emerald-500 to-emerald-600",
    borderColor: "border-emerald-500/30",
    features: ["CRM Pipeline completo", "Gestão de imóveis", "Agenda inteligente", "Follow-up automático", "1 avaliação IA", "1 captação IA", "Integração com portais"],
  },
  {
    name: "Básico",
    planId: "lite",
    emoji: "⚪",
    price: "19,90",
    priceFrom: "49,90",
    desc: "O essencial para quem está começando agora",
    badge: "Econômico",
    gradient: "from-slate-400 to-slate-500",
    borderColor: "border-slate-400/30",
    features: ["CRM Pipeline essencial", "Gestão de contatos", "Agenda simples", "Até 50 imóveis", "Até 200 leads", "Sem recursos de IA"],
  },
  {
    name: "Intermediário",
    planId: "basico",
    emoji: "🔵",
    price: "59,90",
    priceFrom: "129,90",
    desc: "Para corretores que querem organização real",
    badge: null,
    gradient: "from-blue-500 to-blue-600",
    borderColor: "border-blue-500/30",
    features: ["CRM Completo", "Gestão de imóveis (200)", "Agenda inteligente", "Follow-up automático", "Financeiro básico", "5 avaliações IA/mês", "5 captações IA/mês", "Integração com portais"],
  },
  {
    name: "Avançado",
    planId: "profissional",
    emoji: "🟣",
    price: "97,90",
    priceFrom: "249,90",
    desc: "O melhor custo-benefício para profissionais",
    badge: "Mais Popular",
    gradient: "from-violet-500 to-violet-600",
    borderColor: "border-violet-500/50",
    features: ["Tudo do Intermediário +", "20 avaliações IA/mês", "20 captações IA/mês", "Conteúdo SEO com IA", "Financeiro completo", "Comparador de imóveis", "Até 1000 imóveis"],
  },
  {
    name: "Completo",
    planId: "premium",
    emoji: "⚫",
    price: "197,90",
    priceFrom: "397,90",
    desc: "Domine o mercado com inteligência total",
    badge: "Exclusivo",
    gradient: "from-amber-500 to-amber-600",
    borderColor: "border-amber-500/50",
    features: ["Tudo do Avançado +", "50 avaliações IA/mês", "50 captações IA/mês", "Gestão de contratos", "Relatórios avançados", "Suporte prioritário VIP", "Até 5000 imóveis"],
  },
  {
    name: "Imobiliária Ilimitado",
    planId: "imobiliaria",
    emoji: "🏢",
    price: "2.997,90",
    priceFrom: "4.997,90",
    desc: "Sem limites para sua grande imobiliária",
    badge: "Ilimitado",
    gradient: "from-rose-500 to-rose-600",
    borderColor: "border-rose-500/50",
    features: ["Tudo liberado, sem limites", "IA ilimitada (todos recursos)", "Multi usuários ilimitados", "Automações avançadas", "Gestão completa de contratos", "Relatórios e dashboards", "Suporte VIP dedicado"],
  },
];

const testimonials = [
  { name: "Carlos Mendes", role: "Diretor — Mendes Imóveis", text: "O radarimobtech transformou nossa operação. A captação automática sozinha já pagou o investimento em 2 semanas.", stars: 5 },
  { name: "Ana Beatriz", role: "Corretora Autônoma", text: "Finalmente um sistema completo feito para quem vive do mercado imobiliário. O financeiro é sensacional.", stars: 5 },
  { name: "Roberto Silva", role: "CEO — Silva & Associados", text: "O Radar de Oportunidades nos deu vantagem competitiva enorme. Identificamos imóveis subvalorizados antes da concorrência.", stars: 5 },
];

// ==================== ANIMATED COUNTER ====================
function AnimatedCounter({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let current = 0;
    const step = target / 50;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, 20);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref} className="tabular-nums">{prefix}{count.toLocaleString("pt-BR")}{suffix}</span>;
}




// ==================== CONTACT FORM ====================
const CONTACT_WHATSAPP_NUMBER = "5561984593746";

function buildContactWhatsappUrl(form: { nome: string; email: string; telefone: string; mensagem: string }) {
  const message = [
    "Olá! Recebi um novo cadastro pela landing page:",
    `Nome: ${form.nome.trim()}`,
    `E-mail: ${form.email.trim()}`,
    form.telefone.trim() ? `Telefone: ${form.telefone.trim()}` : null,
    `Mensagem: ${form.mensagem.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function openWhatsapp(url: string) {
  const whatsappWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (whatsappWindow) {
    whatsappWindow.opener = null;
    whatsappWindow.focus();
    return true;
  }

  return false;
}

function ContactForm() {
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", mensagem: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const snapshot = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      mensagem: form.mensagem.trim(),
    };

    if (!snapshot.nome || !snapshot.email || !snapshot.mensagem) {
      toast.error("Preencha nome, email e mensagem.");
      return;
    }

    const whatsappUrl = buildContactWhatsappUrl(snapshot);
    const whatsappOpened = openWhatsapp(whatsappUrl);

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("contato-landing", { body: snapshot });
      if (error) throw error;
      trackFormSubmission({
        form_id: "landing-contact",
        form_name: "Contato Landing",
        lead_type: "contact",
      });
      toast.success("Cadastro enviado! Confira o WhatsApp.");
      setForm({ nome: "", email: "", telefone: "", mensagem: "" });
    } catch (error) {
      console.error("[LandingPage:update:error]", error);
      toast.error("Não foi possível confirmar o envio agora. Se o WhatsApp não abriu, use o link abaixo.");
    } finally {
      setSending(false);
      if (!whatsappOpened) {
        window.location.assign(whatsappUrl);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact-nome">Nome *</Label>
          <Input id="contact-nome" placeholder="Seu nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email *</Label>
          <Input id="contact-email" type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-telefone">Telefone</Label>
        <Input id="contact-telefone" placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-mensagem">Mensagem *</Label>
        <Textarea id="contact-mensagem" placeholder="Como podemos ajudar?" value={form.mensagem} onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))} rows={4} required />
      </div>
      <Button type="submit" disabled={sending} className="w-full bg-gradient-to-r from-primary to-blue-600">
        {sending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>) : (<><Send className="w-4 h-4 mr-2" /> Enviar Mensagem</>)}
      </Button>
      <div className="flex items-center justify-center gap-2 pt-2">
        <MessageCircle className="w-4 h-4 text-green-600" />
        <a href="https://wa.me/5561984593746?text=Olá! Gostaria de mais informações sobre a plataforma." target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-600 hover:underline">
          WhatsApp: (61) 98459-3746
        </a>
      </div>
    </form>
  );
}

function LeadCaptureForm() {
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", interesse: "demonstracao" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const interesseLabel = form.interesse === "demonstracao" ? "Demonstração gratuita" : form.interesse === "planos" ? "Informações sobre planos" : "Teste grátis";
    const snapshot = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      mensagem: `[Lead Captado - Landing Page]\nInteresse: ${interesseLabel}\nTelefone: ${form.telefone.trim() || "Não informado"}`,
    };

    if (!snapshot.nome || !snapshot.email) {
      toast.error("Preencha nome e email.");
      return;
    }

    const whatsappMessage = [
      `Olá! Novo lead pela Landing Page:`,
      `Nome: ${snapshot.nome}`,
      `Email: ${snapshot.email}`,
      snapshot.telefone ? `Telefone: ${snapshot.telefone}` : null,
      `Interesse: ${interesseLabel}`,
    ].filter(Boolean).join("\n");
    const whatsappUrl = `https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
    const whatsappOpened = openWhatsapp(whatsappUrl);

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("contato-landing", { body: snapshot });
      if (error) throw error;
      trackFormSubmission({
        form_id: "landing-lead-capture",
        form_name: "Captura Landing",
        lead_type: form.interesse === "demonstracao" ? "demo" : "landing_capture",
        extra: { interesse: form.interesse },
      });
      if (form.interesse === "gratis" || form.interesse === "demonstracao") {
        trackFreeTrialSignupSuccess({
          plan_selected: "gratuito",
          signup_method: "email_password",
        });
      }
      toast.success("Cadastro recebido! Confira o WhatsApp.");
      setForm({ nome: "", email: "", telefone: "", interesse: "demonstracao" });
    } catch (error) {
      console.error("[LeadCapture:error]", error);
      toast.error("Erro ao salvar. Se o WhatsApp não abriu, use o link abaixo.");
    } finally {
      setSending(false);
      if (!whatsappOpened) {
        window.location.assign(whatsappUrl);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lead-nome">Nome completo *</Label>
          <Input id="lead-nome" placeholder="Seu nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-email">Email profissional *</Label>
          <Input id="lead-email" type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lead-telefone">WhatsApp / Telefone</Label>
          <Input id="lead-telefone" placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-interesse">O que te interessa?</Label>
          <select
            id="lead-interesse"
            value={form.interesse}
            onChange={(e) => setForm((f) => ({ ...f, interesse: e.target.value }))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="demonstracao">Demonstração gratuita</option>
            <option value="planos">Informações sobre planos</option>
            <option value="teste">Quero testar grátis</option>
          </select>
        </div>
      </div>
      <Button type="submit" disabled={sending} size="lg" className="w-full bg-gradient-to-r from-primary to-blue-600 text-base py-6 rounded-xl shadow-lg shadow-primary/20">
        {sending ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Enviando...</>) : (<><Send className="w-5 h-5 mr-2" /> Quero receber contato</>)}
      </Button>
      <p className="text-xs text-muted-foreground text-center">Seus dados estão seguros. Não enviamos spam.</p>
      <div className="flex items-center justify-center gap-2 pt-2">
        <MessageCircle className="w-4 h-4 text-green-600" />
        <a href="https://wa.me/5561984593746?text=Olá! Gostaria de agendar uma demonstração gratuita." target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-600 hover:underline">
          Ou fale direto no WhatsApp: (61) 98459-3746
        </a>
      </div>
    </form>
  );
}

function PlanCTAButton({ plan, isPopular, isPremium }: { plan: typeof plans[number]; isPopular: boolean; isPremium: boolean }) {
  const [sending, setSending] = useState(false);

  const handleClick = async () => {
    const whatsappUrl = `https://wa.me/5561984593746?text=${encodeURIComponent(`Olá! Tenho interesse no plano ${plan.name}.`)}`;
    const whatsappOpened = openWhatsapp(whatsappUrl);

    setSending(true);
    try {
      await supabase.functions.invoke("contato-landing", {
        body: {
          nome: `[Interesse Plano ${plan.name}]`,
          email: "plano@interesse.landing",
          mensagem: `Interesse no plano ${plan.name} (R$${plan.price}/mês) via botão Landing Page`,
        },
      });
    } catch (err) {
      console.error("[PlanCTA:error]", err);
    } finally {
      setSending(false);
      if (!whatsappOpened) {
        window.location.assign(whatsappUrl);
      }
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={sending}
      className={`w-full mt-4 rounded-2xl ${isPopular ? "bg-gradient-to-r from-primary to-blue-600 shadow-md shadow-primary/20" : isPremium ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-90" : ""}`}
      variant={isPopular || isPremium ? "default" : "outline"}
    >
      {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
      Começar Agora
    </Button>
  );
}
function DashboardMockup() {
  const kpis = [
    { label: "Leads", value: "47", trend: "+12%", up: true },
    { label: "Imóveis", value: "128", trend: "+5%", up: true },
    { label: "Receita", value: "R$38k", trend: "+23%", up: true },
    { label: "Contratos", value: "14", trend: "+8", up: true },
  ];
  const bars = [60, 45, 80, 55, 90, 70, 85];
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];
  return (
    <div className="p-4 bg-muted/20 min-h-[260px] space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className="bg-background rounded-xl border border-border/60 p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-[10px] text-muted-foreground mb-1">{k.label}</div>
            <div className="text-base font-extrabold">{k.value}</div>
            <div className={`text-[10px] font-semibold mt-0.5 ${k.up ? "text-green-500" : "text-red-400"}`}>{k.trend}</div>
          </div>
        ))}
      </div>
      <div className="bg-background rounded-xl border border-border/60 p-3 shadow-sm">
        <div className="text-xs font-semibold mb-3">Leads por dia</div>
        <div className="flex items-end gap-1.5" style={{ height: "80px" }}>
          {bars.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div
                className="w-full rounded-t-sm bg-gradient-to-t from-primary to-primary/60"
                style={{ height: `${h}%`, minHeight: "4px" }}
              />
              <span className="text-[9px] text-muted-foreground">{days[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN LANDING ====================
export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      <Seo
        title="radarimobtech — CRM imobiliário com IA e captação de proprietários"
        description="CRM para corretores e imobiliárias com avaliação de imóveis por IA (SAS), captação direta de proprietários no DF e automações de WhatsApp. Teste grátis por 7 dias."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "radarimobtech",
          url: "https://radarimobtech.shop/",
          logo: "https://radarimobtech.shop/pwa-512.png",
          sameAs: ["https://wa.me/5561984593746"],
        }}
      />
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ==================== NAVBAR ==================== */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">
              radar<span className="text-primary">imobtech</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#problema" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Dor</a>
            <a href="#solucao" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Solução</a>
            <a href="#valor" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Valor</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Planos</a>
            <a href="https://wa.me/5561984593746" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Fale Conosco</a>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">Painel</Button>
              </Link>
            ) : (
              <LoginDialog trigger={<Button variant="ghost" size="sm">Entrar</Button>} defaultMode="login" />
            )}
            <a
              href="#lead-capture"
              onClick={() => trackFreeTrialStarted({ button_text: "Demonstração gratuita", source: "navbar" })}
            >
              <Button size="sm" className="bg-gradient-to-r from-primary to-blue-600 hover:opacity-90 rounded-2xl shadow-md shadow-primary/20">
                Demonstração gratuita <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden bg-background border-b border-border px-4 pb-4 space-y-3">
            <a href="#problema" className="block text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Dor</a>
            <a href="#solucao" className="block text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Solução</a>
            <a href="#valor" className="block text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Valor</a>
            <a href="#pricing" className="block text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Planos</a>
            <a href="https://wa.me/5561984593746" target="_blank" rel="noopener noreferrer" className="block text-sm py-2" onClick={() => setMobileMenuOpen(false)}>Fale Conosco</a>
            {user ? (
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full" size="sm">Painel</Button>
              </Link>
            ) : (
              <LoginDialog trigger={<Button variant="outline" className="w-full" size="sm">Entrar</Button>} defaultMode="login" />
            )}
            <a
              href="#lead-capture"
              onClick={() => {
                trackFreeTrialStarted({ button_text: "Demonstração gratuita", source: "mobile_menu" });
                setMobileMenuOpen(false);
              }}
            >
              <Button className="w-full" size="sm">Demonstração gratuita</Button>
            </a>
          </motion.div>
        )}
      </nav>

      {/* Mobile floating CTA for logged-in users */}
      {user && (
        <Link to="/dashboard" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
          <Button size="lg" className="bg-gradient-to-r from-primary to-blue-600 shadow-xl shadow-primary/30 rounded-full px-6 gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <LayoutGrid className="w-5 h-5" /> Acessar Painel
          </Button>
        </Link>
      )}

      {/* ==================== 1. HERO ==================== */}
      <section className="relative min-h-screen flex items-center overflow-hidden px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.10),transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(220_70%_50%/0.06),transparent_50%)] pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle,hsl(var(--primary)/0.04),transparent_70%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative w-full">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left — Copy */}
            <div>
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
                <Badge variant="secondary" className="mb-6 border-primary/20 px-4 py-1.5 text-sm font-medium">
                  <Rocket className="mr-1.5 inline h-4 w-4 text-primary" /> Plataforma completa para corretores
                </Badge>
              </motion.div>

              <motion.h1
                initial="hidden" animate="visible" variants={fadeUp} custom={1}
                className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.08]"
              >
                O único sistema que transforma corretores em{" "}
                <span className="text-primary">máquinas de faturamento</span>
              </motion.h1>

              <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2} className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                CRM, imóveis, financeiro e inteligência artificial em um único lugar — sem depender de múltiplas ferramentas.
              </motion.p>

              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2.5} className="mt-8 space-y-3">
                {[
                  { icon: TrendingUp, text: "Aumente suas vendas com IA" },
                  { icon: Zap, text: "Automatize seu atendimento e follow-up" },
                  { icon: BarChart3, text: "Controle total da sua carteira e financeiro" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{item.text}</span>
                  </div>
                ))}
              </motion.div>

              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <a
                  href="#lead-capture"
                  onClick={() => trackFreeTrialStarted({ button_text: "Solicitar demonstração gratuita", source: "hero_cta" })}
                >
                  <Button size="lg" className="bg-gradient-to-r from-primary to-blue-600 px-10 py-6 text-base shadow-lg shadow-primary/25 hover:opacity-90 rounded-2xl">
                    Solicitar demonstração gratuita <ChevronRight className="ml-1 h-5 w-5" />
                  </Button>
                </a>
                <a href="#solucao">
                  <Button variant="outline" size="lg" className="px-8 py-6 text-base rounded-2xl">
                    <Play className="mr-2 h-5 w-5" /> Ver como funciona
                  </Button>
                </a>
              </motion.div>

              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3.2} className="mt-4">
                <AuditoriaGratisDialog
                  source="hero_secondary_cta"
                  trigger={
                    <button
                      type="button"
                      className="group inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      <Sparkles className="w-4 h-4" />
                      Prefere? Peça uma <span className="underline">auditoria grátis do seu site</span> em 2 passos
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  }
                />
              </motion.div>


              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3.5} className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {["Sem cartão", "7 dias grátis", "Cancele quando quiser"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/75 px-3 py-1">
                    <Check className="h-3.5 w-3.5 text-primary" /> {item}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right — Dashboard Mockup */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}>
              <div className="rounded-2xl border border-border/60 shadow-2xl shadow-primary/10 overflow-hidden bg-background ring-1 ring-primary/5">
                <div className="h-9 bg-muted/80 border-b border-border/50 flex items-center gap-2 px-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                  <div className="flex-1 mx-3 h-5 rounded-lg bg-border/40 flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground/60 font-medium">app.radarimobtech.com</span>
                  </div>
                </div>
                <DashboardMockup />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== PROVA SOCIAL — DEPOIMENTOS + LOGOS ==================== */}
      <SocialProof />

      {/* ==================== LEAD CAPTURE — DEMONSTRAÇÃO GRATUITA ==================== */}
      <section id="lead-capture" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/[0.06] via-background to-violet-500/[0.04] border-y border-border/50">

        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <Badge variant="secondary" className="mb-4 px-4 py-1.5">
                <Rocket className="w-4 h-4 mr-1.5 inline text-primary" /> Demonstração Gratuita
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                Agende sua demonstração <span className="text-primary">gratuita</span> agora
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Preencha seus dados e receba acesso a uma demonstração personalizada. Sem compromisso, sem cartão de crédito.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Check, text: "Tour completo pela plataforma" },
                  { icon: Check, text: "7 dias de teste grátis inclusos" },
                  { icon: Check, text: "Suporte dedicado durante a demonstração" },
                  { icon: Check, text: "Sem obrigação de contratação" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Prefere um diagnóstico primeiro?
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Peça uma <strong>auditoria grátis do seu site imobiliário</strong> em 2 passos rápidos.
                  Sem cartão, sem compromisso.
                </p>
                <AuditoriaGratisDialog
                  source="lead_capture_secondary"
                  trigger={
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Quero auditoria grátis
                    </Button>
                  }
                />
              </div>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} custom={1}>
              <Card className="border-primary/20 shadow-xl shadow-primary/10">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">Solicite sua demonstração</CardTitle>
                  <p className="text-sm text-muted-foreground">Retornamos em até 24h úteis</p>
                </CardHeader>
                <CardContent>
                  <LeadCaptureForm />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>


      <section id="problema" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border/50">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Se você é corretor, você já passou por isso:
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-5 mb-12">
            {[
              { icon: AlertTriangle, title: "Leads esquecidos", desc: "Oportunidades perdidas porque ninguém fez follow-up a tempo." },
              { icon: LayoutGrid, title: "Falta de organização", desc: "Planilhas, WhatsApp, cadernos… informações espalhadas por todo lado." },
              { icon: DollarSign, title: "Perda de vendas", desc: "Sem processo definido, negociações morrem no meio do caminho." },
              { icon: Zap, title: "Sistemas que não conversam", desc: "CRM de um lado, financeiro de outro, portal separado. Nada integrado." },
            ].map((item, i) => (
              <motion.div key={item.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} custom={i}>
                <Card className="h-full border-destructive/20 bg-destructive/[0.02] hover:border-destructive/40 hover:shadow-lg hover:shadow-destructive/5 transition-all duration-300">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                      <item.icon className="w-6 h-6 text-destructive" />
                    </div>
                    <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={4}>
            <div className="text-center rounded-2xl bg-card border border-border/50 p-8">
              <p className="text-xl sm:text-2xl font-black">
                Isso não é falta de esforço. <span className="text-primary">É falta de sistema.</span>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================== 3. SOLUÇÃO ==================== */}
      <section id="solucao" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 px-4 py-1.5"><Sparkles className="w-4 h-4 mr-1.5 inline text-primary" /> A Solução</Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Uma plataforma. Controle total.
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Tudo que você precisa para vender mais, automatizar processos e escalar sua imobiliária.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Kanban,
                title: "CRM + Leads",
                desc: "Pipeline Kanban visual, follow-up automático, scoring de leads e jornada completa do cliente.",
                gradient: "from-blue-500 to-blue-600",
                features: ["Pipeline visual drag & drop", "Follow-up automático", "Scoring inteligente", "Jornada completa"],
              },
              {
                icon: Building2,
                title: "Gestão de Imóveis",
                desc: "Cadastro completo, portal público profissional, comparador e site próprio para cada imóvel.",
                gradient: "from-emerald-500 to-emerald-600",
                features: ["Cadastro wizard premium", "Portal público integrado", "Comparador de imóveis", "Avaliação com IA"],
              },
              {
                icon: DollarSign,
                title: "Financeiro + IA",
                desc: "Controle de aluguéis, comissões, DRE, inadimplência e inteligência artificial para decisões.",
                gradient: "from-violet-500 to-violet-600",
                features: ["Controle financeiro completo", "Cálculo de comissões", "Relatórios e DRE", "IA para precificação"],
              },
            ].map((item, i) => (
              <motion.div key={item.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} custom={i}>
                <Card className="h-full border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon className="w-7 h-7 text-white" />
                    </div>
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">{item.desc}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {item.features.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* ==================== 4. VALOR (ANCORAGEM) ==================== */}
      <section id="valor" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.04),transparent_60%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 px-4 py-1.5"><Diamond className="w-4 h-4 mr-1.5 inline text-violet-500" /> Comparação de Valor</Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Quanto custaria usar tudo isso separadamente?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Se você contratasse cada ferramenta de um fornecedor diferente, pagaria <strong className="text-foreground">mais de R$ 4.500/mês</strong>.
            </p>
          </motion.div>

          {/* Comparativo visual */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Ferramentas separadas */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} custom={0}>
              <Card className="h-full border-destructive/20 bg-destructive/[0.02]">
                <CardHeader className="text-center pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                    <X className="w-7 h-7 text-destructive" />
                  </div>
                  <CardTitle className="text-xl">Ferramentas separadas</CardTitle>
                  <p className="text-sm text-muted-foreground">Pagando por cada sistema isolado</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "CRM + Leads + Funil", price: "R$ 150–250" },
                    { label: "Gestão de Imóveis + Portal", price: "R$ 200–500" },
                    { label: "Financeiro Completo", price: "R$ 330–900" },
                    { label: "Contratos + Jurídico", price: "R$ 180–470" },
                    { label: "Inteligência Artificial", price: "R$ 400–1.100" },
                    { label: "Integrações + Automações", price: "R$ 200–600" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm py-2 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold text-destructive">{item.price}</span>
                    </div>
                  ))}
                  <div className="pt-4 text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total mensal</div>
                    <div className="text-3xl font-black text-destructive line-through decoration-2">R$ 1.800 a R$ 4.500</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* radarimobtech */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} custom={1}>
              <Card className="h-full border-primary/30 bg-primary/[0.02] shadow-xl shadow-primary/5">
                <CardHeader className="text-center pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl">radarimobtech</CardTitle>
                  <p className="text-sm text-muted-foreground">Tudo integrado em uma única plataforma</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    "CRM + Pipeline + Follow-up",
                    "Gestão de Imóveis + Portal Público",
                    "Financeiro + Comissões + DRE",
                    "Contratos + Assinatura Digital",
                    "IA: Avaliação, SEO, Captação, Radar",
                    "WhatsApp + Portais + Automações",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm py-2 border-b border-border/30 last:border-0">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                  <div className="pt-4 text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">A partir de</div>
                    <div className="text-4xl font-black text-primary">R$ 97<span className="text-lg font-semibold text-muted-foreground">/mês</span></div>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-500/10 text-green-600 px-3 py-1 text-sm font-semibold">
                      <TrendingUp className="w-4 h-4" /> Economia de até 97%
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.p initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2} className="text-center text-lg text-muted-foreground">
            <strong className="text-foreground">Você paga uma fração</strong> do que custaria montar tudo isso separadamente.
          </motion.p>
        </div>
      </section>

      {/* ==================== 5. PLANOS ==================== */}
      <section id="pricing" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border/50">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <Badge variant="secondary" className="mb-4"><Crown className="w-4 h-4 mr-1 inline" /> Planos</Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Escolha o plano ideal para você
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Comece grátis por 7 dias. Escale quando precisar.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => {
              const isPopular = plan.badge === "Mais Popular";
              const isPremium = plan.name === "Premium";
              return (
                <motion.div key={plan.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} custom={i}>
                  <Card className={`h-full relative hover:shadow-xl transition-all duration-300 ${isPopular ? "border-primary shadow-xl shadow-primary/10 scale-[1.03]" : isPremium ? "border-amber-500/50 shadow-lg shadow-amber-500/5" : plan.borderColor} hover:scale-[1.02]`}>
                    {plan.badge && (
                      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                        isPopular ? "bg-primary text-primary-foreground" : isPremium ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white" : "bg-secondary text-secondary-foreground"
                      }`}>
                        {plan.badge}
                      </div>
                    )}
                    <CardHeader className="text-center pt-8">
                      <div className="text-2xl mb-1">{plan.emoji}</div>
                      <CardTitle className="text-xl mb-1">{plan.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{plan.desc}</p>
                      <div className="mt-4">
                        {plan.price === "0" ? (
                          <>
                            <span className="text-4xl font-black">Grátis</span>
                            <div className="text-xs text-muted-foreground mt-1">por 7 dias</div>
                          </>
                        ) : (
                          <>
                            <span className="text-4xl font-black">R${plan.price}</span>
                            <span className="text-muted-foreground text-sm">/mês</span>
                          </>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-8">
                      {plan.features.map((f) => (
                        <div key={f} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                      <PlanCTAButton plan={plan} isPopular={isPopular} isPremium={isPremium} />
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== 6. DIFERENCIAL IA ==================== */}
      <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4"><Bot className="w-4 h-4 mr-1 inline" /> Diferencial</Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              O que ninguém no mercado está fazendo
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Inteligência Artificial integrada em <strong className="text-foreground">todos os módulos</strong>. Este é o diferencial que nenhum concorrente oferece.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Target, title: "Avaliação com IA", desc: "Precificação inteligente com dados de mercado e comparáveis reais." },
              { icon: Megaphone, title: "Geração de anúncios", desc: "Textos otimizados para portais e redes sociais gerados automaticamente." },
              { icon: Brain, title: "Inteligência de carteira", desc: "Análise preditiva com recomendações de ação para sua carteira." },
              { icon: Search, title: "Radar de oportunidades", desc: "Identificação automática de imóveis subvalorizados e tendências." },
            ].map((item, i) => (
              <motion.div key={item.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} custom={i} className="text-center group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-primary/10 border border-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 7. PROVA SOCIAL ==================== */}
      <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border/50">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4"><Star className="w-4 h-4 mr-1 inline fill-yellow-400 text-yellow-400" /> Depoimentos</Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
              Corretores já estão aumentando suas vendas com a plataforma
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full border-border/50 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300">
                  <CardContent className="pt-6">
                    <div className="flex gap-0.5 mb-4">
                      {Array.from({ length: t.stars }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed italic">"{t.text}"</p>
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Perguntas Frequentes</h2>
          </motion.div>
          <div className="space-y-4">
            {[
              { q: "Preciso instalar algum software?", a: "Não! O radarimobtech é 100% web. Basta acessar pelo navegador em qualquer dispositivo." },
              { q: "Posso testar antes de assinar?", a: "Sim! Oferecemos 7 dias de teste grátis com acesso completo, sem necessidade de cartão de crédito." },
              { q: "Qual a diferença entre os planos?", a: "Cada plano libera mais módulos e funcionalidades. O Corretor Solo é ideal para autônomos, o PRO para quem quer mais ferramentas, o Imobiliária para equipes e o Premium é tudo liberado." },
              { q: "Meus dados estão seguros?", a: "Absolutamente. Utilizamos Row Level Security em todas as tabelas, isolamento completo por imobiliária e criptografia." },
              { q: "O sistema tem Inteligência Artificial?", a: "Sim! IA integrada para avaliação de imóveis, geração de conteúdo SEO, captação inteligente e análise de carteira." },
              { q: "A parte de captação de imóveis via grupo de WhatsApp é viável?", a: "Sim! Com o RadarZAP, monitoramos grupos públicos, extraímos dados de imóveis com IA e qualificamos leads automaticamente em tempo real." },
              { q: "Posso cancelar a qualquer momento?", a: "Sim. Sem fidelidade. Cancele quando quiser, sem taxas adicionais." },
            ].map((faq, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.5}>
                <details className="group border border-border/50 rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-sm font-semibold hover:bg-muted/50 transition-colors list-none">
                    <span>{faq.q}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</div>
                </details>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== CONTACT ==================== */}
      <section id="contato" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border/50">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Contato</Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Fale Conosco</h2>
            <p className="text-xl font-semibold text-primary mb-2">Quer receber uma demonstração gratuita?</p>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">Tem alguma dúvida ou quer saber mais? Fale diretamente conosco pelo WhatsApp ou envie sua mensagem e agende sua demonstração personalizada.</p>
            <a
              href="https://wa.me/5561984593746?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20radarimobtech!"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-2xl shadow-lg shadow-green-600/25 transition-all hover:scale-105"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp: (61) 98459-3746
            </a>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <ContactForm />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ==================== 8. CTA FINAL ==================== */}
      <section className="py-24 sm:py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-violet-500/[0.08] pointer-events-none" />
        <div className="absolute inset-0 landing-grid-overlay opacity-30 pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6">
              Pare de perder vendas por falta de sistema
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Teste e veja resultado na prática. <strong className="text-foreground">7 dias grátis, sem cartão.</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#lead-capture"
                onClick={() => trackFreeTrialStarted({ button_text: "Solicitar demonstração gratuita", source: "footer_cta" })}
              >
                <Button size="lg" className="text-base px-12 py-7 bg-gradient-to-r from-primary to-blue-600 shadow-xl shadow-primary/25 hover:opacity-90 rounded-2xl">
                  Solicitar demonstração gratuita <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
              <a href="https://wa.me/5561984593746?text=Olá! Tenho interesse em conhecer a plataforma." target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-base px-8 py-7 rounded-2xl">
                  <MessageCircle className="w-5 h-5 mr-2" /> Falar pelo WhatsApp
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-border/50 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">radar<span className="text-primary">imobtech</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#pricing" className="hover:text-foreground transition-colors">Planos</a>
            <a href="https://wa.me/5561984593746" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Fale Conosco</a>
            <Link to="/portal" className="hover:text-foreground transition-colors">Portal Demo</Link>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} radarimobtech. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
    </>
  );
}
