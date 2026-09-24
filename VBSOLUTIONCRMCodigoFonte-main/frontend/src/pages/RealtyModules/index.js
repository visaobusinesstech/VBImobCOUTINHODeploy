/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import RealtyCrudPage from "../../components/RealtyCrudPage";
import realtyIntelService from "../../services/realtyIntelService";
import realtyService from "../../services/realtyService";
import leadsSalesService from "../../services/leadsSalesService";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { estimateAvaliacao, formatBRL } from "../../helpers/realtyCrm";
import { KIND_FIELDS, kindCardMeta } from "../../helpers/realtyKindFields";

const kindPage = (kind, title, subtitle, options = {}) => {
  const fieldsExtra = options.fields || KIND_FIELDS[kind] || [];
  const skipMoney = options.skipMoney || ["consulta_cpf", "lgpd", "consentimento", "wa_consentimentos", "config_ia", "seguranca"].includes(kind);
  const Page = () => (
    <RealtyCrudPage
      title={title}
      subtitle={subtitle}
      listKey="items"
      packPayload
      loader={() => realtyIntelService.listModulos(kind)}
      creator={(payload) => realtyIntelService.createModulo({ ...payload, kind })}
      updater={realtyIntelService.updateModulo}
      remover={realtyIntelService.deleteModulo}
      emptyHint="Nenhum registro ainda. Clique em Novo para cadastrar."
      cardTitle={(item) => item.title}
      cardMeta={(item, display) => kindCardMeta(kind, item, display)}
      fields={[
        {
          name: "title",
          label:
            kind === "consulta_cpf"
              ? "Referência da consulta"
              : kind === "corretor"
                ? "Nome do corretor"
                : "Título",
          required: true,
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          defaultValue: "aberto",
          options: [
            { value: "aberto", label: "Aberto" },
            { value: "ativo", label: "Ativo" },
            { value: "novo", label: "Novo" },
            { value: "concluido", label: "Concluído" },
            { value: "pausado", label: "Pausado" },
            { value: "cancelado", label: "Cancelado" },
          ],
        },
        ...(skipMoney
          ? []
          : [
              { name: "value", label: "Valor (R$)", type: "number", cast: "number" },
              { name: "dueDate", label: "Data", type: "date" },
            ]),
        ...fieldsExtra,
        { name: "notes", label: "Observações", type: "textarea" },
      ]}
    />
  );
  Page.displayName = title;
  return Page;
};

