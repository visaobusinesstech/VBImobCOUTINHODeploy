/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Paridade Agenda Imobiliária (Lovable compromissos ↔ VBSolution realty_compromissos).
 */

import fs from "fs";
import path from "path";
import {
  COMPROMISSO_STATUSES,
  COMPROMISSO_TIPOS,
  COMPROMISSO_PRIORIDADES,
  COMPROMISSO_RESULTADO_CLIENTE,
  pickAllowedStatus
} from "../helpers/realtyCrm";

const FRONT = path.resolve(__dirname, "../../../frontend/src");

function readFront(rel: string) {
  return fs.readFileSync(path.join(FRONT, rel), "utf8");
}

/** Mapeamento canônico Lovable snake_case → VBSolution camelCase */
const FIELD_MAP: Record<string, string> = {
  titulo: "title",
  descricao: "description",
  tipo: "tipo",
  data_inicio: "dataInicio",
  data_fim: "dataFim",
  local: "local",
  lead_id: "leadSaleId",
  corretor_id: "userId",
  imovel_id: "imovelId",
  status: "status",
  lembrete_whatsapp: "lembreteWhatsapp",
  telefone_lembrete: "telefoneLembrete",
  prioridade: "prioridade",
  email_cliente: "emailCliente",
  google_maps_link: "googleMapsLink",
  confirmado: "confirmado",
  lembrete_nivel: "lembreteNivel",
  checkin_at: "checkinAt",
  checkout_at: "checkoutAt",
  feedback_visita: "feedbackVisita",
  feedback_ia: "feedbackIa",
  confirmacao_status: "confirmacaoStatus",
  confirmacao_token: "confirmacaoToken",
  confirmacao_mensagem: "confirmacaoMensagem",
  cliente_resposta: "clienteResposta",
  data_reagendamento_sugerida: "dataReagendamentoSugerida",
  resultado_cliente: "resultadoCliente"
};

describe("agenda compromissos parity", () => {
  it("exposes Lovable compromisso tipos / prioridades / resultados", () => {
    expect([...COMPROMISSO_TIPOS]).toEqual([
      "visita",
      "reuniao",
      "tarefa",
      "ligacao",
      "assinatura",
      "outro"
    ]);
    expect([...COMPROMISSO_PRIORIDADES]).toEqual(["alta", "media", "baixa"]);
    expect([...COMPROMISSO_RESULTADO_CLIENTE]).toEqual([
      "gostou",
      "mais_opcoes",
      "nao_gostou"
    ]);
    expect([...COMPROMISSO_STATUSES]).toEqual(["pendente", "concluido", "cancelado"]);
  });

  it("pickAllowedStatus keeps compromisso statuses strict", () => {
    expect(pickAllowedStatus("concluido", COMPROMISSO_STATUSES as any, "pendente")).toBe(
      "concluido"
    );
    expect(pickAllowedStatus("agendada", COMPROMISSO_STATUSES as any, "pendente")).toBe(
      "pendente"
    );
  });

  it("maps every Lovable compromisso field to a VBSolution camelCase column", () => {
    const migration = fs.readFileSync(
      path.resolve(
        __dirname,
        "../database/migrations/20260925230000-create-realty-compromissos.js"
      ),
      "utf8"
    );
    const model = fs.readFileSync(
      path.resolve(__dirname, "../models/RealtyCompromisso.ts"),
      "utf8"
    );
    Object.values(FIELD_MAP).forEach(col => {
      expect(migration).toContain(col);
      expect(model).toContain(col);
    });
  });

  it("API routes register compromissos CRUD + confirmação", () => {
    const routes = fs.readFileSync(
      path.resolve(__dirname, "../routes/realtyCrmRoutes.ts"),
      "utf8"
    );
    expect(routes).toContain('"/realty-compromissos"');
    expect(routes).toContain("listCompromissos");
    expect(routes).toContain("storeCompromisso");
    expect(routes).toContain("updateCompromisso");
    expect(routes).toContain("removeCompromisso");
    expect(routes).toContain("gerarConfirmacaoCompromisso");
  });

  it("frontend service exposes compromisso methods", () => {
    const svc = readFront("services/realtyService.js");
    expect(svc).toContain("listCompromissos");
    expect(svc).toContain("createCompromisso");
    expect(svc).toContain("updateCompromisso");
    expect(svc).toContain("deleteCompromisso");
    expect(svc).toContain("gerarConfirmacaoCompromisso");
  });

  it("frontend agenda page has Lovable views and tabs", () => {
    const page = readFront("pages/AgendaImobiliaria/index.js");
    expect(page).toContain('setView("list")');
    expect(page).toContain('setView("week")');
    expect(page).toContain('setView("calendar")');
    expect(page).toContain('setTab("todos")');
    expect(page).toContain('setTab("visitas")');
    expect(page).toContain('setTab("followups")');
    expect(page).toContain("filterTipo");
    expect(page).toContain("filterCorretor");
    expect(page).toContain("filterLead");
    expect(page).toContain("handleDropItem");
    expect(page).toContain("RegistrarVisitaDialog");
  });

  it("compromisso form maps Lovable inputs to API payload keys", () => {
    const form = readFront("pages/AgendaImobiliaria/CompromissoFormDialog.js");
    [
      "title:",
      "tipo:",
      "dataInicio",
      "dataFim",
      "local:",
      "description:",
      "leadSaleId",
      "userId",
      "lembreteWhatsapp",
      "telefoneLembrete",
      "prioridade",
      "emailCliente",
      "googleMapsLink"
    ].forEach(k => expect(form).toContain(k));
  });

  it("registrar visita uses resultado_cliente options", () => {
    const helpers = readFront("helpers/realtyCrm.js");
    expect(helpers).toContain('id: "gostou"');
    expect(helpers).toContain('id: "mais_opcoes"');
    expect(helpers).toContain('id: "nao_gostou"');
    const dialog = readFront("pages/AgendaImobiliaria/RegistrarVisitaDialog.js");
    expect(dialog).toContain("feedbackVisita");
    expect(dialog).toContain("resultadoCliente");
  });
});
