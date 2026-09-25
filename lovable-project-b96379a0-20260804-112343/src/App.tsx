import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ProtectedAppShell } from "@/components/ProtectedAppShell";
import { usePendingAuthRedirect } from "@/hooks/usePendingAuthRedirect";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import HomePage from "./pages/Landing";
import { AvaliacaoFallback } from "./pages/AvaliacaoFallback";
import { DiagnosticoFallback } from "./pages/DiagnosticoAvaliacaoFallback";
import { isOpenAccess } from "@/lib/openAccess";

// Lazy load all pages (com retry automático para chunks antigos pós-deploy)
const Avaliacao = lazyWithRetry(() => import("./pages/Avaliacao"));
const DiagnosticoAvaliacao = lazyWithRetry(() => import("./pages/DiagnosticoAvaliacao"));
const DiagnosticoCaptacao = lazyWithRetry(() => import("./pages/DiagnosticoCaptacao"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));
const AuditoriaExtracao = lazyWithRetry(() => import("./pages/AuditoriaExtracao"));
const MetricasExtracao = lazyWithRetry(() => import("./pages/MetricasExtracao"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const ConsultaCPF = lazyWithRetry(() => import("./pages/ConsultaCPF"));
const Pipeline = lazyWithRetry(() => import("./pages/Pipeline"));
const Imoveis = lazyWithRetry(() => import("./pages/Imoveis"));
const Corretores = lazyWithRetry(() => import("./pages/Corretores"));
const Automacoes = lazyWithRetry(() => import("./pages/Automacoes"));
const Financeiro = lazyWithRetry(() => import("./pages/Financeiro"));
const Contratos = lazyWithRetry(() => import("./pages/Contratos"));
const Relacionamento = lazyWithRetry(() => import("./pages/Relacionamento"));
const Seguranca = lazyWithRetry(() => import("./pages/Seguranca"));
const Configuracoes = lazyWithRetry(() => import("./pages/Configuracoes"));
const JornadaCliente = lazyWithRetry(() => import("./pages/JornadaCliente"));
const GerenciarUsuarios = lazyWithRetry(() => import("./pages/GerenciarUsuarios"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const ImovelPublico = lazyWithRetry(() => import("./pages/ImovelPublico"));
const Proprietarios = lazyWithRetry(() => import("./pages/Proprietarios"));
const Agenda = lazyWithRetry(() => import("./pages/Agenda"));
const PortalImoveis = lazyWithRetry(() => import("./pages/PortalImoveis"));
const RelatorioProdutividade = lazyWithRetry(() => import("./pages/RelatorioProdutividade"));
const Followups = lazyWithRetry(() => import("./pages/Followups"));
const WhatsApp = lazyWithRetry(() => import("./pages/WhatsApp"));
// const Avaliacao = lazyWithRetry(() => import("./pages/Avaliacao"));
const Inteligencia = lazyWithRetry(() => import("./pages/Inteligencia"));
const Propostas = lazyWithRetry(() => import("./pages/Propostas"));
const ConteudoSEO = lazyWithRetry(() => import("./pages/ConteudoSEO"));
const Captacao = lazyWithRetry(() => import("./pages/Captacao"));
const IntegracaoPortais = lazyWithRetry(() => import("./pages/IntegracaoPortais"));
const Inadimplencia = lazyWithRetry(() => import("./pages/Inadimplencia"));
const ComparativoImoveis = lazyWithRetry(() => import("./pages/ComparativoImoveis"));
const CaptacaoAvaliacao = lazyWithRetry(() => import("./pages/CaptacaoAvaliacao"));
const LeadsLanding = lazyWithRetry(() => import("./pages/LeadsLanding"));
const VendaCRM = lazyWithRetry(() => import("./pages/VendaCRM"));
const ProspeccaoDiaria = lazyWithRetry(() => import("./pages/ProspeccaoDiaria"));
const ConfigurarIA = lazyWithRetry(() => import("./pages/ConfigurarIA"));
const AuditoriaRequests = lazyWithRetry(() => import("./pages/AuditoriaRequests"));
const AuditoriaMonitoramento = lazyWithRetry(() => import("./pages/AuditoriaMonitoramento"));
const AuditoriaLeads = lazyWithRetry(() => import("./pages/AuditoriaLeads"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const WebhookMetricsDashboard = lazyWithRetry(() => import("./pages/WebhookMetricsDashboard"));
const WebhookAlertsAdmin = lazyWithRetry(() => import("./pages/WebhookAlertsAdmin"));
const WhatsappTemplatesCaptacao = lazyWithRetry(() => import("./pages/WhatsappTemplatesCaptacao"));
const CaptacaoPipeline = lazyWithRetry(() => import("./pages/CaptacaoPipeline"));
const CrmCondominios = lazyWithRetry(() => import("./pages/CrmCondominios"));
const AutomacoesFollowup = lazyWithRetry(() => import("./pages/AutomacoesFollowup"));
const NutricaoLeads = lazyWithRetry(() => import("./pages/NutricaoLeads"));
const RelatoriosAgendados = lazyWithRetry(() => import("./pages/RelatoriosAgendados"));
const FilaDistribuicao = lazyWithRetry(() => import("./pages/FilaDistribuicao"));
const LgpdPortalTitular = lazyWithRetry(() => import("./pages/LgpdPortalTitular"));
const LgpdSolicitacoes = lazyWithRetry(() => import("./pages/LgpdSolicitacoes"));
const BuscaAvancadaCaptacao = lazyWithRetry(() => import("./pages/BuscaAvancadaCaptacao"));
const CaptacaoAllowlist = lazyWithRetry(() => import("./pages/CaptacaoAllowlist"));
const Monitoramento = lazyWithRetry(() => import("./pages/Monitoramento"));
const RadarZap = lazyWithRetry(() => import("./pages/RadarZap"));
const RadarZapAcessos = lazyWithRetry(() => import("./pages/RadarZapAcessos"));
const AnunciarImovelHub = lazyWithRetry(() => import("./pages/AnunciarImovelHub"));
const AnunciarImovelCidade = lazyWithRetry(() => import("./pages/AnunciarImovelCidade"));
const SeoAuditoria = lazyWithRetry(() => import("./pages/SeoAuditoria"));
const SolucoesSeoImobiliario = lazyWithRetry(() => import("./pages/SolucoesSeoImobiliario"));
const ComparativoKenloRadarimobtech = lazyWithRetry(() => import("./pages/ComparativoKenloRadarimobtech"));
const ImoveisCidadeBairro = lazyWithRetry(() => import("./pages/ImoveisCidadeBairro"));
const Blog = lazyWithRetry(() => import("./pages/Blog"));
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"));
const Feed = lazyWithRetry(() => import("./pages/Feed"));
const CuradoriaViral = lazyWithRetry(() => import("./pages/CuradoriaViral"));
const FeedRedirect = lazyWithRetry(() => import("./pages/FeedRedirect"));
const ConsentimentoPortalTitular = lazyWithRetry(() => import("./pages/ConsentimentoPortalTitular"));
const ConsentimentoConfirmar = lazyWithRetry(() => import("./pages/ConsentimentoConfirmar"));
const PagamentoPublico = lazyWithRetry(() => import("./pages/PagamentoPublico"));
const WhatsappConsentimentos = lazyWithRetry(() => import("./pages/WhatsappConsentimentos"));
const RadarZapScoringConfig = lazyWithRetry(() => import("./pages/RadarZapScoringConfig"));
const RadarZapOnboarding = lazyWithRetry(() => import("./pages/RadarZapOnboarding"));
const RadarZapStatus = lazyWithRetry(() => import("./pages/RadarZapStatus"));




const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedAppShell>{children}</ProtectedAppShell>
);

const PostAuthRedirect = () => {
  usePendingAuthRedirect();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PostAuthRedirect />
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={isOpenAccess() ? <Navigate to="/dashboard" replace /> : <Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/landing" element={<HomePage />} />
            <Route path="/imovel/:id" element={<ImovelPublico />} />
            <Route path="/portal" element={<PortalImoveis />} />
            <Route path="/captacao-avaliacao" element={<CaptacaoAvaliacao />} />
            <Route path="/venda-crm" element={<VendaCRM />} />
            <Route path="/lgpd/meus-dados" element={<LgpdPortalTitular />} />
            <Route path="/anunciar-imovel" element={<AnunciarImovelHub />} />
            <Route path="/anunciar-imovel/:cidade" element={<AnunciarImovelCidade />} />
            <Route path="/solucoes/seo-imobiliario" element={<SolucoesSeoImobiliario />} />
            <Route path="/comparativo/kenlo-vs-radarimobtech" element={<ComparativoKenloRadarimobtech />} />
            <Route path="/imoveis/:cidade/:bairro" element={<ImoveisCidadeBairro />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/diagnostico-captacao" element={<DiagnosticoCaptacao />} />
            <Route path="/consentimento/confirmar/:token" element={<ConsentimentoConfirmar />} />
            <Route path="/consentimento/:token" element={<ConsentimentoPortalTitular />} />
            <Route path="/pagamento/:token" element={<PagamentoPublico />} />


            <Route path="/" element={isOpenAccess() ? <Navigate to="/dashboard" replace /> : <HomePage />} />
            <Route path="/auditoria-extracao" element={<P><AuditoriaExtracao /></P>} />
            <Route path="/metricas-extracao" element={<P><MetricasExtracao /></P>} />

            <Route path="/dashboard" element={<P><Index /></P>} />
            <Route path="/feed" element={<P><Feed /></P>} />
            <Route path="/curadoria-viral" element={<P><CuradoriaViral /></P>} />
            <Route path="/rss" element={<P><FeedRedirect format="rss" /></P>} />
            <Route path="/rss.xml" element={<P><FeedRedirect format="rss" /></P>} />
            <Route path="/atom" element={<P><FeedRedirect format="atom" /></P>} />
            <Route path="/atom.xml" element={<P><FeedRedirect format="atom" /></P>} />
            <Route path="/feed.xml" element={<P><FeedRedirect format="rss" /></P>} />
            <Route path="/rss/categoria/:tipo" element={<P><FeedRedirect format="rss" /></P>} />
            <Route path="/atom/categoria/:tipo" element={<P><FeedRedirect format="atom" /></P>} />
            <Route path="/rss/cidade/:cidade" element={<P><FeedRedirect format="rss" /></P>} />
            <Route path="/atom/cidade/:cidade" element={<P><FeedRedirect format="atom" /></P>} />
            <Route path="/rss/categoria/:tipo/cidade/:cidade" element={<P><FeedRedirect format="rss" /></P>} />
            <Route path="/atom/categoria/:tipo/cidade/:cidade" element={<P><FeedRedirect format="atom" /></P>} />
            <Route path="/consulta-cpf" element={<P><ConsultaCPF /></P>} />
            <Route path="/pipeline" element={<P><Pipeline /></P>} />
            <Route path="/imoveis" element={<P><Imoveis /></P>} />
            <Route path="/corretores" element={<P><Corretores /></P>} />
            <Route path="/automacoes" element={<P><Automacoes /></P>} />
            <Route path="/fila-distribuicao" element={<P><FilaDistribuicao /></P>} />
            <Route path="/financeiro" element={<P><Financeiro /></P>} />
            <Route path="/contratos" element={<P><Contratos /></P>} />
            <Route path="/proprietarios" element={<P><Proprietarios /></P>} />
            <Route path="/relacionamento" element={<P><Relacionamento /></P>} />
            <Route path="/seguranca" element={<P><Seguranca /></P>} />
            <Route path="/auditoria-requests" element={<P><AuditoriaRequests /></P>} />
            <Route path="/auditoria-monitoramento" element={<P><AuditoriaMonitoramento /></P>} />
            <Route path="/auditoria-leads" element={<P><AuditoriaLeads /></P>} />
            <Route path="/jornada" element={<P><JornadaCliente /></P>} />
            <Route path="/configuracoes" element={<P><Configuracoes /></P>} />
            <Route path="/configurar-ia" element={<P><ConfigurarIA /></P>} />
            <Route path="/usuarios" element={<P><GerenciarUsuarios /></P>} />
            <Route path="/agenda" element={<P><Agenda /></P>} />
            <Route path="/produtividade" element={<P><RelatorioProdutividade /></P>} />
            <Route path="/followups" element={<P><Followups /></P>} />
            <Route path="/whatsapp" element={<P><WhatsApp /></P>} />
            <Route path="/avaliacao" element={<P><ErrorBoundary module="Avaliacao" fallback={(props) => <AvaliacaoFallback error={props.error} onReset={props.resetErrorBoundary} trackingId={props.trackingId} />}><Avaliacao /></ErrorBoundary></P>} />
            <Route path="/diagnostico-avaliacao" element={<P><ErrorBoundary module="DiagnosticoAvaliacao" fallback={(props) => <DiagnosticoFallback error={props.error} onReset={props.resetErrorBoundary} trackingId={props.trackingId} />}><DiagnosticoAvaliacao /></ErrorBoundary></P>} />
            <Route path="/inteligencia" element={<P><Inteligencia /></P>} />
            <Route path="/propostas" element={<P><Propostas /></P>} />
            <Route path="/conteudo-seo" element={<P><ConteudoSEO /></P>} />
            <Route path="/captacao" element={<P><Captacao /></P>} />
            <Route path="/integracao-portais" element={<P><IntegracaoPortais /></P>} />
            <Route path="/inadimplencia" element={<P><Inadimplencia /></P>} />
            <Route path="/comparativo" element={<P><ComparativoImoveis /></P>} />
            <Route path="/leads-landing" element={<P><LeadsLanding /></P>} />
            <Route path="/prospeccao" element={<P><ProspeccaoDiaria /></P>} />
            <Route path="/prospeccao-diaria" element={<P><ProspeccaoDiaria /></P>} />
            <Route path="/webhook-metrics" element={<P><WebhookMetricsDashboard /></P>} />
            <Route path="/webhook-alerts" element={<P><WebhookAlertsAdmin /></P>} />
            <Route path="/whatsapp-templates-captacao" element={<P><WhatsappTemplatesCaptacao /></P>} />
            <Route path="/whatsapp-consentimentos" element={<P><WhatsappConsentimentos /></P>} />
            <Route path="/captacao-pipeline" element={<P><CaptacaoPipeline /></P>} />
            <Route path="/crm-condominios" element={<P><CrmCondominios /></P>} />
            <Route path="/automacoes-followup" element={<P><AutomacoesFollowup /></P>} />
            <Route path="/nutricao" element={<P><NutricaoLeads /></P>} />
            <Route path="/relatorios-agendados" element={<P><RelatoriosAgendados /></P>} />
            <Route path="/lgpd-solicitacoes" element={<P><LgpdSolicitacoes /></P>} />
            <Route path="/busca-avancada-captacao" element={<P><BuscaAvancadaCaptacao /></P>} />
            <Route path="/seo-auditoria" element={<P><SeoAuditoria /></P>} />
            <Route path="/captacao-allowlist" element={<P><CaptacaoAllowlist /></P>} />
            <Route path="/monitoramento" element={<P><Monitoramento /></P>} />
            <Route path="/radarzap" element={<P><RadarZap /></P>} />
            <Route path="/radarzap/scoring" element={<P><RadarZapScoringConfig /></P>} />
            <Route path="/radarzap/onboarding" element={<P><RadarZapOnboarding /></P>} />
            <Route path="/radarzap/status" element={<P><RadarZapStatus /></P>} />
            <Route path="/radarzap/acessos" element={<P><RadarZapAcessos /></P>} />


            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
