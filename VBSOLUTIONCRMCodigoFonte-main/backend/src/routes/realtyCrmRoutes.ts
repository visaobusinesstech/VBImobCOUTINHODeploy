/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import * as RealtyCrmController from "../controllers/RealtyCrmController";
import * as RealtyIntelController from "../controllers/RealtyIntelController";
import * as RealtyNutricaoController from "../controllers/RealtyNutricaoController";
import * as RealtyCondominioController from "../controllers/RealtyCondominioController";
import * as CorretoresController from "../controllers/CorretoresController";

const routes = express.Router();
const uploadImovel = multer(uploadConfig);
const uploadContrato = multer(uploadConfig);

routes.get("/proprietarios", isAuth, RealtyCrmController.listProprietarios);
routes.post(
  "/proprietarios/upload",
  isAuth,
  uploadImovel.array("file", 10),
  RealtyCrmController.uploadProprietarioMedia
);
routes.get("/proprietarios/:id", isAuth, RealtyCrmController.showProprietario);
routes.post("/proprietarios", isAuth, RealtyCrmController.storeProprietario);
routes.put("/proprietarios/:id", isAuth, RealtyCrmController.updateProprietario);
routes.delete("/proprietarios/:id", isAuth, RealtyCrmController.removeProprietario);

routes.get("/imoveis/match", isAuth, RealtyCrmController.matchImoveis);
routes.get("/imoveis", isAuth, RealtyCrmController.listImoveis);
routes.post("/imoveis", isAuth, RealtyCrmController.storeImovel);
routes.post("/imoveis/upload", isAuth, uploadImovel.array("file", 20), RealtyCrmController.uploadImovelMedia);
routes.put("/imoveis/:id", isAuth, RealtyCrmController.updateImovel);
routes.delete("/imoveis/:id", isAuth, RealtyCrmController.removeImovel);

routes.get("/contratos", isAuth, RealtyCrmController.listContratos);
routes.post("/contratos", isAuth, RealtyCrmController.storeContrato);
routes.post(
  "/contratos/upload",
  isAuth,
  (req, _res, next) => {
    req.body.typeArch = "contratos";
    return next();
  },
  uploadContrato.array("file", 20),
  RealtyCrmController.uploadContratoMedia
);
routes.put("/contratos/:id", isAuth, RealtyCrmController.updateContrato);
routes.delete("/contratos/:id", isAuth, RealtyCrmController.removeContrato);

routes.get("/contratos/:id/anexos-anuais", isAuth, RealtyCrmController.listContratoAnexosAnuais);
routes.post("/contratos/:id/anexos-anuais", isAuth, RealtyCrmController.storeContratoAnexoAnual);
routes.put(
  "/contratos/:id/anexos-anuais/:anexoId",
  isAuth,
  RealtyCrmController.updateContratoAnexoAnual
);
routes.delete(
  "/contratos/:id/anexos-anuais/:anexoId",
  isAuth,
  RealtyCrmController.removeContratoAnexoAnual
);

routes.get(
  "/contratos/:id/comprovantes-mensais",
  isAuth,
  RealtyCrmController.listContratoComprovantesMensais
);
routes.post(
  "/contratos/:id/comprovantes-mensais",
  isAuth,
  RealtyCrmController.storeContratoComprovanteMensal
);
routes.put(
  "/contratos/:id/comprovantes-mensais/:compId",
  isAuth,
  RealtyCrmController.updateContratoComprovanteMensal
);
routes.delete(
  "/contratos/:id/comprovantes-mensais/:compId",
  isAuth,
  RealtyCrmController.removeContratoComprovanteMensal
);

routes.get("/realty-followups", isAuth, RealtyCrmController.listFollowups);
routes.get("/realty-followups/counts", isAuth, RealtyCrmController.getFollowupCounts);
routes.post("/realty-followups/concluir-inativos", isAuth, RealtyCrmController.concluirFollowupsInativos);
routes.post("/realty-followups", isAuth, RealtyCrmController.storeFollowup);
routes.put("/realty-followups/:id", isAuth, RealtyCrmController.updateFollowup);
routes.delete("/realty-followups/:id", isAuth, RealtyCrmController.removeFollowup);
routes.post("/realty-followups/:id/enviar-whatsapp", isAuth, RealtyCrmController.sendFollowupWhatsApp);

routes.get("/realty-followup-templates", isAuth, RealtyCrmController.listFollowupTemplates);
routes.post("/realty-followup-templates", isAuth, RealtyCrmController.storeFollowupTemplate);
routes.put("/realty-followup-templates/:id", isAuth, RealtyCrmController.updateFollowupTemplate);
routes.delete("/realty-followup-templates/:id", isAuth, RealtyCrmController.removeFollowupTemplate);