export const Condominios = kindPage(
  "condominio",
  "CRM Condomínios",
  "Síndicos, unidades e relacionamento condominial."
);
export const Relacionamento = kindPage(
  "relacionamento",
  "Relacionamento",
  "Histórico de relacionamento com clientes e proprietários."
);
export const Inadimplencia = kindPage(
  "inadimplencia",
  "Inadimplência",
  "Cobranças e contratos em atraso."
);
export const Nutricao = () => (
  <RealtyCrudPage
    title="Nutrição de leads"
    subtitle="Cadências para leads frios — mensagens e retornos periódicos no WhatsApp (legado Radar/Coutinho)."
    listKey="items"
    loader={realtyService.listNutricao}
    creator={realtyService.createNutricao}
    updater={realtyService.updateNutricao}
    remover={realtyService.deleteNutricao}
    cardTitle={(item) => item.title}
    cardMeta={(item) => (
      <>
        <span className="realty-chip">{item.status || "ativo"}</span>
        <span>
          Lead #{item.leadSaleId || "—"} · a cada {item.cadenceDays || 7} dias · {item.channel || "whatsapp"}
        </span>
      </>
    )}
    fields={[
      { name: "title", label: "Título da cadência", required: true },
      { name: "leadSaleId", label: "ID do Lead", type: "number", cast: "number" },
      { name: "cadenceDays", label: "Intervalo (dias)", type: "number", cast: "number", defaultValue: 7 },
      { name: "nextSendAt", label: "Próximo envio", type: "datetime-local" },
      {
        name: "channel",
        label: "Canal",
        type: "select",
        defaultValue: "whatsapp",
        options: [
          { value: "whatsapp", label: "WhatsApp" },
          { value: "email", label: "E-mail" },
          { value: "sms", label: "SMS" },
        ],
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "ativo",
        options: [
          { value: "ativo", label: "Ativo" },
          { value: "pausado", label: "Pausado" },
          { value: "concluido", label: "Concluído" },
        ],
      },
      { name: "messageTemplate", label: "Mensagem / template", type: "textarea" },
      { name: "notes", label: "Observações", type: "textarea" },
    ]}
  />
);
export const ProspeccaoDiaria = () => (
  <RealtyCrudPage
    title="Prospecção diária"
    subtitle="Meta do dia do corretor — quem ligar/escrever e status de execução."
    listKey="items"
    loader={realtyService.listProspeccao}
    creator={realtyService.createProspeccao}
    updater={realtyService.updateProspeccao}
    remover={realtyService.deleteProspeccao}
    cardTitle={(item) => item.title}
    cardMeta={(item) => (
      <>
        <span className="realty-chip">{item.status || "pendente"}</span>
        <span>
          {item.prospectDate || "sem data"} · {item.doneCount || 0}/{item.targetCount || 1} · {item.phone || ""}
        </span>
      </>
    )}
    fields={[
      { name: "title", label: "Título / meta", required: true },
      { name: "prospectDate", label: "Data", type: "date" },
      { name: "userId", label: "Corretor (ID user)", type: "number", cast: "number" },
      { name: "leadSaleId", label: "ID do Lead", type: "number", cast: "number" },
      { name: "phone", label: "Telefone / WhatsApp" },
      { name: "targetCount", label: "Meta (qtd)", type: "number", cast: "number", defaultValue: 10 },
      { name: "doneCount", label: "Feitos", type: "number", cast: "number", defaultValue: 0 },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "pendente",
        options: [
          { value: "pendente", label: "Pendente" },
          { value: "em_andamento", label: "Em andamento" },
          { value: "concluido", label: "Concluído" },
        ],
      },
      { name: "ticketId", label: "Ticket WhatsApp", type: "number", cast: "number" },
      { name: "notes", label: "Observações", type: "textarea" },
    ]}
  />
);
export const RelatoriosAgendados = kindPage(
  "relatorio_agendado",
  "Relatórios agendados",
  "Envios periódicos de relatório comercial."
);
export const Monitoramento = kindPage(
  "monitoramento",
  "Monitoramento",
  "Alertas de mercado, portais e concorrência."
);
export const PipelineCaptacao = kindPage(
  "pipeline_captacao",
  "Pipeline de captação",
  "Funil de captação de imóveis (além do inventário)."
);
export const Feed = kindPage("feed", "Feed", "Publicações e conteúdo da operação.");
export const CuradoriaViral = kindPage(
  "curadoria",
  "Curadoria viral",
  "Peças e criativos para redes."
);
export const AutomacoesFollowup = () => {
  const run = async () => {
    try {
      const data = await realtyService.runAutomacaoFollowup();
      toast.success(`${data.count || 0} follow-ups gerados automaticamente`);
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <div>
      <div className="realty-page" style={{ padding: "12px 16px 0" }}>
        <button type="button" className="realty-page__btn" onClick={run}>
          Executar regras agora
        </button>
      </div>
      <RealtyCrudPage
        title="Automações de follow-up"
        subtitle="Regras: sem resposta, lead parado, pós-visita, pós-proposta."
        listKey="items"
        loader={realtyService.listAutomacaoFollowup}
        creator={realtyService.createAutomacaoFollowup}
        updater={realtyService.updateAutomacaoFollowup}
        remover={realtyService.deleteAutomacaoFollowup}
        cardTitle={(item) => item.title}
        cardMeta={(item) => (
          <>
            <span className="realty-chip">{item.active === false ? "off" : "on"}</span>
            <span>
              {item.trigger} · {item.daysWithoutContact || 3}d · {item.action || "criar_followup"}
            </span>
          </>
        )}
        fields={[
          { name: "title", label: "Nome da regra", required: true },
          {
            name: "trigger",
            label: "Gatilho",
            type: "select",
            defaultValue: "sem_resposta",
            options: [
              { value: "sem_resposta", label: "Sem resposta" },
              { value: "parado", label: "Lead parado" },
              { value: "pos_visita", label: "Pós-visita" },
              { value: "pos_proposta", label: "Pós-proposta" },
            ],
          },
          { name: "daysWithoutContact", label: "Dias sem contato", type: "number", cast: "number", defaultValue: 3 },
          { name: "fromStatus", label: "Status origem (opcional)" },
          { name: "toStatus", label: "Mover para status (opcional)" },
          {
            name: "action",
            label: "Ação",
            type: "select",
            defaultValue: "criar_followup",
            options: [
              { value: "criar_followup", label: "Criar follow-up" },
              { value: "enviar_mensagem", label: "Preparar mensagem" },
            ],
          },
          {
            name: "active",
            label: "Ativa",
            type: "select",
            defaultValue: "true",
            cast: "boolean",
            options: [
              { value: "true", label: "Sim" },
              { value: "false", label: "Não" },
            ],
          },
          { name: "messageTemplate", label: "Mensagem", type: "textarea" },
          { name: "notes", label: "Observações", type: "textarea" },
        ]}
      />
    </div>
  );
};
export const RadarZapGrupos = kindPage(
  "radarzap_grupo",
  "RadarZAP — grupos",
  "Cadastro de grupos WhatsApp monitorados."
);

export const Avaliacao = () => {
  const [imoveis, setImoveis] = useState([]);
  const [imovelId, setImovelId] = useState("");
  const [preco, setPreco] = useState("");
  const [area, setArea] = useState("");
  const [m2, setM2] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    realtyService.listImoveis({ pageSize: 100 }).then((d) => setImoveis(d.imoveis || [])).catch(toastError);
  }, []);

  const run = async (e) => {
    e.preventDefault();
    try {
      const data = await realtyIntelService.avaliar({
        imovelId: imovelId || undefined,
        preco: preco ? Number(preco) : undefined,
        area: area ? Number(area) : undefined,
        precoM2Mercado: m2 ? Number(m2) : undefined,
      });
      setResult(data);
    } catch (err) {
      const local = estimateAvaliacao(Number(preco), Number(area), Number(m2));
      setResult(local);
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <div className="realty-page">
        <h1 className="realty-page__title">Avaliação</h1>
        <p className="realty-page__subtitle">Compara o preço do imóvel com o m² de mercado.</p>
        <form className="realty-card" onSubmit={run} style={{ maxWidth: 520 }}>
          <label>
            Imóvel
            <select value={imovelId} onChange={(e) => setImovelId(e.target.value)}>
              <option value="">Manual</option>
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Preço
            <input value={preco} onChange={(e) => setPreco(e.target.value)} type="number" />
          </label>
          <label>
            Área m²
            <input value={area} onChange={(e) => setArea(e.target.value)} type="number" />
          </label>
          <label>
            m² mercado
            <input value={m2} onChange={(e) => setM2(e.target.value)} type="number" />
          </label>
          <button type="submit" className="realty-page__btn">
            Avaliar
          </button>
        </form>
        {result && (
          <div className="realty-card" style={{ marginTop: 16 }}>
            <p>m² do imóvel: {formatBRL(result.precoM2)}</p>
            <p>Valor justo: {formatBRL(result.valorJusto)}</p>
            <p>Desvio: {result.desvio}%</p>
            <span className="realty-chip">{result.parecer}</span>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export const ComparativoImoveis = () => {
  const [imoveis, setImoveis] = useState([]);
  const [leads, setLeads] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [leadId, setLeadId] = useState("");

  useEffect(() => {
    realtyService.listImoveis({ pageSize: 200 }).then((d) => setImoveis(d.imoveis || [])).catch(toastError);
    leadsSalesService.list({ pageSize: 200 }).then((d) => setLeads(d.leads || [])).catch(toastError);
  }, []);

  const ia = imoveis.find((i) => String(i.id) === String(a));
  const ib = imoveis.find((i) => String(i.id) === String(b));
  const ic = imoveis.find((i) => String(i.id) === String(c));
  const col = (im) =>
    im ? (
      <div className="realty-card">
        <h3>{im.title}</h3>
        <p>{im.type} · {im.city} · {im.neighborhood}</p>
        <p>{im.bedrooms} quartos · {im.areaM2} m² · {im.parkingSpots || 0} vagas</p>
        <strong>{formatBRL(im.price)}</strong>
      </div>
    ) : (
      <div className="realty-empty">Selecione um imóvel</div>
    );

  const enviar = async () => {
    const ids = [a, b, c].map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (!leadId || ids.length < 2) {
      toast.error("Selecione um lead e ao menos 2 imóveis");
      return;
    }
    try {
      const data = await realtyService.sendComparativoWhatsApp(Number(leadId), ids);
      toast.success(data.sent ? "Comparativo enviado no WhatsApp" : "Comparativo registrado (abra o ticket)");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <div className="realty-page">
        <h1 className="realty-page__title">Comparativo de imóveis</h1>
        <p className="realty-page__subtitle">Compare opções e envie o comparativo ao lead pelo WhatsApp.</p>
        <div className="realty-page__toolbar">
          <select className="realty-page__search" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Lead destinatário</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>#{l.id} · {l.name}</option>
            ))}
          </select>
          <select className="realty-page__search" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">Imóvel A</option>
            {imoveis.map((i) => (
              <option key={i.id} value={i.id}>{i.title}</option>
            ))}
          </select>
          <select className="realty-page__search" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">Imóvel B</option>
            {imoveis.map((i) => (
              <option key={i.id} value={i.id}>{i.title}</option>
            ))}
          </select>
          <select className="realty-page__search" value={c} onChange={(e) => setC(e.target.value)}>
            <option value="">Imóvel C (opcional)</option>
            {imoveis.map((i) => (
              <option key={`c-${i.id}`} value={i.id}>{i.title}</option>
            ))}
          </select>
          <button type="button" className="realty-page__btn" onClick={enviar}>
            Enviar no WhatsApp
          </button>
        </div>
        <div className="realty-page__grid">
          {col(ia)}
          {col(ib)}
          {c ? col(ic) : null}
        </div>
      </div>
    </MainContainer>
  );
};

export const JornadaCliente = () => {
  const [leads, setLeads] = useState([]);
  const [leadId, setLeadId] = useState("");
  const [timeline, setTimeline] = useState(null);

  useEffect(() => {
    leadsSalesService.list({ pageSize: 200 }).then((d) => setLeads(d.leads || [])).catch(toastError);
  }, []);

  const loadTimeline = async (id) => {
    setLeadId(id);
    if (!id) {
      setTimeline(null);
      return;
    }
    try {
      const data = await realtyService.leadTimeline(id);
      setTimeline(data);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <div className="realty-page">
        <h1 className="realty-page__title">Jornada do cliente</h1>
        <p className="realty-page__subtitle">
          Timeline unificada: follow-ups, visitas, propostas e imóveis enviados no WhatsApp.
        </p>
        <div className="realty-page__toolbar">
          <select
            className="realty-page__search"
            value={leadId}
            onChange={(e) => loadTimeline(e.target.value)}
          >
            <option value="">Selecione um lead</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                #{l.id} · {l.name} · {l.status}
              </option>
            ))}
          </select>
          {timeline?.lead?.ticketId ? (
            <Link className="realty-page__btn" to={`/tickets/${timeline.lead.ticketId}`}>
              Abrir WhatsApp
            </Link>
          ) : null}
        </div>
        {!timeline ? (
          <div className="realty-empty">Escolha um lead para ver a jornada completa.</div>
        ) : (
          <>
            <article className="realty-card">
              <h3>{timeline.lead.name}</h3>
              <p>
                {timeline.lead.status} · {timeline.lead.phone || "sem telefone"} · temp{" "}
                {timeline.lead.temperature || "—"}
              </p>
            </article>
            <h2>Follow-ups</h2>
            {(timeline.followups || []).map((f) => (
              <article key={`f-${f.id}`} className="realty-lead" style={{ marginTop: 8 }}>
                <strong>
                  {f.type} · {f.status}
                </strong>
                <span>{f.scheduledAt ? new Date(f.scheduledAt).toLocaleString("pt-BR") : ""}</span>
              </article>
            ))}
            <h2>Visitas</h2>
            {(timeline.visitas || []).map((v) => (
              <article key={`v-${v.id}`} className="realty-lead" style={{ marginTop: 8 }}>
                <strong>{v.status}</strong>
                <span>
                  {v.scheduledAt ? new Date(v.scheduledAt).toLocaleString("pt-BR") : ""}
                  {v.imovelId ? ` · imóvel #${v.imovelId}` : ""}
                </span>
              </article>
            ))}
            <h2>Propostas</h2>
            {(timeline.propostas || []).map((p) => (
              <article key={`p-${p.id}`} className="realty-lead" style={{ marginTop: 8 }}>
                <strong>
                  {p.title || `Proposta #${p.id}`} · {p.status}
                </strong>
                <span>{formatBRL(p.value)}</span>
              </article>
            ))}
            <h2>Imóveis enviados (WhatsApp)</h2>
            {(timeline.envios || []).map((e) => (
              <article key={`e-${e.id}`} className="realty-lead" style={{ marginTop: 8 }}>
                <strong>Imóvel #{e.imovelId}</strong>
                <span>{e.sentAt ? new Date(e.sentAt).toLocaleString("pt-BR") : ""}</span>
              </article>
            ))}
          </>
        )}
      </div>
    </MainContainer>
  );
};

