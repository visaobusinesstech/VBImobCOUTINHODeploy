/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useState, useContext } from "react";
import { BrowserRouter, Switch, Redirect } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import moment from "moment";

import LoggedInLayout from "../layout";
import Dashboard from "../pages/Dashboard/";
import TicketResponsiveContainer from "../pages/TicketResponsiveContainer";
import Signup from "../pages/Signup";
import Register from "../pages/Register";
import RegisterFreemium from "../pages/RegisterFreemium";
import RegisterWhiteLabel from "../pages/RegisterWhiteLabel";
import Login from "../pages/Login/";
import GoogleOAuthConnectPage from "../pages/Login/GoogleOAuthConnectPage";
import GoogleOAuthCallbackPage from "../pages/Login/GoogleOAuthCallbackPage";
import ResetPassword from "../pages/ResetPassword";
import Connections from "../pages/Connections/";
import Settings from "../pages/SettingsCustom/";
import Financeiro from "../pages/Financeiro/";
import PlatformApiHub from "../pages/PlatformApiHub/";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts/";
import ContactImportPage from "../pages/Contacts/import";
import ChatMoments from "../pages/Moments";
import { isPlatformAdminEmail } from "../constants/fullOrgSettingsAdmin";
import Queues from "../pages/Queues/";
import Tags from "../pages/Tags/";
import MessagesAPI from "../pages/MessagesAPI/";
import Helps from "../pages/Helps/";
import ContactLists from "../pages/ContactLists/";
import ContactListItems from "../pages/ContactListItems/";
import Companies from "../pages/Companies/";
import Wallets from "../pages/Wallets/";
import QuickMessages from "../pages/QuickMessages/";
import { AuthProvider, AuthContext } from "../context/Auth/AuthContext";
import AppThemeRoot from "../layout/AppThemeRoot";
import I18nReactivityRoot from "../components/I18nReactivityRoot";
import GoogleTranslateBridge from "../components/GoogleTranslateBridge";
import { applyAppLanguage } from "../translate/i18n";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import { CampaignSendingProvider } from "../context/CampaignSendingContext";
import Route from "./Route";
import Schedules from "../pages/Schedules";
import Campaigns from "../pages/Campaigns";
import { openApi } from "../services/api";
import { detectAndEnableOfflineMode } from "../services/offlineMode";
import CampaignMetaTemplates from "../pages/CampaignMetaTemplates";
import CampaignsConfig from "../pages/CampaignsConfig";
import CampaignReport from "../pages/CampaignReport";
import Annoucements from "../pages/Annoucements";
import Chat from "../pages/Chat";
import Prompts from "../pages/Prompts";
import AllConnections from "../pages/AllConnections/";
import Reports from "../pages/Reports";
import RelatorioVendas from "../pages/RelatorioVendas";
import Subscription from "../pages/Subscription/";
import QueueIntegration from "../pages/QueueIntegration";
import Files from "../pages/Files/";
import ToDoList from "../pages/ToDoList/";
import Kanban from "../pages/Kanban";
import TagsKanban from "../pages/TagsKanban";
import BirthdaySettingsPage from "../pages/BirthdaySettings";
import CallHistoricals from "../pages/CallHistoricals";
import { FlowBuilderConfig } from "../pages/FlowBuilderConfig";
import FlowBuilder from "../pages/FlowBuilder";
import FlowDefault from "../pages/FlowDefault";
import CampaignsPhrase from "../pages/CampaignsPhrase";
import Activities from "../pages/Activities/";
import AiBrain from "../pages/AiBrain";
import Projects from "../pages/Projects/";
import LeadsSales from "../pages/LeadsSales/";

