import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight, Radar, Sparkles, Wifi, Upload, Shield, Home, Loader2 } from "lucide-react";

type Step = {
  key: string;
  titulo: string;
  descricao: string;
  done: boolean;
  cta: { label: string; to: string };
  icon: React.ReactNode;
};

export default function RadarZapOnboarding() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({
    evolutionConectada: false,
    grupos: 0,
    scoring: false,
    consentimento: false,
    imoveis: 0,
    aprovacoes: 0,
  });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const [evoRes, grupos, scoring, termos, imoveis, pendentes] = await Promise.all([
        supabase.functions.invoke("radarzap-evolution-status").catch(() => ({ data: null })),
        supabase.from("radarzap_grupos").select("id", { count: "exact", head: true }).eq("imobiliaria_id", user.id),
        supabase.from("radarzap_scoring_config").select("id", { count: "exact", head: true }).eq("imobiliaria_id", user.id),
        supabase.from("whatsapp_termos_consentimento").select("id", { count: "exact", head: true }).eq("imobiliaria_id", user.id),
        supabase.from("vw_radarzap_imoveis" as any).select("id", { count: "exact", head: true }).eq("imobiliaria_id", user.id),
        supabase.from("radarzap_leads").select("id", { count: "exact", head: true }).eq("imobiliaria_id", user.id).eq("status", "pendente_aprovacao"),
      ]);
      setStatus({
        evolutionConectada: (evoRes as any)?.data?.state === "open",
        grupos: grupos.count ?? 0,
        scoring: (scoring.count ?? 0) > 0,
        consentimento: (termos.count ?? 0) > 0,
        imoveis: imoveis.count ?? 0,
        aprovacoes: pendentes.count ?? 0,
      });
      setLoading(false);
    })();
  }, [user?.id]);

  const steps: Step[] = [
    {
      key: "conexao",
      titulo: "Conectar WhatsApp via Evolution API",
      descricao: "Escaneie o QR Code e configure o webhook para receber mensagens em tempo real.",
      done: status.evolutionConectada,
      cta: { label: "Ir para Conexão", to: "/radarzap?tab=conexao" },
      icon: <Wifi className="h-5 w-5" />,
    },
    {
      key: "grupos",
      titulo: "Importar grupos públicos",
      descricao: "Cole os links de convite dos grupos de WhatsApp que quer monitorar.",
      done: status.grupos > 0,
      cta: { label: "Importar grupos", to: "/radarzap?tab=importar" },
      icon: <Upload className="h-5 w-5" />,
    },
    {
      key: "scoring",
      titulo: "Ajustar scoring de leads",
      descricao: "Defina o peso de cada sinal (contato, operação, bairro, preço) e o score mínimo.",
      done: status.scoring,
      cta: { label: "Configurar scoring", to: "/radarzap/scoring" },
      icon: <Sparkles className="h-5 w-5" />,
    },
    {
      key: "consentimento",
      titulo: "Publicar termo de consentimento WhatsApp",
      descricao: "Necessário para conformidade LGPD antes de enviar mensagens aos proprietários.",
      done: status.consentimento,
      cta: { label: "Configurar consentimento", to: "/whatsapp-consentimentos" },
      icon: <Shield className="h-5 w-5" />,
    },
    {
      key: "imoveis",
      titulo: "Ver imóveis captados",
      descricao: "Após conectar, os imóveis extraídos por IA aparecem aqui com filtros e exportação Excel.",
      done: status.imoveis > 0,
      cta: { label: "Abrir Imóveis captados", to: "/radarzap?tab=imoveis" },
      icon: <Home className="h-5 w-5" />,
    },
  ];

  const feitos = steps.filter((s) => s.done).length;
  const progresso = Math.round((feitos / steps.length) * 100);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Radar className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">RadarZAP: Sua Plataforma Completa para Descoberta e Qualificação de Leads no WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O RadarZAP é uma ferramenta poderosa projetada para identificar, monitorar e transformar interações de grupos públicos de WhatsApp em leads imobiliários qualificados. Ele automatiza a captação e análise de informações, otimizando a prospecção e a gestão de oportunidades.
          </p>
        </div>

      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Progresso</CardTitle>
            <Badge variant={progresso === 100 ? "default" : "secondary"}>
              {feitos} de {steps.length} concluídos
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progresso} className="h-2" />
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verificando sua configuração…
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <Card key={step.key} className={step.done ? "border-emerald-200 bg-emerald-50/40" : ""}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-shrink-0">
                  {step.done ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-shrink-0 hidden sm:block text-muted-foreground">{step.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Passo {idx + 1}</span>
                    {step.done && <Badge variant="outline" className="text-emerald-700 border-emerald-300">Feito</Badge>}
                  </div>
                  <div className="font-medium">{step.titulo}</div>
                  <div className="text-sm text-muted-foreground">{step.descricao}</div>
                </div>
                <Button asChild size="sm" variant={step.done ? "outline" : "default"} className="flex-shrink-0">
                  <Link to={step.cta.to}>
                    {step.cta.label} <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Atalhos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button asChild variant="outline" className="justify-start h-auto py-3">
            <Link to="/radarzap">
              <Radar className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Dashboard RadarZAP</div>
                <div className="text-xs text-muted-foreground">Grupos, mensagens, aprovações e métricas</div>
              </div>
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start h-auto py-3">
            <Link to="/radarzap/scoring">
              <Sparkles className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Scoring de leads</div>
                <div className="text-xs text-muted-foreground">Pesos, thresholds e alertas de score alto</div>
              </div>
            </Link>
          </Button>
        </CardContent>
      </Card>

      {status.aprovacoes > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-amber-900">
                Você tem {status.aprovacoes} lead{status.aprovacoes > 1 ? "s" : ""} aguardando aprovação
              </div>
              <div className="text-sm text-amber-800">Revise antes de criar cards no pipeline.</div>
            </div>
            <Button asChild size="sm">
              <Link to="/radarzap?tab=aprovacao">Revisar</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