export const Inteligencia = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    realtyIntelService.inteligencia().then(setData).catch(toastError);
  }, []);
  if (!data) return <MainContainer><div className="realty-page">Carregando…</div></MainContainer>;
  return (
    <MainContainer>
      <div className="realty-page">
        <h1 className="realty-page__title">Inteligência</h1>
        <div className="realty-page__grid">
          <article className="realty-card"><h3>Leads</h3><strong>{data.leads}</strong></article>
          <article className="realty-card"><h3>Imóveis</h3><strong>{data.imoveis}</strong></article>
          <article className="realty-card"><h3>Contratos</h3><strong>{data.contratos}</strong></article>
          <article className="realty-card"><h3>Mercado</h3><strong>{data.mercado}</strong></article>
        </div>
        <h2>Funil</h2>
        {Object.entries(data.funil || {}).map(([k, v]) => (
          <p key={k}>{k}: {v}</p>
        ))}
      </div>
    </MainContainer>
  );
};

export const Produtividade = () => {
  const [leads, setLeads] = useState([]);
  useEffect(() => {
    leadsSalesService.list({ pageSize: 300 }).then((d) => setLeads(d.leads || [])).catch(toastError);
  }, []);
  const byUser = {};
  leads.forEach((l) => {
    const k = l.responsibleId || "sem corretor";
    byUser[k] = (byUser[k] || 0) + 1;
  });
  return (
    <MainContainer>
      <div className="realty-page">
        <h1 className="realty-page__title">Produtividade</h1>
        <p className="realty-page__subtitle">Volume de leads por responsável.</p>
        {Object.entries(byUser).map(([k, v]) => (
          <article key={k} className="realty-card" style={{ marginBottom: 8 }}>
            <h3>Corretor {k}</h3>
            <strong>{v} leads</strong>
          </article>
        ))}
      </div>
    </MainContainer>
  );
};

