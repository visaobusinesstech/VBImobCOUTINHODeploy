/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ListOrdered,
  Play,
  User,
  Loader2,
  CheckCircle2,
  Users,
} from "lucide-react";
import MainContainer from "../../components/MainContainer";
import RealtyCrudPage from "../../components/RealtyCrudPage";
import realtyIntelService from "../../services/realtyIntelService";
import realtyService from "../../services/realtyService";
import leadsSalesService from "../../services/leadsSalesService";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { formatBRL } from "../../helpers/realtyCrm";
import { KIND_FIELDS, kindCardMeta } from "../../helpers/realtyKindFields";

const kindPage = (kind, title, subtitle, options = {}) => {
  const fieldsExtra = options.fields || KIND_FIELDS[kind] || [];
  const skipMoney =
    options.skipMoney ||
    ["consulta_cpf", "lgpd", "consentimento", "wa_consentimentos", "config_ia", "seguranca"].includes(kind);
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
      headerActions={options.headerActions || null}
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

const radarZapBackLink = (
  <Link className="realty-page__btn realty-page__btn--ghost" to="/radarzap">
    ← RadarZAP
  </Link>
);

export { default as Condominios } from "../CrmCondominios";
// Relacionamento — página dedicada (paridade Lovable clientes_relacionamento)
export { default as Relacionamento } from "../Relacionamento";
// Inadimplência — relatório Lovable (KPIs, gravidade, tabela, gráficos, PDF, alertas)
export { default as Inadimplencia } from "../Inadimplencia";
// Nutrição completa (Radar) — página dedicada com WhatsApp nativo
export { default as Nutricao } from "../NutricaoLeads";
// Prospecção Diária — paridade Lovable (totais do dia + histórico + rendimento)
export { default as ProspeccaoDiaria } from "../ProspeccaoDiaria";
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
export const Feed = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsData, followupsData, visitasData, imoveisData, postsData] = await Promise.all([
        leadsSalesService.list({ pageSize: 50 }).catch(() => ({ leads: [] })),
        realtyService.listFollowups({ pageSize: 50 }).catch(() => ({ followups: [] })),
        realtyService.listVisitas({ pageSize: 50 }).catch(() => ({ visitas: [] })),
        realtyService.listImoveis({ pageSize: 30, status: "captacao" }).catch(() => ({ imoveis: [] })),
        realtyIntelService.listModulos("feed").catch(() => ({ items: [] })),
      ]);

      const feed = [];
      (leadsData.leads || []).forEach((l) => {
        feed.push({
          id: `lead-${l.id}`,
          kind: "lead",
          title: l.name || `Lead #${l.id}`,
          subtitle: `${l.status || "novo"}${l.temperature ? ` · ${l.temperature}` : ""}`,
          at: l.updatedAt || l.createdAt,
          href: "/leads-sales",
        });
      });
      (followupsData.followups || []).forEach((f) => {
        feed.push({
          id: `fu-${f.id}`,
          kind: "followup",
          title: `Follow-up · ${f.type || "contato"}`,
          subtitle: `Lead #${f.leadSaleId} · ${f.status || "pendente"}`,
          at: f.scheduledAt || f.updatedAt || f.createdAt,
          href: "/followups",
        });
      });
      (visitasData.visitas || []).forEach((v) => {
        feed.push({
          id: `vi-${v.id}`,
          kind: "visita",
          title: `Visita · Lead #${v.leadSaleId}`,
          subtitle: `${v.status || "agendada"}${v.imovelId ? ` · imóvel #${v.imovelId}` : ""}`,
          at: v.scheduledAt || v.updatedAt || v.createdAt,
          href: "/agenda",
        });
      });
      (imoveisData.imoveis || []).forEach((i) => {
        feed.push({
          id: `cap-${i.id}`,
          kind: "captacao",
          title: i.title || `Imóvel #${i.id}`,
          subtitle: `${i.city || "—"} · ${formatBRL(i.price)}`,
          at: i.updatedAt || i.createdAt,
          href: "/captacao",
        });
      });
      (postsData.items || []).forEach((p) => {
        feed.push({
          id: `post-${p.id}`,
          kind: "post",
          title: p.title || "Publicação",
          subtitle: (p.payload && p.payload.canal) || p.status || "feed",
          at: p.dueDate || p.updatedAt || p.createdAt,
          href: "/feed",
        });
      });

      feed.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
      setItems(feed);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((it) => {
      if (filtro !== "todos" && it.kind !== filtro) return false;
      if (!q) return true;
      return (
        String(it.title || "")
          .toLowerCase()
          .includes(q) ||
        String(it.subtitle || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, filtro, busca]);

  const kindLabel = {
    lead: "Lead",
    followup: "Follow-up",
    visita: "Visita",
    captacao: "Captação",
    post: "Post",
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Feed da operação</h1>
            <p className="realty-page__subtitle">
              Atividades recentes: leads, follow-ups, visitas, captações e publicações.
            </p>
          </div>
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
        <div className="realty-page__toolbar realty-pipeline-toolbar">
          <input
            className="realty-page__search"
            placeholder="Buscar no feed…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="realty-tabs">
          {["todos", "lead", "followup", "visita", "captacao", "post"].map((k) => (
            <button
              key={k}
              type="button"
              className={`realty-tab${filtro === k ? " realty-tab--active" : ""}`}
              onClick={() => setFiltro(k)}
            >
              {k === "todos" ? "Todos" : kindLabel[k]}
            </button>
          ))}
        </div>
        {loading && <div className="realty-empty">Carregando feed…</div>}
        {!loading && filtered.length === 0 && (
          <div className="realty-empty">Nenhuma atividade recente neste filtro.</div>
        )}
        {filtered.map((it) => (
          <article key={it.id} className="realty-lead" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <span className="realty-chip">{kindLabel[it.kind] || it.kind}</span>
                <strong style={{ display: "inline", marginLeft: 4 }}>{it.title}</strong>
                <span style={{ display: "block", marginTop: 4 }}>{it.subtitle}</span>
                <span style={{ display: "block", marginTop: 4, fontSize: 11 }}>
                  {it.at ? new Date(it.at).toLocaleString("pt-BR") : "—"}
                </span>
              </div>
              {it.href ? (
                <Link className="realty-page__btn realty-page__btn--ghost" to={it.href}>
                  Abrir
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </MainContainer>
  );
};
export const CuradoriaViral = kindPage(
  "curadoria",
  "Curadoria viral",
  "Peças e criativos para redes."
);
export const AutomacoesFollowup = () => {
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      const data = await realtyService.runAutomacaoFollowup();
      toast.success(`${data.count || 0} follow-ups gerados automaticamente`);
    } catch (err) {
      toastError(err);
    } finally {
      setRunning(false);
    }
  };
  return (
    <RealtyCrudPage
      title="Automações de follow-up"
      subtitle="Regras: sem resposta, lead parado, pós-visita, pós-proposta. Execute agora para processar a fila."
      listKey="items"
      loader={realtyService.listAutomacaoFollowup}
      creator={realtyService.createAutomacaoFollowup}
      updater={realtyService.updateAutomacaoFollowup}
      remover={realtyService.deleteAutomacaoFollowup}
      headerActions={
        <button type="button" className="realty-page__btn" onClick={run} disabled={running}>
          {running ? "Executando…" : "Executar regras agora"}
        </button>
      }
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
        {
          name: "daysWithoutContact",
          label: "Dias sem contato",
          type: "number",
          cast: "number",
          defaultValue: 3,
        },
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
  );
};
export const RadarZapGrupos = kindPage(
  "radarzap_grupo",
  "RadarZAP — grupos",
  "Cadastro de grupos WhatsApp monitorados.",
  { headerActions: radarZapBackLink }
);

export { default as Avaliacao } from "../Avaliacao";

export { default as ComparativoImoveis } from "../Comparativo";

export const JornadaCliente = () => {
  const [leads, setLeads] = useState([]);
  const [leadId, setLeadId] = useState("");
  const [busca, setBusca] = useState("");
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    leadsSalesService
      .list({ pageSize: 300 })
      .then((d) => setLeads(d.leads || []))
      .catch(toastError);
  }, []);

  const leadsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        String(l.name || "")
          .toLowerCase()
          .includes(q) ||
        String(l.phone || "").includes(q) ||
        String(l.id).includes(q)
    );
  }, [leads, busca]);

  const loadTimeline = async (id) => {
    setLeadId(id);
    if (!id) {
      setTimeline(null);
      return;
    }
    setLoading(true);
    try {
      const data = await realtyService.leadTimeline(id);
      setTimeline(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const events = useMemo(() => {
    if (!timeline) return [];
    const list = [];
    (timeline.followups || []).forEach((f) => {
      list.push({
        id: `f-${f.id}`,
        kind: "followup",
        label: `Follow-up · ${f.type || "contato"} · ${f.status}`,
        detail: f.result || f.notes || "",
        at: f.scheduledAt || f.completedAt || f.createdAt,
      });
    });
    (timeline.visitas || []).forEach((v) => {
      list.push({
        id: `v-${v.id}`,
        kind: "visita",
        label: `Visita · ${v.status}${v.imovelId ? ` · imóvel #${v.imovelId}` : ""}`,
        detail: v.result || v.location || v.notes || "",
        at: v.scheduledAt || v.createdAt,
      });
    });
    (timeline.propostas || []).forEach((p) => {
      list.push({
        id: `p-${p.id}`,
        kind: "proposta",
        label: `${p.title || `Proposta #${p.id}`} · ${p.status}`,
        detail: formatBRL(p.value),
        at: p.validUntil || p.updatedAt || p.createdAt,
      });
    });
    (timeline.envios || []).forEach((e) => {
      list.push({
        id: `e-${e.id}`,
        kind: "envio",
        label: `Imóvel #${e.imovelId} enviado no WhatsApp`,
        detail: "",
        at: e.sentAt || e.createdAt,
      });
    });
    (timeline.nutricao || []).forEach((n) => {
      list.push({
        id: `n-${n.id}`,
        kind: "nutricao",
        label: `Nutrição · ${n.title || "cadência"} · ${n.status || ""}`,
        detail: n.channel
          ? `${n.channel}${n.nextSendAt ? ` · próximo ${new Date(n.nextSendAt).toLocaleString("pt-BR")}` : ""}`
          : n.notes || "",
        at: n.nextSendAt || n.updatedAt || n.createdAt,
      });
    });
    list.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    return list;
  }, [timeline]);

  const kindChip = {
    followup: "Follow-up",
    visita: "Visita",
    proposta: "Proposta",
    envio: "WhatsApp",
    nutricao: "Nutrição",
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Jornada do cliente</h1>
            <p className="realty-page__subtitle">
              Timeline unificada: follow-ups, visitas, propostas, nutrição e imóveis enviados no WhatsApp.
            </p>
          </div>
        </div>
        <div className="realty-page__toolbar realty-pipeline-toolbar">
          <input
            className="realty-page__search"
            placeholder="Buscar lead por nome, telefone ou ID…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select
            className="realty-page__search realty-page__select"
            value={leadId}
            onChange={(e) => loadTimeline(e.target.value)}
          >
            <option value="">Selecione um lead</option>
            {leadsFiltrados.map((l) => (
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
        {!timeline && !loading && (
          <div className="realty-empty">Escolha um lead para ver a jornada completa.</div>
        )}
        {loading && <div className="realty-empty">Carregando jornada…</div>}
        {timeline && !loading && (
          <>
            <article className="realty-card" style={{ marginBottom: 16 }}>
              <h3>{timeline.lead.name}</h3>
              <p>
                <span className="realty-chip">{timeline.lead.status}</span>
                {timeline.lead.phone || "sem telefone"} · temp {timeline.lead.temperature || "—"}
              </p>
              <p style={{ marginTop: 8 }}>
                {events.length} evento(s) na timeline ·{" "}
                <Link to="/followups">Follow-ups</Link> · <Link to="/agenda">Agenda</Link> ·{" "}
                <Link to="/propostas">Propostas</Link>
              </p>
            </article>
            {events.length === 0 && (
              <div className="realty-empty">Ainda não há eventos registrados para este lead.</div>
            )}
            {events.map((ev) => (
              <article key={ev.id} className="realty-lead" style={{ marginBottom: 8 }}>
                <span className="realty-chip">{kindChip[ev.kind] || ev.kind}</span>
                <strong style={{ display: "inline", marginLeft: 4 }}>{ev.label}</strong>
                {ev.detail ? <span style={{ display: "block", marginTop: 4 }}>{ev.detail}</span> : null}
                <span style={{ display: "block", marginTop: 4, fontSize: 11 }}>
                  {ev.at ? new Date(ev.at).toLocaleString("pt-BR") : "—"}
                </span>
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
  const [status, setStatus] = useState("pending");
  const [fila, setFila] = useState([]);
  const [caps, setCaps] = useState([]);
  const [totals, setTotals] = useState({ pend: 0, atrib: 0, capTotal: 0, capUsada: 0 });
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);

  const load = useCallback(async (statusFilter = status) => {
    setLoading(true);
    try {
      const data = await realtyService.getFilaOverview(statusFilter);
      setFila(data.fila || []);
      setCaps(data.caps || []);
      setTotals(
        data.totals || {
          pend: 0,
          atrib: 0,
          capTotal: 0,
          capUsada: 0,
        }
      );
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load(status);
  }, [load, status]);

  const fmtDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };

  const distribuir = async () => {
    setDistributing(true);
    try {
      const d = await realtyService.distribuirFila();
      const r = d?.relatorio?.[0]?.resultado;
      if (r) {
        toast.success(
          `${r.atribuidos} atribuído(s), ${r.restantes} na fila${
            r.sem_corretor_elegivel ? " — sem capacidade livre." : "."
          }`
        );
      } else {
        toast.success("Distribuição concluída");
      }
      await load(status);
    } catch (err) {
      toastError(err);
    } finally {
      setDistributing(false);
    }
  };

  const setLimite = async (corretorId, limite) => {
    try {
      await realtyService.setLimiteCorretorFila(corretorId, limite);
      toast.success("Limite atualizado");
      await load(status);
    } catch (err) {
      toastError(err);
    }
  };

  const encerrar = async (id) => {
    try {
      await realtyService.encerrarLeadFila(id);
      toast.success("Lead encerrado — capacidade liberada");
      await load(status);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page realty-fila">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title realty-fila__title">
              <ListOrdered size={24} className="realty-fila__title-icon" />
              Fila de Distribuição Global
            </h1>
            <p className="realty-page__subtitle">
              Leads da IA priorizados por <strong>ai_score</strong> (FIFO em empate) e distribuídos em
              round-robin entre corretores com capacidade livre.
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button
              type="button"
              className="realty-page__btn"
              onClick={distribuir}
              disabled={distributing}
            >
              {distributing ? <Loader2 size={16} className="realty-fila__spin" /> : <Play size={16} />}
              Distribuir agora
            </button>
          </div>
        </div>

        <div className="realty-metrics realty-fila__kpis">
          <article className="realty-metric-card">
            <div>
              <p className="realty-metric-card__title">Pendentes</p>
              <p className="realty-metric-card__value realty-fila__kpi-primary">{totals.pend}</p>
            </div>
          </article>
          <article className="realty-metric-card">
            <div>
              <p className="realty-metric-card__title">Ativos atribuídos</p>
              <p className="realty-metric-card__value">{totals.atrib}</p>
            </div>
          </article>
          <article className="realty-metric-card">
            <div>
              <p className="realty-metric-card__title">Capacidade da equipe</p>
              <p className="realty-metric-card__value">
                {totals.capUsada}/{totals.capTotal}
              </p>
            </div>
          </article>
          <article className="realty-metric-card">
            <div>
              <p className="realty-metric-card__title">Corretores ativos</p>
              <p className="realty-metric-card__value">
                {caps.filter((c) => c.status === "ativo").length}
              </p>
            </div>
          </article>
        </div>

        <article className="realty-list-card" style={{ marginBottom: 16 }}>
          <div className="realty-fila__card-head">
            <h3 className="realty-fila__card-title">
              <Users size={16} /> Capacidade dos corretores
            </h3>
          </div>
          {caps.length === 0 ? (
            <p className="realty-fila__muted">Nenhum corretor cadastrado.</p>
          ) : (
            <div className="realty-fila__table-wrap">
              <table className="realty-fila__table">
                <thead>
                  <tr>
                    <th>Corretor</th>
                    <th>Status</th>
                    <th>Ativos</th>
                    <th>Limite</th>
                    <th>Livre</th>
                  </tr>
                </thead>
                <tbody>
                  {caps.map((c) => (
                    <tr key={c.corretor_id}>
                      <td className="realty-fila__cell-strong">{c.nome}</td>
                      <td>
                        <span
                          className={`realty-chip ${
                            c.status === "ativo" ? "realty-fila__badge-ativo" : ""
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td>{c.ativos}</td>
                      <td>
                        <input
                          type="number"
                          className="realty-fila__limite-input"
                          defaultValue={c.limite}
                          min={0}
                          key={`${c.corretor_id}-${c.limite}`}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v) && v !== c.limite) {
                              setLimite(c.corretor_id, v);
                            }
                          }}
                        />
                      </td>
                      <td>
                        <span
                          className={
                            c.capacidade_livre === 0
                              ? "realty-fila__cap-zero"
                              : "realty-fila__cap-ok"
                          }
                        >
                          {c.capacidade_livre}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="realty-list-card">
          <div className="realty-fila__card-head realty-fila__card-head--row">
            <h3 className="realty-fila__card-title">Fila</h3>
            <div className="realty-tabs" style={{ marginBottom: 0 }}>
              {[
                { value: "pending", label: "Pendentes" },
                { value: "assigned", label: "Atribuídos" },
                { value: "all", label: "Todos" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`realty-tab ${status === t.value ? "realty-tab--active" : ""}`}
                  onClick={() => setStatus(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="realty-fila__empty">
              <Loader2 size={20} className="realty-fila__spin" />
            </div>
          ) : fila.length === 0 ? (
            <div className="realty-fila__empty">Nenhum lead nesse status.</div>
          ) : (
            <div className="realty-fila__table-wrap">
              <table className="realty-fila__table">
                <thead>
                  <tr>
                    <th style={{ width: 64 }}>Score</th>
                    <th>Lead</th>
                    <th>Origem</th>
                    <th>Entrada</th>
                    <th>Status</th>
                    <th>Corretor</th>
                    <th style={{ textAlign: "right" }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {fila.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className="realty-fila__score">{Number(f.ai_score).toFixed(0)}</span>
                      </td>
                      <td>
                        <div className="realty-fila__lead-name">{f.payload?.nome ?? "—"}</div>
                        <div className="realty-fila__muted">
                          {f.payload?.bairro ?? "—"} · {f.payload?.cidade ?? "—"} ·{" "}
                          {f.payload?.operacao ?? "—"}
                        </div>
                      </td>
                      <td>
                        <span className="realty-chip">{f.source}</span>
                      </td>
                      <td className="realty-fila__muted">{fmtDate(f.created_at)}</td>
                      <td>
                        <span
                          className={`realty-chip ${
                            f.status === "assigned" ? "realty-fila__badge-ativo" : ""
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td>
                        {f.corretor?.nome ? (
                          <span className="realty-fila__corretor">
                            <User size={12} /> {f.corretor.nome}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {f.status === "assigned" && (
                          <button
                            type="button"
                            className="realty-page__btn realty-page__btn--ghost realty-fila__btn-sm"
                            onClick={() => encerrar(f.leadId || f.id)}
                          >
                            <CheckCircle2 size={14} /> Encerrar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
    </MainContainer>
  );
};

/** Agenda imobiliária — implementação completa em pages/AgendaImobiliaria (paridade Lovable). */
export { AgendaImobiliaria } from "../AgendaImobiliaria";

/** Corretores — Desempenho / Equipe / Atribuição (paridade Lovable). */
export { default as Corretores } from "../Corretores";

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
/** Página dedicada — paridade Lovable ConsultaCPFWidget */
export { default as ConsultaCPF } from "../ConsultaCPF";
export const RadarZapScoring = kindPage(
  "radarzap_scoring",
  "RadarZAP — scoring",
  "Regras de pontuação das mensagens de grupos. Configure palavras-chave e categorias.",
  { headerActions: radarZapBackLink, skipMoney: true }
);
export const RadarZapOnboarding = kindPage(
  "radarzap_onboarding",
  "RadarZAP — onboarding",
  "Checklist: conectar WhatsApp → grupos → scoring → converter leads ao funil.",
  { headerActions: radarZapBackLink, skipMoney: true }
);
export const RadarZapStatusPage = kindPage(
  "radarzap_status",
  "RadarZAP — status",
  "Saúde da coleta, fila de mensagens e última sincronização.",
  { headerActions: radarZapBackLink, skipMoney: true }
);
export const RadarZapAcessos = kindPage(
  "radarzap_acessos",
  "RadarZAP — logs de acesso",
  "Quem acessou extrações e leads do RadarZAP.",
  { headerActions: radarZapBackLink, skipMoney: true }
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

export const WhatsappImobiliario = () => (
  <MainContainer>
    <div className="realty-page">
      <h1 className="realty-page__title">WhatsApp imobiliário</h1>
      <p className="realty-page__subtitle">
        Hub do atendimento integrado ao funil: tickets, nutrição, pipeline, campanhas e captação RadarZAP.
      </p>
      <div className="realty-page__grid">
        <article className="realty-card">
          <h3>Tickets</h3>
          <p>Inbox canônico do WhatsApp. No drawer do contato, use o painel CRM (match + follow-up).</p>
          <Link className="realty-page__btn" to="/tickets">
            Abrir tickets
          </Link>
        </article>
        <article className="realty-card">
          <h3>Nutrição</h3>
          <p>Cadências e conteúdo para aquecer leads pelo WhatsApp.</p>
          <Link className="realty-page__btn" to="/nutricao">
            Abrir nutrição
          </Link>
        </article>
        <article className="realty-card">
          <h3>Pipeline + match</h3>
          <p>Envie imóveis compatíveis pelo botão “Enviar opções no WhatsApp”.</p>
          <Link className="realty-page__btn" to="/leads-sales">
            Abrir Leads e Vendas
          </Link>
        </article>
        <article className="realty-card">
          <h3>Campanhas</h3>
          <p>Disparos e templates de campanha alinhados ao funil imobiliário.</p>
          <Link className="realty-page__btn" to="/campaigns">
            Abrir campanhas
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
          <h3>Follow-up</h3>
          <p>Fila de retornos (ligação, WA, visita) vinculada ao lead e ao ticket.</p>
          <Link className="realty-page__btn" to="/followups">
            Abrir follow-ups
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

