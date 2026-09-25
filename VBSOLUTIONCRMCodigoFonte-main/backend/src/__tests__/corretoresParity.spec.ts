/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Paridade Corretores (Lovable ↔ VBSolution).
 */

import fs from "fs";
import path from "path";
import {
  CORRETOR_MODULOS,
  CORRETOR_PONTOS,
  CORRETOR_METAS,
  CORRETOR_PERIODOS,
  CORRETOR_FORM_FIELDS,
  ATRIBUICAO_FORM_FIELDS,
  CORRETOR_FIELD_MAP,
  ATRIBUICAO_FIELD_MAP,
  normalizeCorretorForm,
  serializeCorretor,
  buildDefaultPermissoes,
  computePontuacao,
  computeTaxaConversao,
  finalizeDesempenho,
  isLeadFechado,
  isLeadNovo,
  normalizeAtribuicaoForm,
  filterCorretoresBySearch,
  CAPTACAO_CLOSED_STAGES
} from "../helpers/corretoresParity";

const FRONT = path.resolve(__dirname, "../../../frontend/src");

function readFront(rel: string) {
  return fs.readFileSync(path.join(FRONT, rel), "utf8");
}

describe("corretores parity — Lovable inputs/opções", () => {
  it("exposes the same 12 permission modules as Lovable", () => {
    expect(CORRETOR_MODULOS.map(m => m.key)).toEqual([
      "dashboard",
      "imoveis",
      "crm",
      "automacoes",
      "financeiro",
      "contratos",
      "relacionamento",
      "jornada",
      "followups",
      "seguranca",
      "configuracoes",
      "proprietarios"
    ]);
    expect(CORRETOR_MODULOS.map(m => m.label)).toEqual([
      "Dashboard",
      "Imóveis",
      "CRM Pipeline",
      "Automações",
      "Financeiro",
      "Contratos",
      "Relacionamento",
      "Jornada do Cliente",
      "Follow-up",
      "Segurança",
      "Configurações",
      "Proprietários"
    ]);
  });

  it("matches Lovable ranking points and metas", () => {
    expect(CORRETOR_PONTOS).toEqual({
      fechamento: 10,
      contrato: 8,
      visita: 3,
      reuniao: 2,
      lead: 1
    });
    expect(CORRETOR_METAS).toEqual({ visitas: 20, conversoes: 5, contratos: 3 });
    expect([...CORRETOR_PERIODOS]).toEqual(["7", "30", "90", "365"]);
  });

  it("Equipe form has exactly nome/email/telefone/creci", () => {
    expect([...CORRETOR_FORM_FIELDS]).toEqual(["nome", "email", "telefone", "creci"]);
  });

  it("Atribuição form has corretor_id/cidade/bairro/prioridade/peso/ativo", () => {
    expect([...ATRIBUICAO_FORM_FIELDS]).toEqual([
      "corretor_id",
      "cidade",
      "bairro",
      "prioridade",
      "peso",
      "ativo"
    ]);
  });

  it("maps Lovable snake_case fields to VBSolution columns", () => {
    expect(CORRETOR_FIELD_MAP.nome).toBe("title");
    expect(CORRETOR_FIELD_MAP.email).toBe("payload.email");
    expect(CORRETOR_FIELD_MAP.telefone).toBe("payload.telefone");
    expect(CORRETOR_FIELD_MAP.creci).toBe("payload.creci");
    expect(CORRETOR_FIELD_MAP.status).toBe("status");
    expect(CORRETOR_FIELD_MAP.limite_leads).toBe("payload.limite");
    expect(ATRIBUICAO_FIELD_MAP.corretor_id).toBe("corretorId");
    expect(ATRIBUICAO_FIELD_MAP.imobiliaria_id).toBe("companyId");
  });

  it("normalizeCorretorForm requires nome and defaults status/limite", () => {
    expect(normalizeCorretorForm({})).toBeNull();
    expect(normalizeCorretorForm({ nome: "  " })).toBeNull();

    const ok = normalizeCorretorForm({
      nome: " Ana Silva ",
      email: "ana@x.com",
      telefone: "",
      creci: "123-F"
    });
    expect(ok).toEqual({
      title: "Ana Silva",
      status: "ativo",
      payload: {
        email: "ana@x.com",
        telefone: null,
        creci: "123-F",
        statusCorretor: "ativo",
        limite: 20
      }
    });
  });

  it("serializeCorretor exposes Lovable shape", () => {
    const s = serializeCorretor({
      id: 7,
      title: "Carlos",
      status: "ativo",
      payload: { email: "c@x.com", telefone: "1199", creci: "1-F", limite: 25 },
      createdAt: "2026-01-01T00:00:00.000Z"
    });
    expect(s).toMatchObject({
      id: "7",
      nome: "Carlos",
      email: "c@x.com",
      telefone: "1199",
      creci: "1-F",
      status: "ativo",
      limite_leads: 25
    });
  });

  it("buildDefaultPermissoes fills missing modules as ativo", () => {
    const perms = buildDefaultPermissoes([{ modulo: "crm", ativo: false }]);
    expect(perms).toHaveLength(12);
    expect(perms.find(p => p.modulo === "crm")?.ativo).toBe(false);
    expect(perms.find(p => p.modulo === "dashboard")?.ativo).toBe(true);
  });

  it("computes pontuação and taxa like Lovable", () => {
    expect(
      computePontuacao({
        leadsFechados: 2,
        contratos: 1,
        visitas: 4,
        reunioes: 3,
        leadsAtribuidos: 10
      })
    ).toBe(2 * 10 + 1 * 8 + 4 * 3 + 3 * 2 + 10 * 1);

    expect(computeTaxaConversao(0, 0)).toBe(0);
    expect(computeTaxaConversao(10, 2)).toBe(20);

    const fin = finalizeDesempenho({
      id: "1",
      nome: "A",
      leadsAtribuidos: 10,
      leadsFechados: 2,
      leadsNovos: 3,
      visitas: 1,
      reunioes: 0,
      contratos: 1,
      valorContratos: 1000,
      comissaoAcumulada: 50
    });
    expect(fin.taxaConversao).toBe(20);
    expect(fin.pontuacao).toBe(2 * 10 + 8 + 3 + 10);
  });

  it("classifies lead stages and captura closed stages", () => {
    expect(isLeadFechado("fechado")).toBe(true);
    expect(isLeadFechado("negociacao")).toBe(false);
    expect(isLeadNovo("novo")).toBe(true);
    expect(isLeadNovo("novos")).toBe(true);
    expect([...CAPTACAO_CLOSED_STAGES]).toEqual(["Perdido", "Contrato Assinado"]);
  });

  it("normalizeAtribuicaoForm validates corretor and defaults", () => {
    expect(normalizeAtribuicaoForm({})).toBeNull();
    expect(
      normalizeAtribuicaoForm({
        corretor_id: "5",
        cidade: " Brasília ",
        bairro: "",
        prioridade: "50",
        peso: "0",
        ativo: true
      })
    ).toEqual({
      corretorId: 5,
      cidade: "Brasília",
      bairro: null,
      prioridade: 50,
      peso: 1,
      ativo: true
    });
  });

  it("filters equipe search by nome/email/telefone", () => {
    const list = [
      { nome: "Ana", email: "a@x.com", telefone: "11" },
      { nome: "Bruno", email: "b@y.com", telefone: "22" }
    ];
    expect(filterCorretoresBySearch(list, "bru")).toHaveLength(1);
    expect(filterCorretoresBySearch(list, "a@x")).toHaveLength(1);
    expect(filterCorretoresBySearch(list, "22")).toHaveLength(1);
    expect(filterCorretoresBySearch(list, "")).toHaveLength(2);
  });
});

