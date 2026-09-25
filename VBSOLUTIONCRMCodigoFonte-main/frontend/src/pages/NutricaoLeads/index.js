/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Nutrição de Leads — UI alinhada ao Radarimobtech, envio via WhatsApp nativo do VBSolution
 * (ticket + SendWhatsAppMessage) e reaproveitamento de campanhas/cadências.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import leadsSalesService from "../../services/leadsSalesService";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const TEMPLATES = [
  {
    id: "boas_vindas",
    titulo: "Boas-vindas",
    canal: "whatsapp",
    mensagem:
      "Olá {{nome}}! Sou da equipe imobiliária. Vi seu interesse em {{interesse}} e quero te ajudar a encontrar a melhor opção. Podemos conversar?",
  },
  {
    id: "followup_3d",
    titulo: "Follow-up 3 dias",
    canal: "whatsapp",
    mensagem:
      "Oi {{nome}}, passando para saber se ainda está buscando imóvel{{bairro}}. Tenho novidades alinhadas ao seu perfil — posso te enviar?",
  },
  {
    id: "reengajamento",
    titulo: "Reengajamento",
    canal: "whatsapp",
    mensagem:
      "{{nome}}, sentimos sua falta! Novos imóveis entraram esta semana. Quer que eu filtre opções até R$ {{valor}}?",
  },
  {
    id: "proposta",
    titulo: "Lembrete de proposta",
    canal: "whatsapp",
    mensagem:
      "Olá {{nome}}! Sua proposta ainda está em aberto. Posso esclarecer condições de pagamento ou agendar uma visita?",
  },
];

const applyVars = (tpl, lead) => {
  const nome = lead?.name || "cliente";
  const interesse =
    [lead?.interestType, lead?.purpose, lead?.description].filter(Boolean).join(" / ") ||
    "imóveis";
  const bairro = lead?.interestNeighborhood
    ? ` em ${lead.interestNeighborhood}`
    : lead?.interestCity
      ? ` em ${lead.interestCity}`
      : "";
  const valor = lead?.value
    ? Number(lead.value).toLocaleString("pt-BR")
    : lead?.priceMax
      ? Number(lead.priceMax).toLocaleString("pt-BR")
      : "seu orçamento";
  return String(tpl || "")
    .replace(/\{\{nome\}\}/gi, nome)
    .replace(/\{\{interesse\}\}/gi, interesse)
    .replace(/\{\{bairro\}\}/gi, bairro)
    .replace(/\{\{valor\}\}/gi, valor);
};

