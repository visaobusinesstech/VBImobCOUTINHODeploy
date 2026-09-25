import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Sparkles, ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  trackFormSubmission,
  trackFreeTrialStarted,
  trackFreeTrialSignupSuccess,
} from "@/lib/analytics";

interface Step1 {
  nome: string;
  email: string;
  site: string;
}
interface Step2 {
  telefone: string;
  imobiliaria: string;
  desafio: string;
}

interface AuditoriaGratisDialogProps {
  trigger?: React.ReactNode;
  source?: string;
  buttonText?: string;
}

/**
 * Fluxo CTA em 2 etapas:
 *   Etapa 1 (micro-conversão) — Nome, E-mail, URL do site  → gera lead qualificado.
 *   Etapa 2 (perfil) — telefone, imobiliária, principal desafio → completa auditoria.
 * Cada etapa dispara evento GA4 próprio via GTM.
 */
export function AuditoriaGratisDialog({
  trigger,
  source = "auditoria_cta",
  buttonText = "Auditoria grátis do seu site imobiliário",
}: AuditoriaGratisDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [s1, setS1] = useState<Step1>({ nome: "", email: "", site: "" });
  const [s2, setS2] = useState<Step2>({ telefone: "", imobiliaria: "", desafio: "" });

  function reset() {
    setStep(1);
    setS1({ nome: "", email: "", site: "" });
    setS2({ telefone: "", imobiliaria: "", desafio: "" });
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!s1.nome.trim() || !s1.email.trim()) {
      toast.error("Informe nome e e-mail para começarmos.");
      return;
    }
    setLoading(true);
    try {
      await supabase.functions.invoke("contato-landing", {
        body: {
          nome: s1.nome,
          email: s1.email,
          telefone: "",
          mensagem: `[AUDITORIA GRÁTIS - etapa 1] Site informado: ${s1.site || "não informado"}`,
          origem: `auditoria_gratis:${source}`,
        },
      });
      trackFormSubmission({
        form_id: "auditoria-gratis-step1",
        form_name: "Auditoria Grátis — Etapa 1",
        lead_type: "landing_capture",
        extra: { source, site: s1.site },
      });
      setStep(2);
    } catch (err) {
      console.error("[auditoria step1]", err);
      toast.error("Não foi possível iniciar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.functions.invoke("contato-landing", {
        body: {
          nome: s1.nome,
          email: s1.email,
          telefone: s2.telefone,
          mensagem: [
            "[AUDITORIA GRÁTIS - etapa 2]",
            `Site: ${s1.site || "não informado"}`,
            `Imobiliária: ${s2.imobiliaria || "não informada"}`,
            `Principal desafio: ${s2.desafio || "não informado"}`,
          ].join("\n"),
          origem: `auditoria_gratis_completa:${source}`,
        },
      });
      trackFormSubmission({
        form_id: "auditoria-gratis-step2",
        form_name: "Auditoria Grátis — Etapa 2",
        lead_type: "demo",
        extra: {
          source,
          site: s1.site,
          imobiliaria: s2.imobiliaria,
          tem_telefone: Boolean(s2.telefone),
        },
      });
      trackFreeTrialSignupSuccess({
        plan_selected: "auditoria_gratis",
        signup_method: "email_password",
      });
      setStep(3);
    } catch (err) {
      console.error("[auditoria step2]", err);
      toast.error("Não foi possível concluir. Tentaremos por e-mail.");
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          trackFreeTrialStarted({ button_text: buttonText, source });
        } else {
          // Fechou depois do sucesso? mantém, senão reset.
          if (step === 3) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-blue-600 rounded-2xl">
            <Sparkles className="w-4 h-4" /> {buttonText}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Auditoria gratuita do seu site imobiliário
          </DialogTitle>
          <DialogDescription>
            Em 24h úteis nossos especialistas devolvem um diagnóstico de captação,
            SEO e conversão do seu site — sem custo, sem cartão.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 flex items-center gap-3">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-xs font-medium text-muted-foreground w-14 text-right">
            {step === 3 ? "Concluído" : `Passo ${step} de 2`}
          </span>
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ag-nome">Nome</Label>
              <Input
                id="ag-nome"
                placeholder="Como podemos te chamar?"
                value={s1.nome}
                onChange={(e) => setS1((f) => ({ ...f, nome: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-email">E-mail</Label>
              <Input
                id="ag-email"
                type="email"
                placeholder="voce@imobiliaria.com"
                value={s1.email}
                onChange={(e) => setS1((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-site">URL do seu site (opcional)</Label>
              <Input
                id="ag-site"
                type="url"
                placeholder="https://suaimobiliaria.com.br"
                value={s1.site}
                onChange={(e) => setS1((f) => ({ ...f, site: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Vamos rodar uma análise técnica e de SEO na URL informada.
              </p>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Continuar <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              Ao continuar você concorda com a LGPD. Nunca compartilhamos seus dados.
            </p>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ag-tel">WhatsApp / telefone</Label>
              <Input
                id="ag-tel"
                placeholder="(61) 90000-0000"
                value={s2.telefone}
                onChange={(e) => setS2((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-imob">Nome da imobiliária ou equipe</Label>
              <Input
                id="ag-imob"
                placeholder="Ex.: AC Imóveis"
                value={s2.imobiliaria}
                onChange={(e) => setS2((f) => ({ ...f, imobiliaria: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-desafio">Qual seu principal desafio hoje?</Label>
              <Textarea
                id="ag-desafio"
                rows={3}
                placeholder="Ex.: capto pouco, dependo demais de portais, meu site não converte…"
                value={s2.desafio}
                onChange={(e) => setS2((f) => ({ ...f, desafio: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button type="submit" className="flex-1 gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Solicitar auditoria <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Auditoria solicitada!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enviaremos seu diagnóstico para <strong>{s1.email}</strong> em até 24h úteis.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