routes.get("/realty-visitas", isAuth, RealtyCrmController.listVisitas);
routes.post("/realty-visitas", isAuth, RealtyCrmController.storeVisita);
routes.put("/realty-visitas/:id", isAuth, RealtyCrmController.updateVisita);
routes.delete("/realty-visitas/:id", isAuth, RealtyCrmController.removeVisita);

routes.get("/realty-compromissos", isAuth, RealtyCrmController.listCompromissos);
routes.post("/realty-compromissos", isAuth, RealtyCrmController.storeCompromisso);
routes.post(
  "/realty-compromissos/:id/gerar-confirmacao",
  isAuth,
  RealtyCrmController.gerarConfirmacaoCompromisso
);
routes.put("/realty-compromissos/:id", isAuth, RealtyCrmController.updateCompromisso);
routes.delete("/realty-compromissos/:id", isAuth, RealtyCrmController.removeCompromisso);

routes.get("/realty-propostas", isAuth, RealtyCrmController.listPropostas);
routes.post("/realty-propostas", isAuth, RealtyCrmController.storeProposta);
routes.put("/realty-propostas/:id", isAuth, RealtyCrmController.updateProposta);
routes.delete("/realty-propostas/:id", isAuth, RealtyCrmController.removeProposta);

routes.post("/imoveis/match/enviar-whatsapp", isAuth, RealtyCrmController.sendMatchWhatsApp);
routes.post("/imoveis/comparativo/enviar-whatsapp", isAuth, RealtyCrmController.sendComparativoWhatsApp);
routes.get("/realty-jornada", isAuth, RealtyCrmController.leadTimeline);

/* Nutrição multi-etapa — rotas específicas ANTES de /realty-nutricao/:id */
routes.get("/realty-nutricao/dashboard", isAuth, RealtyNutricaoController.dashboard);
routes.post("/realty-nutricao/fluxos", isAuth, RealtyNutricaoController.createFluxo);
routes.put("/realty-nutricao/fluxos/:id", isAuth, RealtyNutricaoController.updateFluxo);
routes.delete("/realty-nutricao/fluxos/:id", isAuth, RealtyNutricaoController.removeFluxo);
routes.patch("/realty-nutricao/fluxos/:id/toggle", isAuth, RealtyNutricaoController.toggleFluxo);
routes.post("/realty-nutricao/processar", isAuth, RealtyNutricaoController.processar);
routes.post("/realty-nutricao/envios/:id/enviar", isAuth, RealtyNutricaoController.enviarEnvio);
routes.patch("/realty-nutricao/envios/:id/status", isAuth, RealtyNutricaoController.updateEnvioStatus);
routes.post("/realty-nutricao/inscricoes/:id/encerrar", isAuth, RealtyNutricaoController.encerrarInscricao);
routes.post("/realty-nutricao/eventos", isAuth, RealtyNutricaoController.registrarEvento);
routes.post("/realty-nutricao/etapas/:id/ab-vencedor", isAuth, RealtyNutricaoController.definirAbVencedor);
routes.post("/realty-nutricao/etapas/:id/ab-reabrir", isAuth, RealtyNutricaoController.reabrirAb);
routes.get("/realty-nutricao/metas", isAuth, RealtyNutricaoController.getMetas);
routes.put("/realty-nutricao/metas", isAuth, RealtyNutricaoController.putMetas);
routes.post("/realty-nutricao/metas/verificar", isAuth, RealtyNutricaoController.verificarMetas);
routes.patch("/realty-nutricao/metas/alertas/:id/resolver", isAuth, RealtyNutricaoController.resolverAlerta);
routes.post("/realty-nutricao/ia/sugerir-mensagem", isAuth, RealtyNutricaoController.sugerirMensagem);

/* Legacy CRUD cadências simples */
routes.get("/realty-nutricao", isAuth, RealtyCrmController.listNutricao);
routes.post("/realty-nutricao", isAuth, RealtyCrmController.storeNutricao);
routes.put("/realty-nutricao/:id", isAuth, RealtyCrmController.updateNutricao);
routes.delete("/realty-nutricao/:id", isAuth, RealtyCrmController.removeNutricao);
routes.post("/realty-nutricao/:id/enviar-whatsapp", isAuth, RealtyCrmController.sendNutricaoWhatsApp);

routes.get("/realty-prospeccao", isAuth, RealtyCrmController.listProspeccao);
routes.post("/realty-prospeccao", isAuth, RealtyCrmController.storeProspeccao);
routes.put("/realty-prospeccao/:id", isAuth, RealtyCrmController.updateProspeccao);
routes.delete("/realty-prospeccao/:id", isAuth, RealtyCrmController.removeProspeccao);

