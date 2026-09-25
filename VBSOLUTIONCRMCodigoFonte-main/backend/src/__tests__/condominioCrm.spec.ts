/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Paridade CRM Condomínios (Lovable ↔ VBSolution).
 */

import {
  CONDOMINIO_CANAIS,
  CONDOMINIO_INICIATIVA_STATUSES,
  CONDOMINIO_CONTATO_TIPOS,
  CONDOMINIO_CONTATO_STATUSES,
  CONDOMINIO_LOG_TIPOS,
  buildCondominioHub,
  computeCondominioKpis,
  isIniciativaAtrasada,
  isLeadClosed,
  matchLeadsToCondo,
  normalizeContatoPayload,
  normalizeIniciativaPayload,
  mapLeadSaleToCondoLead
} from "../helpers/condominioCrm";
import fs from "fs";
import path from "path";

const FRONT = path.resolve(__dirname, "../../../frontend/src");

function readFront(rel: string) {
  return fs.readFileSync(path.join(FRONT, rel), "utf8");
}

/** Lovable snake_case → VBSolution camelCase */
const INICIATIVA_FIELD_MAP: Record<string, string> = {
  condominio_nome: "condominioNome",
  bairro: "bairro",
  cep: "cep",
  canal: "canal",
  titulo: "titulo",
  descricao: "descricao",
  status: "status",
  responsavel: "responsavel",
  data_agendada: "dataAgendada",
  data_conclusao: "dataConclusao",
  resultado: "resultado",
  metadata: "metadata",
  created_by: "createdBy"
};

const CONTATO_FIELD_MAP: Record<string, string> = {
  condominio_nome: "condominioNome",
  tipo: "tipo",
  nome: "nome",
  cargo: "cargo",
  telefone: "telefone",
  email: "email",
  url_fonte: "urlFonte",
  trecho_fonte: "trechoFonte",
  confianca: "confianca",
  status: "status",
  metadata: "metadata"
};