export const FilaDistribuicao = () => {
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState("");

  const load = async () => {
    try {
      const [l, u, f] = await Promise.all([
        leadsSalesService.list({ pageSize: 200 }),
        api.get("/users", { params: { searchParam: "" } }),
        realtyService.getFilaConfig(),
      ]);
      setLeads((l.leads || []).filter((x) => !x.responsibleId));
      setUsers(u.data.users || u.data || []);
      setCfg(f);
      setSelectedUsers(Array.isArray(f.userIds) ? f.userIds.join(",") : "");
    } catch (err) {
      toastError(err);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const saveCfg = async () => {
    try {
      const userIds = selectedUsers
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const data = await realtyService.saveFilaConfig({
        strategy: "round_robin",
        userIds,
        active: true,
      });
      setCfg(data);
      toast.success("Fila configurada");
    } catch (err) {
      toastError(err);
    }
  };

  const assign = async (leadId, responsibleId) => {
    try {
      if (responsibleId) {
        await realtyService.assignFilaLead(leadId, Number(responsibleId));
      } else {
        await realtyService.assignFilaLead(leadId);
      }
      toast.success("Lead distribuído");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <div className="realty-page">
        <h1 className="realty-page__title">Fila de distribuição</h1>
        <p className="realty-page__subtitle">
          Round-robin entre corretores. IDs na fila (vírgula): deixe vazio para usar todos os usuários.
        </p>
        <div className="realty-page__toolbar">
          <input
            className="realty-page__search"
            placeholder="IDs dos corretores na fila (ex: 1,2,3)"
            value={selectedUsers}
            onChange={(e) => setSelectedUsers(e.target.value)}
          />
          <button type="button" className="realty-page__btn" onClick={saveCfg}>
            Salvar fila
          </button>
          <span className="realty-chip">último: {cfg?.lastUserId || "—"}</span>
        </div>
        {leads.length === 0 && <div className="realty-empty">Fila vazia.</div>}
        {leads.map((lead) => (
          <article key={lead.id} className="realty-lead" style={{ marginTop: 8 }}>
            <strong>{lead.name}</strong>
            <button type="button" className="realty-page__btn" onClick={() => assign(lead.id)}>
              Auto (round-robin)
            </button>
            <select defaultValue="" onChange={(e) => e.target.value && assign(lead.id, e.target.value)}>
              <option value="">Atribuir manual…</option>
              {(Array.isArray(users) ? users : []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </article>
        ))}
      </div>
    </MainContainer>
  );
};

export const AgendaImobiliaria = () => (
  <RealtyCrudPage
    title="Agenda imobiliária"
    subtitle="Visitas vinculadas a lead e imóvel — confirme, realize e registre o resultado."
    listKey="visitas"
    loader={realtyService.listVisitas}
    creator={realtyService.createVisita}
    updater={realtyService.updateVisita}
    remover={realtyService.deleteVisita}
    cardTitle={(item) => `Visita lead #${item.leadSaleId}`}
    cardMeta={(item) => (
      <>
        <span className="realty-chip">{item.status || "agendada"}</span>
        <span>
          {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("pt-BR") : "—"}
          {item.imovelId ? ` · Imóvel #${item.imovelId}` : ""}
        </span>
      </>
    )}
    fields={[
      { name: "leadSaleId", label: "ID do Lead", type: "number", cast: "number", required: true },
      { name: "imovelId", label: "ID do Imóvel", type: "number", cast: "number" },
      { name: "scheduledAt", label: "Data/hora", type: "datetime-local", required: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "agendada",
        options: [
          { value: "agendada", label: "Agendada" },
          { value: "confirmada", label: "Confirmada" },
          { value: "realizada", label: "Realizada" },
          { value: "cancelada", label: "Cancelada" },
          { value: "reagendada", label: "Reagendada" },
        ],
      },
      { name: "location", label: "Local" },
      {
        name: "result",
        label: "Reação do cliente",
        type: "select",
        defaultValue: "",
        options: [
          { value: "", label: "—" },
          { value: "gostou", label: "Gostou do imóvel" },
          { value: "mais_opcoes", label: "Pediu mais opções" },
          { value: "nao_gostou", label: "Não gostou" },
        ],
      },
      { name: "userId", label: "Corretor (ID user)", type: "number", cast: "number" },
      { name: "ticketId", label: "Ticket WhatsApp", type: "number", cast: "number" },
      { name: "notes", label: "Observações da visita", type: "textarea" },
    ]}
  />
);

export const Corretores = kindPage(
  "corretor",
  "Corretores",
  "Equipe comercial com CRECI, capacidade e especialidades (legado Radar/Coutinho). Usuários do sistema: /users."
);

export const Automacoes = kindPage(
  "automacao",
  "Automações",
  "Regras gerais de automação da operação imobiliária."
);
export const Seguranca = kindPage(
  "seguranca",
  "Segurança",
  "Políticas, acessos e incidentes de segurança."
);
export const AuditoriaExtracao = kindPage(
  "auditoria_extracao",
  "Auditoria de extração",
  "Logs da extração de anúncios e RadarZAP."
);
export const MetricasExtracao = kindPage(
  "metricas_extracao",
  "Métricas de extração",
  "Volume e qualidade das extrações."
);
export const AuditoriaRequests = kindPage(
  "auditoria_requests",
  "Auditoria de requests",
  "Requisições de API e webhooks."
);
export const AuditoriaMonitoramento = kindPage(
  "auditoria_monitoramento",
  "Auditoria de monitoramento",
  "Histórico de alertas de mercado."
);
export const AuditoriaLeads = kindPage(
  "auditoria_leads",
  "Auditoria de leads",
  "Trilha de alterações nos leads."
);
export const ConfigurarIA = kindPage(
  "config_ia",
  "Configuração da IA",
  "Parâmetros da IA imobiliária. Chaves globais ficam em Configurações / Brain.AI."
);
export const DiagnosticoAvaliacao = kindPage(
  "diagnostico_avaliacao",
  "Diagnóstico de avaliação",
  "Casos e conferência do motor de avaliação."
);
export const LeadsLanding = kindPage(
  "leads_landing",
  "CRM Landing",
  "Leads capturados em landing pages."
);
export const WebhookMetrics = kindPage(
  "webhook_metrics",
  "Métricas de webhook",
  "Sucesso/falha de webhooks de captação."
);
export const WebhookAlerts = kindPage(
  "webhook_alerts",
  "Alertas de webhook",
  "Alertas operacionais de integração."
);
export const WhatsappTemplatesCaptacao = kindPage(
  "wa_templates_captacao",
  "Templates WhatsApp captação",
  "Modelos de mensagem para captação (além das respostas rápidas)."
);
export const WhatsappConsentimentos = kindPage(
  "wa_consentimentos",
  "Consentimentos WhatsApp",
  "Opt-in / opt-out de disparos."
);
export const LgpdSolicitacoes = kindPage(
  "lgpd",
  "Solicitações LGPD",
  "Pedidos de titulares (acesso, exclusão, portabilidade)."
);
export const BuscaAvancadaCaptacao = kindPage(
  "busca_captacao",
  "Busca avançada de captação",
  "Filtros avançados da carteira de captação."
);
export const SeoAuditoria = kindPage(
  "seo_auditoria",
  "Auditoria SEO",
  "Checklist SEO dos imóveis e conteúdos."
);
export const CaptacaoAllowlist = kindPage(
  "captacao_allowlist",
  "Allowlist de captação",
  "Fontes e portais autorizados para scrape."
);
export const ConsultaCPF = kindPage(
  "consulta_cpf",
  "Consulta CPF",
  "Consultas cadastrais vinculadas a proprietários/leads."
);
export const RadarZapScoring = kindPage(
  "radarzap_scoring",
  "RadarZAP — scoring",
  "Regras de pontuação das mensagens de grupos."
);
export const RadarZapOnboarding = kindPage(
  "radarzap_onboarding",
  "RadarZAP — onboarding",
  "Passo a passo para conectar grupos."
);
export const RadarZapStatusPage = kindPage(
  "radarzap_status",
  "RadarZAP — status",
  "Saúde da coleta e fila de mensagens."
);
export const RadarZapAcessos = kindPage(
  "radarzap_acessos",
  "RadarZAP — logs de acesso",
  "Quem acessou extrações e leads do RadarZAP."
);
export const DiagnosticoCaptacao = kindPage(
  "diagnostico_captacao",
  "Diagnóstico de captação",
  "Diagnóstico da origem e qualidade da captação."
);
export const CaptacaoAvaliacaoLp = kindPage(
  "lp_captacao_avaliacao",
  "LP Captação / Avaliação",
  "Landing de captação com avaliação (conteúdo e leads)."
);
export const VendaCrmLp = kindPage(
  "lp_venda_crm",
  "LP Venda CRM",
  "Landing comercial do CRM imobiliário."
);
export const PortalImoveisPublico = kindPage(
  "portal_imoveis",
  "Portal de imóveis",
  "Vitrine pública (anúncios publicados a partir do inventário)."
);
export const BlogImobiliario = kindPage(
  "blog",
  "Blog",
  "Posts do blog imobiliário (além do Conteúdo SEO)."
);
export const AnunciarImovel = kindPage(
  "anunciar_imovel",
  "Anunciar imóvel",
  "Hub de anúncio em portais e redes."
);
export const LgpdPortalTitular = kindPage(
  "lgpd_portal",
  "Portal do titular (LGPD)",
  "Atendimento a solicitações do titular."
);
export const Consentimentos = kindPage(
  "consentimento",
  "Consentimentos",
  "Tokens e confirmações de consentimento."
);
export const PagamentosPublicos = kindPage(
  "pagamento_publico",
  "Pagamento público",
  "Links de pagamento enviados a clientes."
);
export const RadarOportunidades = kindPage(
  "radar_oportunidades",
  "Radar de oportunidades",
  "Oportunidades de mercado (Q-Capture + Inteligência)."
);
export const ConfiguracoesImobiliaria = kindPage(
  "config_imobiliaria",
  "Configurações da imobiliária",
  "Marca, cidade padrão e módulos. Configurações gerais do sistema: /settings."
);
export const WhatsappImobiliario = () => (
  <MainContainer>
    <div className="realty-page">
      <h1 className="realty-page__title">WhatsApp imobiliário</h1>
      <p className="realty-page__subtitle">
        Hub do atendimento integrado ao funil: ticket do lead, match de imóveis, follow-ups e captação RadarZAP.
      </p>
      <div className="realty-page__grid">
        <article className="realty-card">
          <h3>Atendimento</h3>
          <p>Inbox canônico do WhatsApp. No drawer do contato, use o painel CRM (match + follow-up).</p>
          <Link className="realty-page__btn" to="/tickets">
            Abrir tickets
          </Link>
        </article>
        <article className="realty-card">
          <h3>Pipeline + match</h3>
          <p>Envie imóveis compatíveis pelo botão “Enviar opções no WhatsApp”.</p>
          <Link className="realty-page__btn" to="/pipeline">
            Abrir pipeline
          </Link>
        </article>
        <article className="realty-card">
          <h3>Follow-up estratégico</h3>
          <p>Fila de retornos (ligação, WA, visita) vinculada ao lead e ao ticket.</p>
          <Link className="realty-page__btn" to="/followups">
            Abrir follow-ups
          </Link>
        </article>
        <article className="realty-card">
          <h3>RadarZAP</h3>
          <p>Captação de grupos WhatsApp → lead.</p>
          <Link className="realty-page__btn" to="/radarzap">
            Abrir RadarZAP
          </Link>
        </article>
        <article className="realty-card">
          <h3>Conexões</h3>
          <p>Sessões WhatsApp da empresa.</p>
          <Link className="realty-page__btn" to="/connections">
            Abrir conexões
          </Link>
        </article>
      </div>
    </div>
  </MainContainer>
);

export const RealtyDashboard = () => {
  const emptyKpis = {
    totalLeads: 0,
    leadsMes: 0,
    leadsWon: 0,
    leadsQuentes: 0,
    leadsParados: 0,
    leadsSemCorretor: 0,
    conversao: 0,
    imoveis: 0,
    imoveisCaptacao: 0,
    imoveisDisponiveis: 0,
    contratos: 0,
    followupsPendentes: 0,
    followupsAtrasados: 0,
    visitasHoje: 0,
    propostasAbertas: 0,
    ticketsAbertos: 0,
    corretores: 0,
  };
  const [data, setData] = useState({ kpis: emptyKpis, funil: {}, recentLeads: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await realtyIntelService.dashboard();
      setData({
        kpis: { ...emptyKpis, ...(d.kpis || {}) },
        funil: d.funil || {},
        recentLeads: d.recentLeads || [],
      });
    } catch (_) {
      try {
        const intel = await realtyIntelService.inteligencia();
        setData({
          kpis: {
            ...emptyKpis,
            totalLeads: intel.leads || 0,
            imoveis: intel.imoveis || 0,
            contratos: intel.contratos || 0,
          },
          funil: intel.funil || {},
          recentLeads: [],
        });
      } catch (__) {
        setData({ kpis: emptyKpis, funil: {}, recentLeads: [] });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await realtyIntelService.seedDemo();
      } catch (_) {
        /* seed opcional — sem alerta */
      }
      await load();
    })();
  }, []);

  const seed = async () => {
    try {
      const r = await realtyIntelService.seedDemo();
      toast.success(r.message || `${r.created} registros criados`);
      await load();
    } catch (_) {
      toast.success("Sincronizado com o banco (sem novos registros)");
      await load();
    }
  };

  const k = data?.kpis || emptyKpis;
  const cards = [
    { label: "Leads totais", value: k.totalLeads ?? 0, to: "/leads-sales" },
    { label: "Leads no mês", value: k.leadsMes ?? 0, to: "/leads-sales" },
    { label: "Leads quentes", value: k.leadsQuentes ?? 0, to: "/pipeline" },
    { label: "Parados 3+ dias", value: k.leadsParados ?? 0, to: "/followups" },
    { label: "Conversão %", value: k.conversao ?? 0, to: "/pipeline" },
    { label: "Follow-ups pendentes", value: k.followupsPendentes ?? 0, to: "/followups" },
    { label: "Follow-ups atrasados", value: k.followupsAtrasados ?? 0, to: "/followups" },
    { label: "Visitas hoje", value: k.visitasHoje ?? 0, to: "/agenda" },
    { label: "Propostas abertas", value: k.propostasAbertas ?? 0, to: "/propostas" },
    { label: "Imóveis / disponíveis", value: `${k.imoveisDisponiveis ?? 0}/${k.imoveis ?? 0}`, to: "/imoveis" },
    { label: "Em captação", value: k.imoveisCaptacao ?? 0, to: "/captacao" },
    { label: "Tickets WA abertos", value: k.ticketsAbertos ?? 0, to: "/tickets" },
    { label: "Sem corretor", value: k.leadsSemCorretor ?? 0, to: "/fila-distribuicao" },
    { label: "Contratos", value: k.contratos ?? 0, to: "/contratos" },
    { label: "Corretores (users)", value: k.corretores ?? 0, to: "/corretores" },
  ];

  const funilEntries = Object.entries(data?.funil || {});

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Dashboard imobiliário</h1>
            <p className="realty-page__subtitle">
              Indicadores estratégicos (Radar + Coutinho) · Início WhatsApp em <Link to="/">Início</Link>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
            <button type="button" className="realty-page__btn" onClick={seed}>
              Carregar dados estratégicos
            </button>
          </div>
        </div>
        <div className="realty-page__grid">
          {cards.map((c) => (
            <Link key={c.label} to={c.to} className="realty-card" style={{ textDecoration: "none", color: "inherit" }}>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{c.label}</p>
              <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{c.value}</h2>
            </Link>
          ))}
        </div>
        {funilEntries.length > 0 && (
          <div className="realty-card" style={{ marginTop: 16 }}>
            <h3>Funil por status</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {funilEntries.map(([status, count]) => (
                <span key={status} className="realty-chip">
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
        {(data?.recentLeads || []).length > 0 && (
          <div className="realty-card" style={{ marginTop: 16 }}>
            <h3>Leads recentes</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {data.recentLeads.map((l) => (
                <li key={l.id}>
                  #{l.id} {l.name} · {l.status}
                  {l.temperature ? ` · ${l.temperature}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </MainContainer>
  );
};
