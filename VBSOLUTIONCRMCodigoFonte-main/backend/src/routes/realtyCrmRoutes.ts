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