describe("corretores frontend page wiring", () => {
  it("dedicated page exposes Lovable tabs and form fields", () => {
    const page = readFront("pages/Corretores/index.js");
    expect(page).toContain('id: "desempenho"');
    expect(page).toContain('id: "equipe"');
    expect(page).toContain('id: "atribuicao"');
    expect(page).toContain("Nome completo");
    expect(page).toContain("email@exemplo.com");
    expect(page).toContain("(11) 99999-0000");
    expect(page).toContain("CRECI 00000-F");
    expect(page).toContain("Gerenciar Funções");
    expect(page).toContain("Novo Corretor");
  });

  it("atribuicao tab exposes Lovable rule inputs", () => {
    const tab = readFront("pages/Corretores/AtribuicaoTab.js");
    expect(tab).toContain("Selecione o corretor");
    expect(tab).toContain("Ex.: Brasília");
    expect(tab).toContain("Ex.: Águas Claras");
    expect(tab).toContain("Prioridade (menor = maior)");
    expect(tab).toContain("Regra ativa");
    expect(tab).toContain("Nova regra");
  });

  it("desempenho tab exposes period filters and ranking labels", () => {
    const tab = readFront("pages/Corretores/DesempenhoTab.js");
    const helper = readFront("helpers/corretoresParity.js");
    expect(tab).toContain("CORRETOR_PERIODOS");
    expect(helper).toContain("Últimos 7 dias");
    expect(helper).toContain("Últimos 30 dias");
    expect(helper).toContain("Últimos 90 dias");
    expect(helper).toContain("Último ano");
    expect(tab).toContain("Ranking de Desempenho");
    expect(tab).toContain("Progresso de Metas");
    expect(tab).toContain("Comparativo de Competências");
  });

  it("routes Corretores from dedicated page and API client methods exist", () => {
    const modules = readFront("pages/RealtyModules/index.js");
    expect(modules).toContain('export { default as Corretores } from "../Corretores"');
    expect(modules).not.toMatch(/export const Corretores = kindPage\(\s*"corretor"/);

    const svc = readFront("services/realtyService.js");
    expect(svc).toContain("/realty-corretores");
    expect(svc).toContain("/realty-corretores-desempenho");
    expect(svc).toContain("/realty-corretores-atribuicao");
    expect(svc).toContain("listCorretorPermissoes");
  });

  it("frontend helper mirrors Lovable module keys", () => {
    const helper = readFront("helpers/corretoresParity.js");
    for (const key of [
      "dashboard",
      "imoveis",
      "crm",
      "automacoes",
      "financeiro",
      "contratos",
      "relacionamento",
      "jornada",
      "followups",
      "seguranca",
      "configuracoes",
      "proprietarios"
    ]) {
      expect(helper).toContain(`key: "${key}"`);
    }
  });
});