import Followups from "../pages/Followups/";
import Propostas from "../pages/Propostas/";
import Imoveis from "../pages/Imoveis/";
import Proprietarios from "../pages/Proprietarios/";
import Captacao from "../pages/Captacao/";
import Contratos from "../pages/Contratos/";
import Comparativo from "../pages/Comparativo/";
import RadarZap from "../pages/RadarZap/";
import PortalScraping from "../pages/PortalScraping/";
import ConteudoSEO from "../pages/ConteudoSEO/";
import QCapture from "../pages/QCapture/";
import RealtyPipeline from "../pages/RealtyPipeline/";
import {
  AgendaImobiliaria,
  AnunciarImovel,
  AuditoriaExtracao,
  AuditoriaLeads,
  AuditoriaMonitoramento,
  AuditoriaRequests,
  Automacoes,
  AutomacoesFollowup,
  Avaliacao,
  BlogImobiliario,
  BuscaAvancadaCaptacao,
  CaptacaoAllowlist,
  CaptacaoAvaliacaoLp,
  ConfiguracoesImobiliaria,
  ConfigurarIA,
  Condominios,
  Consentimentos,
  ConsultaCPF,
  Corretores,
  CuradoriaViral,
  DiagnosticoAvaliacao,
  DiagnosticoCaptacao,
  Feed,
  FilaDistribuicao,
  Inadimplencia,
  Inteligencia,
  JornadaCliente,
  LeadsLanding,
  LgpdPortalTitular,
  LgpdSolicitacoes,
  MetricasExtracao,
  Monitoramento,
  Nutricao,
  PagamentosPublicos,
  PipelineCaptacao,
  PortalImoveisPublico,
  Produtividade,
  ProspeccaoDiaria,
  RadarOportunidades,
  RadarZapAcessos,
  RadarZapGrupos,
  RadarZapOnboarding,
  RadarZapScoring,
  RadarZapStatusPage,
  RealtyDashboard,
  Relacionamento,
  RelatoriosAgendados,
  Seguranca,
  SeoAuditoria,
  VendaCrmLp,
  WebhookAlerts,
  WebhookMetrics,
  WhatsappConsentimentos,
  WhatsappImobiliario,
  WhatsappTemplatesCaptacao,
} from "../pages/RealtyModules";
import Inventory from "../pages/Inventory/";
import FilesPage from "../pages/FilesPage/";
import EmailPage from "../pages/EmailPage/";
import WhatsappDashboard from "../pages/WhatsappDashboard/";
import LeadsConvertidos from "../pages/LeadsConvertidos/";
import Payment from "../pages/Payment/";
import { PaymentSuccess, PaymentCancel } from "../pages/PaymentResult";