routes.get("/realty-prospeccao-diaria", isAuth, RealtyCrmController.listProspeccaoDiaria);
routes.post("/realty-prospeccao-diaria/upsert", isAuth, RealtyCrmController.upsertProspeccaoDiaria);
routes.delete("/realty-prospeccao-diaria/:id", isAuth, RealtyCrmController.removeProspeccaoDiaria);

/* Inadimplência + transações (paridade Lovable /inadimplencia) */
routes.get("/realty-transacoes", isAuth, RealtyCrmController.listTransacoes);
routes.post("/realty-transacoes", isAuth, RealtyCrmController.storeTransacao);
routes.put("/realty-transacoes/:id", isAuth, RealtyCrmController.updateTransacao);
routes.delete("/realty-transacoes/:id", isAuth, RealtyCrmController.removeTransacao);
routes.get("/inadimplencia", isAuth, RealtyCrmController.getInadimplencia);
routes.post("/inadimplencia/alertas", isAuth, RealtyCrmController.gerarAlertasInadimplencia);

/* Consulta CPF — paridade Lovable credit-check */
routes.post("/realty-consulta-cpf/credit-check", isAuth, RealtyCrmController.creditCheckConsultaCpf);
routes.get("/realty-consulta-cpf/historico", isAuth, RealtyCrmController.listConsultaCpfHistorico);

routes.get("/realty-relacionamento", isAuth, RealtyCrmController.listClientesRelacionamento);
routes.get("/realty-relacionamento/templates", isAuth, RealtyCrmController.listMensagemTemplates);
routes.post("/realty-relacionamento/templates", isAuth, RealtyCrmController.upsertMensagemTemplate);
routes.post("/realty-relacionamento/ia/gerar-mensagens", isAuth, RealtyCrmController.gerarMensagensRelacionamentoIa);
routes.post("/realty-relacionamento", isAuth, RealtyCrmController.storeClienteRelacionamento);
routes.put("/realty-relacionamento/:id", isAuth, RealtyCrmController.updateClienteRelacionamento);
routes.delete("/realty-relacionamento/:id", isAuth, RealtyCrmController.removeClienteRelacionamento);

routes.get("/realty-captacoes", isAuth, RealtyCrmController.listCaptacoes);
routes.post("/realty-captacoes", isAuth, RealtyCrmController.storeCaptacao);
routes.put("/realty-captacoes/:id", isAuth, RealtyCrmController.updateCaptacao);
routes.delete("/realty-captacoes/:id", isAuth, RealtyCrmController.removeCaptacao);

/* CRM Condomínios — paridade Lovable CrmCondominios */
routes.get("/realty-condominios/hub", isAuth, RealtyCondominioController.hubCondominios);
routes.get("/realty-condominio-iniciativas", isAuth, RealtyCondominioController.listIniciativas);
routes.post("/realty-condominio-iniciativas", isAuth, RealtyCondominioController.storeIniciativa);
routes.put("/realty-condominio-iniciativas/:id", isAuth, RealtyCondominioController.updateIniciativa);
routes.delete(
  "/realty-condominio-iniciativas/:id",
  isAuth,
  RealtyCondominioController.removeIniciativa
);
routes.get(
  "/realty-condominio-iniciativas/:id/logs",
  isAuth,
  RealtyCondominioController.listIniciativaLogs
);
routes.post(
  "/realty-condominio-iniciativas/:id/logs",
  isAuth,
  RealtyCondominioController.storeIniciativaLog
);
routes.get("/realty-condominio-contatos", isAuth, RealtyCondominioController.listContatos);
routes.post("/realty-condominio-contatos", isAuth, RealtyCondominioController.storeContato);
routes.put("/realty-condominio-contatos/:id", isAuth, RealtyCondominioController.updateContato);
routes.delete("/realty-condominio-contatos/:id", isAuth, RealtyCondominioController.removeContato);

routes.get("/realty-automacao-followup", isAuth, RealtyCrmController.listAutomacaoFollowup);
routes.post("/realty-automacao-followup", isAuth, RealtyCrmController.storeAutomacaoFollowup);
routes.put("/realty-automacao-followup/:id", isAuth, RealtyCrmController.updateAutomacaoFollowup);
routes.delete("/realty-automacao-followup/:id", isAuth, RealtyCrmController.removeAutomacaoFollowup);
routes.post("/realty-automacao-followup/run", isAuth, RealtyCrmController.runAutomacoesFollowup);

