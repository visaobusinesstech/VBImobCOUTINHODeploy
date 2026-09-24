/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import express from "express";
import isAuth from "../middleware/isAuth";
import * as RealtyCrmController from "../controllers/RealtyCrmController";
import * as RealtyIntelController from "../controllers/RealtyIntelController";

const routes = express.Router();

routes.get("/proprietarios", isAuth, RealtyCrmController.listProprietarios);
routes.post("/proprietarios", isAuth, RealtyCrmController.storeProprietario);
routes.put("/proprietarios/:id", isAuth, RealtyCrmController.updateProprietario);
routes.delete("/proprietarios/:id", isAuth, RealtyCrmController.removeProprietario);

routes.get("/imoveis/match", isAuth, RealtyCrmController.matchImoveis);
routes.get("/imoveis", isAuth, RealtyCrmController.listImoveis);
routes.post("/imoveis", isAuth, RealtyCrmController.storeImovel);
routes.put("/imoveis/:id", isAuth, RealtyCrmController.updateImovel);
routes.delete("/imoveis/:id", isAuth, RealtyCrmController.removeImovel);

routes.get("/contratos", isAuth, RealtyCrmController.listContratos);
routes.post("/contratos", isAuth, RealtyCrmController.storeContrato);
routes.put("/contratos/:id", isAuth, RealtyCrmController.updateContrato);
routes.delete("/contratos/:id", isAuth, RealtyCrmController.removeContrato);

routes.get("/realty-followups", isAuth, RealtyCrmController.listFollowups);
routes.post("/realty-followups", isAuth, RealtyCrmController.storeFollowup);
routes.put("/realty-followups/:id", isAuth, RealtyCrmController.updateFollowup);
routes.delete("/realty-followups/:id", isAuth, RealtyCrmController.removeFollowup);

routes.get("/realty-visitas", isAuth, RealtyCrmController.listVisitas);
routes.post("/realty-visitas", isAuth, RealtyCrmController.storeVisita);
routes.put("/realty-visitas/:id", isAuth, RealtyCrmController.updateVisita);
routes.delete("/realty-visitas/:id", isAuth, RealtyCrmController.removeVisita);

routes.get("/realty-propostas", isAuth, RealtyCrmController.listPropostas);
routes.post("/realty-propostas", isAuth, RealtyCrmController.storeProposta);
routes.put("/realty-propostas/:id", isAuth, RealtyCrmController.updateProposta);
routes.delete("/realty-propostas/:id", isAuth, RealtyCrmController.removeProposta);

routes.post("/imoveis/match/enviar-whatsapp", isAuth, RealtyCrmController.sendMatchWhatsApp);
routes.post("/imoveis/comparativo/enviar-whatsapp", isAuth, RealtyCrmController.sendComparativoWhatsApp);
routes.get("/realty-jornada", isAuth, RealtyCrmController.leadTimeline);

routes.get("/realty-nutricao", isAuth, RealtyCrmController.listNutricao);
routes.post("/realty-nutricao", isAuth, RealtyCrmController.storeNutricao);
routes.put("/realty-nutricao/:id", isAuth, RealtyCrmController.updateNutricao);
routes.delete("/realty-nutricao/:id", isAuth, RealtyCrmController.removeNutricao);

routes.get("/realty-prospeccao", isAuth, RealtyCrmController.listProspeccao);
routes.post("/realty-prospeccao", isAuth, RealtyCrmController.storeProspeccao);
routes.put("/realty-prospeccao/:id", isAuth, RealtyCrmController.updateProspeccao);
routes.delete("/realty-prospeccao/:id", isAuth, RealtyCrmController.removeProspeccao);

routes.get("/realty-automacao-followup", isAuth, RealtyCrmController.listAutomacaoFollowup);
routes.post("/realty-automacao-followup", isAuth, RealtyCrmController.storeAutomacaoFollowup);
routes.put("/realty-automacao-followup/:id", isAuth, RealtyCrmController.updateAutomacaoFollowup);
routes.delete("/realty-automacao-followup/:id", isAuth, RealtyCrmController.removeAutomacaoFollowup);
routes.post("/realty-automacao-followup/run", isAuth, RealtyCrmController.runAutomacoesFollowup);

routes.get("/realty-fila-config", isAuth, RealtyCrmController.getFilaConfig);
routes.put("/realty-fila-config", isAuth, RealtyCrmController.saveFilaConfig);
routes.post("/realty-fila/assign", isAuth, RealtyCrmController.assignFilaLead);

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

routes.get("/realty-modulos", isAuth, RealtyIntelController.listModulos);
routes.post("/realty-modulos", isAuth, RealtyIntelController.storeModulo);
routes.put("/realty-modulos/:id", isAuth, RealtyIntelController.updateModulo);
routes.delete("/realty-modulos/:id", isAuth, RealtyIntelController.removeModulo);
routes.post("/avaliacao", isAuth, RealtyIntelController.avaliarImovel);
routes.get("/jornada", isAuth, RealtyIntelController.jornadaCliente);
routes.get("/inteligencia", isAuth, RealtyIntelController.inteligenciaMercado);

export default routes;
