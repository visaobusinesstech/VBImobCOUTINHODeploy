import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link, useLocation } from "react-router-dom";
import { Clock, AlertTriangle, CheckCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setPendingAuthRedirect } from "@/hooks/usePendingAuthRedirect";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { isOpenAccess } from "@/lib/openAccess";

const PLANOS = [
  { id: "gratuito", nome: "Gratuito", preco: "Grátis (7 dias)" },
  { id: "lite", nome: "Básico", preco: "R$19,90/mês" },
  { id: "basico", nome: "Intermediário", preco: "R$59,90/mês" },
  { id: "profissional", nome: "Avançado", preco: "R$97,90/mês" },
  { id: "premium", nome: "Completo", preco: "R$197,90/mês" },
  { id: "imobiliaria", nome: "Imobiliária Ilimitado", preco: "R$2.997,90/mês" },
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, approved, trialExpired, trialDaysLeft, plano, planoSolicitado, signOut } = useAuth();
  const location = useLocation();
  const [requesting, setRequesting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("profissional");
  const openAccess = isOpenAccess();

  useEffect(() => {
    if (openAccess || loading || user) return;
    const destination = `${location.pathname}${location.search}${location.hash}`;
    if (destination && destination !== "/auth") {
      setPendingAuthRedirect(destination);
    }
  }, [openAccess, loading, user, location.pathname, location.search, location.hash]);

  if (openAccess) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex bg-background">
        <div className="hidden md:flex flex-col w-[260px] border-r border-border p-4 space-y-4">
          <Skeleton className="h-8 w-36" />
          <div className="space-y-2 mt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="h-14 border-b border-border flex items-center px-6 gap-4">
            <Skeleton className="h-8 w-8 rounded-lg md:hidden" />
            <Skeleton className="h-8 w-48 rounded-lg" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
          <div className="flex-1 p-4 md:p-6 space-y-6">
            <Skeleton className="h-7 w-48" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border p-4 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Aguardando Aprovação</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Sua conta foi criada com sucesso! O administrador master precisa aprovar seu acesso antes de continuar.
            </p>
          </div>
          <Button variant="outline" onClick={signOut} className="mx-auto">
            Sair
          </Button>
        </div>
      </div>
    );
  }

  // SEGURANÇA: o cliente NÃO grava mais em `subscriptions` (auto-concessão de plano).
  // A escrita é exclusiva do servidor/gateway; aqui apenas registramos a solicitação.
  const handleCheckout = async (planId: string) => {
    setRequesting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          plano_solicitado: planId,
          plano_solicitado_em: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Solicitação enviada! Assim que o pagamento for confirmado, seu acesso será liberado.");
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      console.error("Erro ao solicitar plano:", error);
      toast.error("Não foi possível registrar sua solicitação. Tente novamente.");
    } finally {
      setRequesting(false);
    }
  };


  if (trialExpired) {
    if (planoSolicitado) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Aguardando Liberação</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Você solicitou o plano <strong className="text-foreground capitalize">{planoSolicitado}</strong>.
                Assim que o administrador confirmar o pagamento, seu acesso será liberado.
              </p>
            </div>
            <Badge variant="secondary" className="text-sm px-4 py-1.5">
              <Clock className="w-3.5 h-3.5 mr-1.5 inline" /> Pendente de aprovação
            </Badge>
            <Button variant="outline" onClick={signOut} className="mx-auto">
              Sair
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 md:p-8">
        <div className="w-full max-w-4xl space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Período de Teste Expirado</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Seu teste grátis de 7 dias terminou. Assine o novo plano <strong>Básico</strong> por apenas <strong>R$19,90</strong> ou escolha uma opção mais avançada.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANOS.filter(p => ["lite", "basico", "profissional", "premium"].includes(p.id)).map((p) => (
              <Card key={p.id} className={`relative flex flex-col transition-all duration-300 hover:shadow-xl ${selectedPlan === p.id ? 'ring-2 ring-primary border-primary bg-primary/5 shadow-lg scale-105 z-10' : 'hover:border-primary/50'}`}>
                {p.id === 'profissional' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                    Mais Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{p.nome}</CardTitle>
                  <CardDescription>
                    {p.id === 'lite' ? 'O essencial para começar' : (p.id === 'basico' ? 'Para quem quer organização' : (p.id === 'profissional' ? 'O melhor para profissionais' : 'A experiência completa'))}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold">{p.preco.split('/')[0]}</span>
                    <span className="text-muted-foreground">/{p.preco.split('/')[1]}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">O que está incluído:</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{p.id === 'lite' ? 'Até 50 imóveis ativos' : (p.id === 'basico' ? 'Até 200 imóveis ativos' : (p.id === 'profissional' ? 'Até 1000 imóveis ativos' : 'Imóveis Ilimitados'))}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{p.id === 'lite' ? 'Até 200 leads por mês' : (p.id === 'basico' ? 'Até 1000 leads por mês' : (p.id === 'profissional' ? 'Até 5000 leads por mês' : 'Leads Ilimitados'))}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{p.id === 'lite' ? 'Suporte via E-mail' : 'Suporte prioritário'}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>Gestão de Agenda</span>
                        </li>
                      </ul>
                    </div>

                    {p.id === 'lite' && (
                      <div className="pt-4 border-t border-border/50">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Limites Básico:</h4>
                        <ul className="space-y-2 text-xs text-muted-foreground/80 italic">
                          <li>• Sem funcionalidades de IA</li>
                          <li>• Sem exportação de relatórios</li>
                          <li>• Sem integração com portais</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={() => handleCheckout(p.id)}
                    disabled={requesting}
                    className={`w-full font-bold h-11 ${p.id === 'lite' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    variant={p.id === 'lite' ? 'default' : 'outline'}
                  >
                    {requesting ? "Enviando..." : (
                      <span className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> Solicitar assinatura
                      </span>
                    )}

                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4 mt-8">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pagamento recorrente mensal. Cancele quando quiser.
            </p>
            <div className="flex gap-4">
              <Button variant="ghost" onClick={signOut} className="text-muted-foreground hover:text-foreground">
                Sair da conta
              </Button>
              <Button variant="link" className="text-muted-foreground">
                Precisa de ajuda? Fale conosco
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {trialDaysLeft !== null && trialDaysLeft <= 5 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-sm">
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            ⏳ Seu teste grátis expira em {trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"}.
          </span>
        </div>
      )}
      {children}
    </>
  );
}