const NutricaoLeads = () => {
  const history = useHistory();
  const [tab, setTab] = useState("fluxos");
  const [items, setItems] = useState([]);
  const [leads, setLeads] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [enviandoId, setEnviandoId] = useState(null);
  const [busca, setBusca] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    leadSaleId: "",
    cadenceDays: 7,
    nextSendAt: "",
    channel: "whatsapp",
    status: "ativo",
    messageTemplate: TEMPLATES[0].mensagem,
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nut, leadsData, campData] = await Promise.all([
        realtyService.listNutricao({ pageSize: 200 }),
        leadsSalesService.list({ pageSize: 200, pageNumber: 1 }),
        api.get("/campaigns", { params: { searchParam: "", pageNumber: 1 } }).catch(() => ({ data: {} })),
      ]);
      setItems(nut.items || nut.records || []);
      setLeads(leadsData.leads || []);
      const campList = campData?.data?.records || campData?.data?.campaigns || campData?.data || [];
      setCampaigns(Array.isArray(campList) ? campList : []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const leadById = useMemo(() => {
    const map = new Map();
    leads.forEach((l) => map.set(Number(l.id), l));
    return map;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const lead = leadById.get(Number(it.leadSaleId));
      return (
        String(it.title || "").toLowerCase().includes(q) ||
        String(it.messageTemplate || "").toLowerCase().includes(q) ||
        String(lead?.name || "").toLowerCase().includes(q) ||
        String(lead?.phone || "").includes(q)
      );
    });
  }, [items, busca, leadById]);

  const dueItems = useMemo(() => {
    const now = Date.now();
    return items.filter((it) => {
      if (it.status !== "ativo" && it.status !== "pendente") return false;
      if (!it.nextSendAt) return true;
      return new Date(it.nextSendAt).getTime() <= now;
    });
  }, [items]);

  const openNew = (template) => {
    setEditing(null);
    setForm({
      title: template?.titulo || "Nova cadência",
      leadSaleId: "",
      cadenceDays: 7,
      nextSendAt: new Date().toISOString().slice(0, 16),
      channel: template?.canal || "whatsapp",
      status: "ativo",
      messageTemplate: template?.mensagem || TEMPLATES[0].mensagem,
      notes: "",
    });
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      leadSaleId: item.leadSaleId || "",
      cadenceDays: item.cadenceDays || 7,
      nextSendAt: item.nextSendAt
        ? new Date(item.nextSendAt).toISOString().slice(0, 16)
        : "",
      channel: item.channel || "whatsapp",
      status: item.status || "ativo",
      messageTemplate: item.messageTemplate || "",
      notes: item.notes || "",
    });
    setFormOpen(true);
  };

  const saveForm = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      leadSaleId: form.leadSaleId ? Number(form.leadSaleId) : null,
      cadenceDays: Number(form.cadenceDays) || 7,
      nextSendAt: form.nextSendAt ? new Date(form.nextSendAt).toISOString() : null,
    };
    try {
      if (editing) await realtyService.updateNutricao(editing.id, payload);
      else await realtyService.createNutricao(payload);
      toast.success(editing ? "Cadência atualizada" : "Cadência criada");
      setFormOpen(false);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Excluir cadência "${item.title}"?`)) return;
    try {
      await realtyService.deleteNutricao(item.id);
      toast.success("Removida");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const toggleStatus = async (item) => {
    const next = item.status === "ativo" ? "pausado" : "ativo";
    try {
      await realtyService.updateNutricao(item.id, { status: next });
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const sendWhatsApp = async (item) => {
    setEnviandoId(item.id);
    try {
      const data = await realtyService.sendNutricaoWhatsApp(item.id);
      if (data.sent) {
        toast.success("Mensagem enviada pelo WhatsApp do CRM");
      } else if (data.ticket?.uuid) {
        toast.info("Ticket aberto — finalize o envio no atendimento se necessário");
        history.push(`/tickets/${data.ticket.uuid}`);
      } else {
        toast.warn(data.error || "Não foi possível enviar. Verifique telefone e conexão WhatsApp.");
      }
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setEnviandoId(null);
    }
  };

  const processarAgora = async () => {
    setProcessando(true);
    try {
      const data = await realtyService.processNutricao();
      toast.success(
        `Processado: ${data.processed || 0} envio(s), ${data.skipped || 0} ignorado(s)`
      );
      await load();
      setTab("mensagens");
    } catch (err) {
      toastError(err);
    } finally {
      setProcessando(false);
    }
  };

  const enrollLead = async (lead) => {
    try {
      await realtyService.createNutricao({
        title: `Nutrição — ${lead.name}`,
        leadSaleId: lead.id,
        cadenceDays: 7,
        nextSendAt: new Date().toISOString(),
        channel: "whatsapp",
        status: "ativo",
        messageTemplate: applyVars(TEMPLATES[0].mensagem, lead),
        notes: "Inscrito pela aba Leads",
      });
      toast.success(`${lead.name} inscrito na nutrição`);
      await load();
      setTab("fluxos");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Nutrição de Leads</h1>
            <p className="realty-page__subtitle">
              Cadências e envio pelo WhatsApp nativo do VBSolution — mesmos fluxos do Radarimobtech.
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              disabled={processando || dueItems.length === 0}
              onClick={processarAgora}
            >
              {processando ? "Processando…" : `Processar agora (${dueItems.length})`}
            </button>
            <button type="button" className="realty-page__btn" onClick={() => openNew()}>
              Nova cadência
            </button>
          </div>
        </div>

        <div className="realty-tabs">
          {[
            { id: "fluxos", label: `Fluxos (${items.length})` },
            { id: "sugestoes", label: "Sugestões" },
            { id: "leads", label: `Leads (${leads.length})` },
            { id: "mensagens", label: `Pendentes (${dueItems.length})` },
            { id: "campanhas", label: `Campanhas (${campaigns.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`realty-tab${tab === t.id ? " realty-tab--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(tab === "fluxos" || tab === "mensagens") && (
          <div className="realty-page__toolbar">
            <input
              className="realty-page__search"
              placeholder="Buscar cadência, lead ou telefone…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        )}

        {loading ? (
          <div className="realty-empty">Carregando…</div>
        ) : tab === "sugestoes" ? (
          <div className="realty-page__grid">
            {TEMPLATES.map((tpl) => (
              <article key={tpl.id} className="realty-card">
                <h3>{tpl.titulo}</h3>
                <span className="realty-chip">{tpl.canal}</span>
                <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{tpl.mensagem}</p>
                <button
                  type="button"
                  className="realty-page__btn"
                  style={{ marginTop: 12 }}
                  onClick={() => openNew(tpl)}
                >
                  Usar modelo
                </button>
              </article>
            ))}
          </div>
        ) : tab === "leads" ? (
          <div className="realty-page__grid">
            {leads.slice(0, 40).map((lead) => (
              <article key={lead.id} className="realty-card">
                <h3>{lead.name}</h3>
                <p>
                  {lead.phone || "sem telefone"} · {lead.status}
                </p>
                <button
                  type="button"
                  className="realty-page__btn"
                  style={{ marginTop: 12 }}
                  onClick={() => enrollLead(lead)}
                >
                  Inscrever na nutrição
                </button>
              </article>
            ))}
          </div>
        ) : tab === "campanhas" ? (
          <div className="realty-page__grid">
            {campaigns.length === 0 ? (
              <div className="realty-empty">
                Nenhuma campanha. Crie em{" "}
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => history.push("/campaigns")}
                >
                  Campanhas
                </button>
              </div>
            ) : (
              campaigns.slice(0, 30).map((c) => (
                <article key={c.id} className="realty-card">
                  <h3>{c.name || `Campanha #${c.id}`}</h3>
                  <p>
                    Status: {c.status} · WhatsApp #{c.whatsappId || "—"}
                  </p>
                  <button
                    type="button"
                    className="realty-page__btn realty-page__btn--ghost"
                    style={{ marginTop: 12 }}
                    onClick={() => history.push("/campaigns")}
                  >
                    Abrir campanhas
                  </button>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="realty-page__grid">
            {(tab === "mensagens" ? dueItems : filtered).map((item) => {
              const lead = leadById.get(Number(item.leadSaleId));
              const preview = applyVars(item.messageTemplate, lead);
              return (
                <article key={item.id} className="realty-card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <h3>{item.title}</h3>
                    <span className="realty-chip">{item.status}</span>
                  </div>
                  <p>
                    Lead: {lead?.name || `#${item.leadSaleId || "—"}`} · a cada{" "}
                    {item.cadenceDays || 7} dias · {item.channel || "whatsapp"}
                  </p>
                  {item.nextSendAt && (
                    <p>Próximo: {new Date(item.nextSendAt).toLocaleString("pt-BR")}</p>
                  )}
                  <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{preview}</p>
                  <div className="realty-card__actions" style={{ flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="realty-page__btn"
                      disabled={enviandoId === item.id || item.channel !== "whatsapp"}
                      onClick={() => sendWhatsApp(item)}
                    >
                      {enviandoId === item.id ? "Enviando…" : "Enviar WhatsApp"}
                    </button>
                    <button
                      type="button"
                      className="realty-page__btn realty-page__btn--ghost"
                      onClick={() => toggleStatus(item)}
                    >
                      {item.status === "ativo" ? "Pausar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      className="realty-page__btn realty-page__btn--ghost"
                      onClick={() => openEdit(item)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="realty-page__btn realty-page__btn--ghost"
                      onClick={() => removeItem(item)}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              );
            })}
            {(tab === "mensagens" ? dueItems : filtered).length === 0 && (
              <div className="realty-empty">
                {tab === "mensagens"
                  ? "Nenhuma mensagem pendente."
                  : "Nenhuma cadência. Use um modelo ou crie uma nova."}
              </div>
            )}
          </div>
        )}

        {formOpen && (
          <div className="realty-modal-backdrop" onClick={() => setFormOpen(false)}>
            <div
              className="realty-card realty-modal"
              style={{ width: 520, maxWidth: "94vw" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>{editing ? "Editar cadência" : "Nova cadência"}</h3>
              <form className="realty-form" onSubmit={saveForm}>
                <label>
                  Título *
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </label>
                <label>
                  Lead
                  <select
                    value={form.leadSaleId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const lead = leadById.get(Number(id));
                      setForm((p) => ({
                        ...p,
                        leadSaleId: id,
                        messageTemplate: lead
                          ? applyVars(p.messageTemplate, lead)
                          : p.messageTemplate,
                      }));
                    }}
                  >
                    <option value="">Selecione o lead</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.phone ? `(${l.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label>
                    Intervalo (dias)
                    <input
                      type="number"
                      min="1"
                      value={form.cadenceDays}
                      onChange={(e) => setForm((p) => ({ ...p, cadenceDays: e.target.value }))}
                    />
                  </label>
                  <label>
                    Próximo envio
                    <input
                      type="datetime-local"
                      value={form.nextSendAt}
                      onChange={(e) => setForm((p) => ({ ...p, nextSendAt: e.target.value }))}
                    />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label>
                    Canal
                    <select
                      value={form.channel}
                      onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">E-mail</option>
                      <option value="sms">SMS</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="ativo">Ativo</option>
                      <option value="pausado">Pausado</option>
                      <option value="concluido">Concluído</option>
                    </select>
                  </label>
                </div>
                <label>
                  Mensagem / template
                  <textarea
                    rows={5}
                    value={form.messageTemplate}
                    onChange={(e) => setForm((p) => ({ ...p, messageTemplate: e.target.value }))}
                    placeholder="Use {{nome}}, {{interesse}}, {{bairro}}, {{valor}}"
                  />
                </label>
                <label>
                  Observações
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </label>
                <div className="realty-card__actions">
                  <button
                    type="button"
                    className="realty-page__btn realty-page__btn--ghost"
                    onClick={() => setFormOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="realty-page__btn">
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default NutricaoLeads;