describe("crm condominios parity", () => {
  it("exposes Lovable canal / status / tipo enums", () => {
    expect([...CONDOMINIO_CANAIS]).toEqual([
      "whatsapp_business",
      "email",
      "facebook_groups",
      "anuncio_geo",
      "portaria",
      "sindico",
      "administradora",
      "outro"
    ]);
    expect([...CONDOMINIO_INICIATIVA_STATUSES]).toEqual([
      "planejado",
      "em_andamento",
      "aguardando_retorno",
      "concluido",
      "sem_sucesso",
      "cancelado"
    ]);
    expect([...CONDOMINIO_CONTATO_TIPOS]).toEqual([
      "administradora",
      "sindico",
      "portaria",
      "imobiliaria",
      "outro"
    ]);
    expect([...CONDOMINIO_CONTATO_STATUSES]).toEqual([
      "pendente",
      "verificado",
      "invalido",
      "contatado"
    ]);
    expect([...CONDOMINIO_LOG_TIPOS]).toEqual([
      "nota",
      "status_change",
      "mensagem_enviada",
      "resposta_recebida",
      "anexo",
      "sistema"
    ]);
  });

  it("maps every Lovable iniciativa field to camelCase column", () => {
    const migration = fs.readFileSync(
      path.resolve(
        __dirname,
        "../database/migrations/20260925241000-realty-condominio-crm.js"
      ),
      "utf8"
    );
    const model = fs.readFileSync(
      path.resolve(__dirname, "../models/RealtyCondominioIniciativa.ts"),
      "utf8"
    );
    Object.values(INICIATIVA_FIELD_MAP).forEach(col => {
      expect(migration).toContain(col);
      expect(model).toContain(col);
    });
  });

  it("maps every Lovable contato field to camelCase column", () => {
    const migration = fs.readFileSync(
      path.resolve(
        __dirname,
        "../database/migrations/20260925241000-realty-condominio-crm.js"
      ),
      "utf8"
    );
    const model = fs.readFileSync(
      path.resolve(__dirname, "../models/RealtyCondominioContato.ts"),
      "utf8"
    );
    Object.values(CONTATO_FIELD_MAP).forEach(col => {
      expect(migration).toContain(col);
      expect(model).toContain(col);
    });
  });

  it("API routes register hub + iniciativas + contatos CRUD", () => {
    const routes = fs.readFileSync(
      path.resolve(__dirname, "../routes/realtyCrmRoutes.ts"),
      "utf8"
    );
    expect(routes).toContain('"/realty-condominios/hub"');
    expect(routes).toContain('"/realty-condominio-iniciativas"');
    expect(routes).toContain('"/realty-condominio-contatos"');
    expect(routes).toContain("hubCondominios");
    expect(routes).toContain("storeIniciativa");
    expect(routes).toContain("storeContato");
  });

  it("frontend service exposes condominio methods", () => {
    const svc = readFront("services/realtyService.js");
    expect(svc).toContain("hubCondominios");
    expect(svc).toContain("createCondominioIniciativa");
    expect(svc).toContain("updateCondominioIniciativa");
    expect(svc).toContain("createCondominioContato");
    expect(svc).toContain("updateCondominioContato");
    expect(svc).toContain("deleteCondominioContato");
  });

  it("frontend page has Lovable KPIs, search, tabs and form inputs", () => {
    const page = readFront("pages/CrmCondominios/index.js");
    expect(page).toContain("Buscar condomínio ou bairro");
    expect(page).toContain('useState("leads")');
    expect(page).toContain('id: "leads"');
    expect(page).toContain('id: "contatos"');
    expect(page).toContain('id: "proximos"');
    expect(page).toContain('id: "performance"');
    expect(page).toContain("Condomínios");
    expect(page).toContain("Leads vinculados");
    expect(page).toContain("Fechados");
    expect(page).toContain("Próximos passos");
    expect(page).toContain("Atrasados");
    [
      "condominioNome",
      "bairro",
      "cep",
      "canal",
      "titulo",
      "descricao",
      "responsavel",
      "dataAgendada",
      "tipo",
      "telefone",
      "email",
      "urlFonte",
      "confianca"
    ].forEach(k => expect(page).toContain(k));
  });

  it("RealtyModules exports dedicated Condominios page", () => {
    const mod = readFront("pages/RealtyModules/index.js");
    expect(mod).toContain('export { default as Condominios } from "../CrmCondominios"');
  });

  it("normalizeIniciativaPayload accepts snake_case and validates enums", () => {
    const data = normalizeIniciativaPayload({
      condominio_nome: "Life Park Sul",
      titulo: "Campanha WA",
      canal: "whatsapp_business",
      status: "planejado",
      data_agendada: "2026-10-01T10:00:00"
    });
    expect(data.condominioNome).toBe("Life Park Sul");
    expect(data.titulo).toBe("Campanha WA");
    expect(data.canal).toBe("whatsapp_business");
    expect(data.dataAgendada).toBe("2026-10-01T10:00:00");

    const bad = normalizeIniciativaPayload({
      condominioNome: "X",
      titulo: "Y",
      canal: "telegram",
      status: "xyz"
    });
    expect(bad.canal).toBe("whatsapp_business");
    expect(bad.status).toBe("planejado");
  });

  it("normalizeContatoPayload maps url_fonte and clamps confianca", () => {
    const data = normalizeContatoPayload({
      condominio_nome: "Vida Bela",
      tipo: "sindico",
      url_fonte: "https://example.com",
      confianca: 150
    });
    expect(data.condominioNome).toBe("Vida Bela");
    expect(data.tipo).toBe("sindico");
    expect(data.urlFonte).toBe("https://example.com");
    expect(data.confianca).toBe(100);
  });

  it("buildCondominioHub groups by nome, matches leads and sorts", () => {
    const iniciativas = [
      {
        condominioNome: "Alpha",
        bairro: "Asa Sul",
        canal: "email",
        titulo: "A",
        status: "planejado",
        dataAgendada: "2099-01-01T00:00:00Z",
        dataConclusao: null
      },
      {
        condominioNome: "Beta",
        bairro: null,
        canal: "portaria",
        titulo: "B",
        status: "em_andamento",
        dataAgendada: "2020-01-01T00:00:00Z",
        dataConclusao: null
      }
    ];
    const contatos = [
      { condominioNome: "Alpha", tipo: "sindico", nome: "João" },
      { condominioNome: "Gamma", tipo: "portaria", nome: "Maria" }
    ];
    const leads = [
      {
        id: 1,
        nome: "Lead 1",
        interesse: "Apartamento no Alpha",
        bairroInteresse: "Asa Sul",
        estagio: "fechado",
        valor: 1000
      },
      {
        id: 2,
        nome: "Lead 2",
        interesse: "Casa",
        bairroInteresse: "Alpha",
        estagio: "novo",
        valor: 0
      },
      {
        id: 3,
        nome: "Lead 3",
        interesse: "Outro",
        bairroInteresse: "Guará",
        estagio: "fechados",
        valor: 500
      }
    ];

    const hub = buildCondominioHub({ iniciativas, contatos, leads });
    expect(hub.map(c => c.nome)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(hub[0].leads.map(l => l.id)).toEqual([1, 2]);
    expect(hub[0].contatos).toHaveLength(1);
    expect(hub[0].iniciativas).toHaveLength(1);

    const filtered = buildCondominioHub({
      iniciativas,
      contatos,
      leads,
      search: "gamma"
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].nome).toBe("Gamma");
  });

  it("computeCondominioKpis counts atrasados and fechados (Lovable + VB statuses)", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    const iniciativas = [
      {
        condominioNome: "A",
        canal: "email",
        titulo: "t",
        status: "planejado",
        dataAgendada: "2026-09-20T00:00:00Z",
        dataConclusao: null
      },
      {
        condominioNome: "A",
        canal: "email",
        titulo: "t2",
        status: "planejado",
        dataAgendada: "2026-10-01T00:00:00Z",
        dataConclusao: null
      },
      {
        condominioNome: "B",
        canal: "email",
        titulo: "t3",
        status: "concluido",
        dataAgendada: "2026-09-01T00:00:00Z",
        dataConclusao: "2026-09-02T00:00:00Z"
      }
    ];
    const leads = [
      { id: 1, nome: "L1", estagio: "fechado" },
      { id: 2, nome: "L2", estagio: "fechados" },
      { id: 3, nome: "L3", estagio: "novo" }
    ];
    const condominios = buildCondominioHub({ iniciativas, contatos: [], leads });
    const kpis = computeCondominioKpis({ condominios, iniciativas, leads, now });
    expect(kpis.proximos).toBe(2);
    expect(kpis.atrasados).toBe(1);
    expect(kpis.fechados).toBe(2);
    expect(isIniciativaAtrasada({ ...iniciativas[0], now })).toBe(true);
    expect(isLeadClosed("fechados")).toBe(true);
    expect(isLeadClosed("fechado")).toBe(true);
  });

  it("matchLeadsToCondo and mapLeadSaleToCondoLead bridge LeadSale fields", () => {
    const mapped = mapLeadSaleToCondoLead({
      id: 9,
      name: "Ana",
      phone: "619999",
      email: "a@b.com",
      status: "visita",
      value: 350000,
      origin: "site",
      interestType: "apartamento",
      interestNeighborhood: "Life Park",
      purpose: "compra",
      description: "quer Life Park Sul",
      tags: ["vip"],
      createdAt: "2026-01-01"
    });
    expect(mapped.interesse).toContain("apartamento");
    expect(mapped.bairroInteresse).toBe("Life Park");
    expect(mapped.estagio).toBe("visita");
    expect(mapped.canalOrigem).toBe("site");
    expect(matchLeadsToCondo("Life Park", [mapped])).toHaveLength(1);
    expect(matchLeadsToCondo("Inexistente", [mapped])).toHaveLength(0);
  });
});