const RoutesContent = () => {
  const [showCampaigns, setShowCampaigns] = useState(false);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    // Campanhas: flag vem do plano/empresa (AuthContext), não de localStorage
    if (user?.company?.plan?.useCampaigns || user?.showCampaign === "enabled") {
      setShowCampaigns(true);
    }
  }, [user]);

  useEffect(() => {
    if (user?.language) {
      applyAppLanguage(user.language);
    }
  }, [user?.language]);

  // Verificar se a empresa está vencida
  const isCompanyExpired = () => {
    if (process.env.NODE_ENV !== "production") {
      return false;
    }
    if (!user || !user.company || user.company.id === 1) {
      return false; // Empresa ID 1 nunca expira
    }

    const dueDate = user.company.dueDate;
    if (!dueDate) return false;

    // Comparar apenas as datas (sem horas) para permitir acesso até 23h59 do dia do vencimento
    const hojeInicio = moment().startOf('day');
    const vencimentoInicio = moment(dueDate).startOf('day');
    
    // Empresa está vencida apenas após o dia do vencimento
    return hojeInicio.isAfter(vencimentoInicio, 'day');
  };

  const FinanceiroGuard = (props) => {
    const allowed = isPlatformAdminEmail(user?.email);
    return allowed ? <Financeiro {...props} /> : <Redirect to="/" />;
  };

  return (
    <TicketsContextProvider>
      <Switch>
        <Route exact path="/login" component={Login} title="Login" />
        <Route exact path="/login/google/oauth/start" component={GoogleOAuthConnectPage} title="Login Google" allowWhenAuth />
        <Route exact path="/login/google-oauth/callback" component={GoogleOAuthCallbackPage} title="Login Google" allowWhenAuth />
        <Route exact path="/reset-password" component={ResetPassword} title="Redefinir Senha" allowWhenAuth />
        <Route exact path="/signup" component={Signup} title="Cadastro" allowWhenAuth />
        <Route exact path="/register" component={Register} title="Registrar" allowWhenAuth />
        <Route exact path="/cadastro-gratis" component={RegisterFreemium} title="Nova organização — cadastro grátis" allowWhenAuth />
        <Route exact path="/white-label" component={RegisterWhiteLabel} title="White Label" allowWhenAuth />
        <Route exact path="/payment" component={Payment} title="Pagamento" allowWhenAuth />
        <Route exact path="/payment/success" component={PaymentSuccess} title="Pagamento confirmado" allowWhenAuth />
        <Route exact path="/payment/cancel" component={PaymentCancel} title="Pagamento cancelado" allowWhenAuth />
        <WhatsAppsProvider>
          <CampaignSendingProvider>
          <LoggedInLayout hideMenu={isCompanyExpired()}>
                <Route
                  exact
                  path="/financeiro"
                  component={FinanceiroGuard}
                  isPrivate
                  title="Financeiro"
                />

                <Route
                  exact
                  path="/platform-api"
                  component={PlatformApiHub}
                  isPrivate
                  title="API & MCP"
                />

                <Route
                  exact
                  path="/financeiro-aberto"
                  component={Financeiro}
                  isPrivate
                  title="Financeiro"
                />

                <Route
                  exact
                  path="/companies"
                  component={Companies}
                  isPrivate
                  title="Empresas"
                />
                <Route
                  exact
                  path="/birthday-settings"
                  component={BirthdaySettingsPage}
                  isPrivate
                  title="Configurações de Aniversário"
                />
                <Route exact path="/" component={Dashboard} isPrivate title="Dashboard" />
                <Route exact path="/call-historicals" component={CallHistoricals} isPrivate title="Histórico de Chamadas" />
                <Route
                  exact
                  path="/tickets/:ticketId?"
                  component={TicketResponsiveContainer}
                  isPrivate
                  title="Atendimentos"
                />
                <Route
                  path="/connections"
                  component={Connections}
                  isPrivate
                  title="Conexões"
                />
                <Route
                  exact
                  path="/quick-messages"
                  component={QuickMessages}
                  isPrivate
                  title="Disparos Automáticos"
                />
                <Route exact path="/todolist" component={ToDoList} isPrivate title="Tarefas" />
                <Route
                  exact
                  path="/schedules"
                  component={Schedules}
                  isPrivate
                  title="Agendamentos"
                />
                <Route exact path="/contacts" component={Contacts} isPrivate title="Contatos" />
                <Route
                  exact
                  path="/contacts/import"
                  component={ContactImportPage}
                  isPrivate
                  title="Importar Contatos"
                />
                <Route exact path="/wallets" component={Wallets} isPrivate title="Carteiras" />
                <Route exact path="/helps" component={Helps} isPrivate title="Ajuda" />
                <Route exact path="/users" component={Users} isPrivate title="Usuários" />
                <Route
                  exact
                  path="/api"
                  component={MessagesAPI}
                  isPrivate
                  title="API"
                />
                <Route
                  exact
                  path="/settings"
                  component={Settings}
                  isPrivate
                  title="Configurações"
                />
                <Route exact path="/queues" component={Queues} isPrivate title="Filas e Chatbot" />
                <Route exact path="/reports" component={Reports} isPrivate title="Relatórios" />
                <Route
                  exact
                  path="/relatorio-vendas"
                  component={RelatorioVendas}
                  isPrivate
                  title="Relatório de Vendas"
                />
                <Route
                  exact
                  path="/queue-integration"
                  component={QueueIntegration}
                  isPrivate
                  title="Integrações de Filas"
                />
                <Route
                  exact
                  path="/announcements"
                  component={Annoucements}
                  isPrivate
                  title="Avisos"
                />
                <Route exact path="/chats/:id?" component={Chat} isPrivate title="Chats Internos" />
                <Route exact path="/files" component={Files} isPrivate title="Lista de Arquivos" />
                <Route
                  exact
                  path="/moments"
                  component={ChatMoments}
                  isPrivate
                  title="Chat Moments"
                />
                {/* Sem `exact`: filhos em pages/Prompts/index.js tratam /prompts/create e /prompts/create/:id */}
                <Route path="/prompts" component={Prompts} isPrivate title="Prompts" />
                <Route
                  exact
                  path="/allConnections"
                  component={AllConnections}
                  isPrivate
                  title="Todas Conexões"
                />

                <Route
                  exact
                  path="/phrase-lists"
                  component={CampaignsPhrase}
                  isPrivate
                  title="Frases de Campanha"
                />
                <Route exact path="/brain-ai" component={AiBrain} isPrivate title="Brain.AI" />
                
                <Route exact path="/activities" component={Activities} isPrivate title="Atividades" />
                <Route exact path="/whatsapp-dashboard" component={WhatsappDashboard} isPrivate title="Dashboard WhatsApp" />
                <Route exact path="/leads-convertidos" component={LeadsConvertidos} isPrivate title="Leads Convertidos" />
                <Route exact path="/projects" component={Projects} isPrivate title="Projetos" />
                <Route exact path="/leads-sales" component={LeadsSales} isPrivate title="Leads e Vendas" />
                <Route exact path="/pipeline" component={RealtyPipeline} isPrivate title="CRM Pipeline" />
                <Route exact path="/portais" component={PortalScraping} isPrivate title="Portais" />
                <Route exact path="/inteligencia" component={Inteligencia} isPrivate title="Inteligência" />
                <Route exact path="/configurar-ia" component={ConfigurarIA} isPrivate title="Configuração da IA" />
                <Route exact path="/seguranca" component={Seguranca} isPrivate title="Segurança" />
                <Route exact path="/followups" component={Followups} isPrivate title="Follow-up" />
                <Route exact path="/imoveis" component={Imoveis} isPrivate title="Imóveis" />
                <Route exact path="/proprietarios" component={Proprietarios} isPrivate title="Proprietários" />
                <Route exact path="/captacao" component={Captacao} isPrivate title="Captação" />
                <Route exact path="/contratos" component={Contratos} isPrivate title="Contratos" />
                <Route exact path="/propostas" component={Propostas} isPrivate title="Propostas" />
                <Route exact path="/agenda" component={AgendaImobiliaria} isPrivate title="Agenda" />
                <Route exact path="/corretores" component={Corretores} isPrivate title="Corretores" />
                <Route exact path="/radarzap" component={RadarZap} isPrivate title="RadarZAP" />
                <Route exact path="/radarzap-grupos" component={RadarZapGrupos} isPrivate title="RadarZAP grupos" />
                <Route exact path="/radarzap/scoring" component={RadarZapScoring} isPrivate title="RadarZAP scoring" />
                <Route exact path="/radarzap/onboarding" component={RadarZapOnboarding} isPrivate title="RadarZAP onboarding" />
                <Route exact path="/radarzap/status" component={RadarZapStatusPage} isPrivate title="RadarZAP status" />
                <Route exact path="/radarzap/acessos" component={RadarZapAcessos} isPrivate title="RadarZAP acessos" />
                <Route exact path="/conteudo-seo" component={ConteudoSEO} isPrivate title="Conteúdo SEO" />
                <Route exact path="/qcapture" component={QCapture} isPrivate title="Q-Capture" />
                <Route exact path="/condominios" component={Condominios} isPrivate title="CRM Condomínios" />
                <Route exact path="/crm-condominios" component={Condominios} isPrivate title="CRM Condomínios" />
                <Route exact path="/avaliacao" component={Avaliacao} isPrivate title="Avaliação" />
                <Route exact path="/comparativo" component={Comparativo} isPrivate title="Comparativo" />
                <Route exact path="/relacionamento" component={Relacionamento} isPrivate title="Relacionamento" />
                <Route exact path="/inadimplencia" component={Inadimplencia} isPrivate title="Inadimplência" />
                <Route exact path="/monitoramento" component={Monitoramento} isPrivate title="Monitoramento" />
                <Route exact path="/pipeline-captacao" component={PipelineCaptacao} isPrivate title="Pipeline de captação" />
                <Route exact path="/captacao-pipeline" component={PipelineCaptacao} isPrivate title="Pipeline de captação" />
                <Route exact path="/feed" component={Feed} isPrivate title="Feed" />
                <Route exact path="/curadoria" component={CuradoriaViral} isPrivate title="Curadoria viral" />
                <Route exact path="/curadoria-viral" component={CuradoriaViral} isPrivate title="Curadoria viral" />
                <Route exact path="/dashboard" component={RealtyDashboard} isPrivate title="Dashboard imobiliário" />
                <Route exact path="/whatsapp" component={WhatsappImobiliario} isPrivate title="WhatsApp imobiliário" />
                <Route exact path="/whatsapp-templates-captacao" component={WhatsappTemplatesCaptacao} isPrivate title="Templates captação" />
                <Route exact path="/whatsapp-consentimentos" component={WhatsappConsentimentos} isPrivate title="Consentimentos WhatsApp" />
                <Route exact path="/seo-auditoria" component={SeoAuditoria} isPrivate title="Auditoria SEO" />
                <Route exact path="/captacao-allowlist" component={CaptacaoAllowlist} isPrivate title="Allowlist captação" />
                <Route exact path="/consulta-cpf" component={ConsultaCPF} isPrivate title="Consulta CPF" />
                <Route exact path="/captacao-avaliacao" component={CaptacaoAvaliacaoLp} isPrivate title="LP Captação" />
                <Route exact path="/venda-crm" component={VendaCrmLp} isPrivate title="LP Venda CRM" />
                <Route exact path="/portal" component={PortalImoveisPublico} isPrivate title="Portal de imóveis" />
                <Route exact path="/blog" component={BlogImobiliario} isPrivate title="Blog" />
                <Route exact path="/anunciar-imovel" component={AnunciarImovel} isPrivate title="Anunciar imóvel" />
                <Route exact path="/diagnostico-captacao" component={DiagnosticoCaptacao} isPrivate title="Diagnóstico captação" />
                <Route exact path="/diagnostico-avaliacao" component={DiagnosticoAvaliacao} isPrivate title="Diagnóstico avaliação" />
                <Route exact path="/busca-avancada-captacao" component={BuscaAvancadaCaptacao} isPrivate title="Busca avançada captação" />
                <Route exact path="/configuracoes-imobiliaria" component={ConfiguracoesImobiliaria} isPrivate title="Configurações imobiliária" />
                <Route exact path="/radar-oportunidades" component={RadarOportunidades} isPrivate title="Radar oportunidades" />
                <Route exact path="/auditoria-leads" component={AuditoriaLeads} isPrivate title="Auditoria leads" />
                <Route exact path="/auditoria-extracao" component={AuditoriaExtracao} isPrivate title="Auditoria extração" />
                <Route exact path="/metricas-extracao" component={MetricasExtracao} isPrivate title="Métricas extração" />
                <Route exact path="/auditoria-requests" component={AuditoriaRequests} isPrivate title="Auditoria requests" />
                <Route exact path="/auditoria-monitoramento" component={AuditoriaMonitoramento} isPrivate title="Auditoria monitoramento" />
                <Route exact path="/webhook-metrics" component={WebhookMetrics} isPrivate title="Métricas webhook" />
                <Route exact path="/webhook-alerts" component={WebhookAlerts} isPrivate title="Alertas webhook" />
                <Route exact path="/jornada" component={JornadaCliente} isPrivate title="Jornada do cliente" />
                <Route exact path="/fila-distribuicao" component={FilaDistribuicao} isPrivate title="Fila de Distribuição" />
                <Route exact path="/nutricao" component={Nutricao} isPrivate title="Nutrição" />
                <Route exact path="/prospeccao" component={ProspeccaoDiaria} isPrivate title="Prospecção diária" />
                <Route exact path="/produtividade" component={Produtividade} isPrivate title="Produtividade" />
                <Route exact path="/relatorios-agendados" component={RelatoriosAgendados} isPrivate title="Relatórios agendados" />
                <Route exact path="/automacoes-followup" component={AutomacoesFollowup} isPrivate title="Automações follow-up" />
                <Route exact path="/automacoes" component={Automacoes} isPrivate title="Automações" />
                <Route exact path="/leads-landing" component={LeadsLanding} isPrivate title="CRM Landing" />
                <Route exact path="/lgpd-solicitacoes" component={LgpdSolicitacoes} isPrivate title="LGPD" />
                <Route exact path="/lgpd/meus-dados" component={LgpdPortalTitular} isPrivate title="Portal titular" />
                <Route exact path="/prospeccao-diaria" component={ProspeccaoDiaria} isPrivate title="Prospecção diária" />
                <Route exact path="/consentimento" component={Consentimentos} isPrivate title="Consentimentos" />
                <Route exact path="/pagamentos-publicos" component={PagamentosPublicos} isPrivate title="Pagamento público" />
                <Route exact path="/inventory" component={Inventory} isPrivate title="Inventários" />
                <Route exact path="/arquivos" component={FilesPage} isPrivate title="Arquivos" />
                <Route exact path="/email" component={EmailPage} isPrivate title="Email" />

                {showCampaigns && (
                  <>
                    <Route
                      exact
                      path="/contact-lists"
                      component={ContactLists}
                      isPrivate
                      title="Listas de Contatos"
                    />
                    <Route
                      exact
                      path="/contact-lists/:contactListId/contacts"
                      component={ContactListItems}
                      isPrivate
                      title="Contatos da Lista"
                    />
                    <Route
                      exact
                      path="/campaigns"
                      component={Campaigns}
                      isPrivate
                      title="Campanhas"
                    />
                    <Route
                      exact
                      path="/campaign-meta-templates"
                      component={CampaignMetaTemplates}
                      isPrivate
                      title="Templates Meta (API Oficial)"
                    />
                    <Route
                      exact
                      path="/campaign/:campaignId/report"
                      component={CampaignReport}
                      isPrivate
                      title="Relatório de Campanha"
                    />
                    <Route
                      exact
                      path="/campaigns-config"
                      component={CampaignsConfig}
                      isPrivate
                      title="Configuração de Campanhas"
                    />
                  </>
                )}
              </LoggedInLayout>
          </CampaignSendingProvider>
            </WhatsAppsProvider>
          </Switch>
          <ToastContainer position="top-center" autoClose={3000} />
        </TicketsContextProvider>
  );
};

const Routes = () => {
  useEffect(() => {
    detectAndEnableOfflineMode(openApi).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <I18nReactivityRoot>
          <AppThemeRoot>
            <GoogleTranslateBridge />
            <RoutesContent />
          </AppThemeRoot>
        </I18nReactivityRoot>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