routes.get("/realty-fila-config", isAuth, RealtyCrmController.getFilaConfig);
routes.put("/realty-fila-config", isAuth, RealtyCrmController.saveFilaConfig);
routes.get("/realty-fila/overview", isAuth, RealtyCrmController.getFilaOverview);
routes.post("/realty-fila/assign", isAuth, RealtyCrmController.assignFilaLead);
routes.post("/realty-fila/distribuir", isAuth, RealtyCrmController.distribuirFila);
routes.put("/realty-fila/limite-corretor", isAuth, RealtyCrmController.setLimiteCorretorFila);
routes.post("/realty-fila/:id/encerrar", isAuth, RealtyCrmController.encerrarLeadFila);

routes.get("/radarzap/grupos", isAuth, RealtyIntelController.listGrupos);
routes.post("/radarzap/grupos", isAuth, RealtyIntelController.storeGrupo);
routes.put("/radarzap/grupos/:id", isAuth, RealtyIntelController.updateGrupo);
routes.delete("/radarzap/grupos/:id", isAuth, RealtyIntelController.removeGrupo);
routes.get("/radarzap/mensagens", isAuth, RealtyIntelController.listMensagens);
routes.post("/radarzap/analisar", isAuth, RealtyIntelController.analisarMensagem);
routes.get("/radarzap/leads", isAuth, RealtyIntelController.listRadarLeads);
routes.put("/radarzap/leads/:id", isAuth, RealtyIntelController.updateRadarLead);
routes.post("/radarzap/leads/:id/converter", isAuth, RealtyIntelController.converterRadarLead);

routes.get("/mercado", isAuth, RealtyIntelController.listMercado);
routes.post("/mercado/scrape", isAuth, RealtyIntelController.scrapePortais);
routes.post("/mercado", isAuth, RealtyIntelController.salvarMercado);
routes.post("/mercado/:id/importar", isAuth, RealtyIntelController.importarMercadoComoImovel);
routes.get("/qcapture", isAuth, RealtyIntelController.qcaptureAnalise);

routes.get("/seo", isAuth, RealtyIntelController.listSeo);
routes.post("/seo/gerar", isAuth, RealtyIntelController.gerarSeo);
routes.post("/seo", isAuth, RealtyIntelController.salvarSeo);

routes.get("/realty-corretores", isAuth, CorretoresController.listCorretores);
routes.post("/realty-corretores", isAuth, CorretoresController.storeCorretor);
routes.put("/realty-corretores/:id", isAuth, CorretoresController.updateCorretor);
routes.delete("/realty-corretores/:id", isAuth, CorretoresController.removeCorretor);
routes.get("/realty-corretores/:id/permissoes", isAuth, CorretoresController.listPermissoes);
routes.put("/realty-corretores/:id/permissoes", isAuth, CorretoresController.upsertPermissao);
routes.get("/realty-corretores-desempenho", isAuth, CorretoresController.getDesempenho);
routes.get("/realty-corretores-atribuicao", isAuth, CorretoresController.listAtribuicaoRegras);
routes.post("/realty-corretores-atribuicao", isAuth, CorretoresController.storeAtribuicaoRegra);
routes.put("/realty-corretores-atribuicao/:id", isAuth, CorretoresController.updateAtribuicaoRegra);
routes.delete("/realty-corretores-atribuicao/:id", isAuth, CorretoresController.removeAtribuicaoRegra);

routes.get("/realty-modulos", isAuth, RealtyIntelController.listModulos);
routes.post("/realty-modulos", isAuth, RealtyIntelController.storeModulo);
routes.put("/realty-modulos/:id", isAuth, RealtyIntelController.updateModulo);
routes.delete("/realty-modulos/:id", isAuth, RealtyIntelController.removeModulo);
routes.post("/avaliacao", isAuth, RealtyIntelController.avaliarImovel);
routes.post("/avaliacao/extrair-link", isAuth, RealtyIntelController.extrairDadosAnuncio);
routes.get("/avaliacoes-historico", isAuth, RealtyIntelController.listAvaliacoesHistorico);
routes.post("/avaliacoes-historico", isAuth, RealtyIntelController.storeAvaliacaoHistorico);
routes.put("/avaliacoes-historico/:id", isAuth, RealtyIntelController.updateAvaliacaoHistorico);
routes.delete("/avaliacoes-historico/:id", isAuth, RealtyIntelController.removeAvaliacaoHistorico);
routes.get("/jornada", isAuth, RealtyIntelController.jornadaCliente);
routes.get("/inteligencia", isAuth, RealtyIntelController.inteligenciaMercado);
routes.get("/realty-dashboard", isAuth, RealtyIntelController.realtyDashboard);
routes.post("/realty-seed-demo", isAuth, RealtyIntelController.seedRealtyDemo);

export default routes;
