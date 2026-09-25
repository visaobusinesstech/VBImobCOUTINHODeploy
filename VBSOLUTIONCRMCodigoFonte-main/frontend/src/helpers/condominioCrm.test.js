/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Helpers frontend CRM Condomínios.
 */

import {
  CONDOMINIO_CANAIS,
  CONDOMINIO_INICIATIVA_STATUSES,
  CONDOMINIO_CONTATO_TIPOS,
  CONDOMINIO_CONTATO_STATUSES,
  iniciativaToApiPayload,
  contatoToApiPayload,
  isLeadClosed,
  isIniciativaAtrasada,
  emptyIniciativaForm,
  emptyContatoForm
} from "./condominioCrm";

describe("condominioCrm frontend helpers", () => {
  it("exposes same canal/status/tipo options as Lovable", () => {
    expect(CONDOMINIO_CANAIS.map(c => c.value)).toEqual([
      "whatsapp_business",
      "email",
      "facebook_groups",
      "anuncio_geo",
      "portaria",
      "sindico",
      "administradora",
      "outro"
    ]);
    expect(CONDOMINIO_INICIATIVA_STATUSES.map(s => s.value)).toEqual([
      "planejado",
      "em_andamento",
      "aguardando_retorno",
      "concluido",
      "sem_sucesso",
      "cancelado"
    ]);
    expect(CONDOMINIO_CONTATO_TIPOS.map(t => t.value)).toEqual([
      "administradora",
      "sindico",
      "portaria",
      "imobiliaria",
      "outro"
    ]);
    expect(CONDOMINIO_CONTATO_STATUSES.map(s => s.value)).toEqual([
      "pendente",
      "verificado",
      "invalido",
      "contatado"
    ]);
  });

  it("maps form inputs to API payload keys (camelCase)", () => {
    const inic = iniciativaToApiPayload({
      ...emptyIniciativaForm(),
      condominioNome: "  Vida Bela ",
      titulo: " Campanha ",
      canal: "portaria",
      bairro: "Águas Claras",
      cep: "71919-000",
      responsavel: "Ana",
      dataAgendada: "2026-10-01T09:00"
    });
    expect(inic).toEqual({
      condominioNome: "Vida Bela",
      bairro: "Águas Claras",
      cep: "71919-000",
      canal: "portaria",
      titulo: "Campanha",
      descricao: null,
      responsavel: "Ana",
      dataAgendada: "2026-10-01T09:00",
      status: "planejado"
    });

    const ct = contatoToApiPayload({
      ...emptyContatoForm(),
      condominioNome: "Life Park",
      tipo: "sindico",
      telefone: "61999",
      confianca: "80"
    });
    expect(ct.condominioNome).toBe("Life Park");
    expect(ct.tipo).toBe("sindico");
    expect(ct.confianca).toBe(80);
    expect(ct.urlFonte).toBe("manual");
  });

  it("detects closed leads and overdue iniciativas", () => {
    expect(isLeadClosed("fechados")).toBe(true);
    expect(isLeadClosed("fechado")).toBe(true);
    expect(isLeadClosed("novo")).toBe(false);
    expect(
      isIniciativaAtrasada(
        { dataAgendada: "2020-01-01T00:00:00Z", dataConclusao: null },
        new Date("2026-09-25")
      )
    ).toBe(true);
    expect(
      isIniciativaAtrasada(
        { dataAgendada: "2020-01-01T00:00:00Z", dataConclusao: "2020-01-02T00:00:00Z" },
        new Date("2026-09-25")
      )
    ).toBe(false);
  });
});
