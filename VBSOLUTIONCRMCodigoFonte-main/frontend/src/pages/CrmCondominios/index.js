/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * CRM · Condomínios — paridade funcional Lovable CrmCondominios (design VBSolution).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Phone,
  Mail,
  Users,
  TrendingUp,
  CalendarClock,
  ExternalLink,
  Search,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Loader2,
  RefreshCw
} from "lucide-react";
import { formatDistanceToNow, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import {
  CONDOMINIO_CANAIS,
  CONDOMINIO_INICIATIVA_STATUSES,
  CONDOMINIO_CONTATO_TIPOS,
  CONDOMINIO_CONTATO_STATUSES,
  STATUS_BADGE,
  isIniciativaAtrasada,
  isLeadClosed,
  emptyIniciativaForm,
  emptyContatoForm,
  iniciativaToApiPayload,
  contatoToApiPayload,
  formatBRL,
  digitsOnly
} from "../../helpers/condominioCrm";
import "./condominios.css";

const safeParse = (value) => {
  if (!value) return null;
  try {
    const d = typeof value === "string" ? parseISO(value) : new Date(value);
    return isValid(d) ? d : null;
  } catch (_) {
    return null;
  }
};

const relative = (value) => {
  const d = safeParse(value);
  if (!d) return "—";
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
};

const toDatetimeLocal = (iso) => {
  if (!iso) return "";
  const d = safeParse(iso);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

function Kpi({ label, value, icon, tone }) {
  return (
    <article className={`realty-metric-card${tone === "danger" ? " realty-condo-kpi--danger" : ""}`}>
      <div>
        <p className="realty-metric-card__title">
          <span className="realty-condo-kpi-icon">{icon}</span>
          {label}
        </p>
        <p
          className={`realty-metric-card__value${
            tone === "danger" ? " realty-condo-kpi-value--danger" : ""
          }`}
        >
          {value}
        </p>
      </div>
    </article>
  );
}

function Breakdown({ title, data }) {
  const entries = Array.from(data.entries()).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <article className="realty-card realty-condo-breakdown">
      <h4 className="realty-condo-breakdown__title">{title}</h4>
      {entries.length === 0 && <p className="realty-condo-muted">Sem dados.</p>}
      {entries.map(([k, v]) => (
        <div key={k} className="realty-condo-breakdown__row">
          <div className="realty-condo-breakdown__labels">
            <span className="realty-condo-capitalize">{String(k).replace(/_/g, " ")}</span>
            <span className="realty-condo-muted">{v}</span>
          </div>
          <div className="realty-condo-bar">
            <div className="realty-condo-bar__fill" style={{ width: `${(v / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </article>
  );
}

function PerformanceView({ leads, iniciativas, contatos }) {
  const porOrigem = new Map();
  leads.forEach((l) => {
    const k = l.canalOrigem || "—";
    porOrigem.set(k, (porOrigem.get(k) || 0) + 1);
  });
  const porEstagio = new Map();
  leads.forEach((l) => {
    porEstagio.set(l.estagio, (porEstagio.get(l.estagio) || 0) + 1);
  });
  const porCanal = new Map();
  iniciativas.forEach((i) => {
    porCanal.set(i.canal, (porCanal.get(i.canal) || 0) + 1);
  });
  const fechados = leads.filter((l) => isLeadClosed(l.estagio)).length;
  const conv = leads.length ? Math.round((fechados / leads.length) * 100) : 0;
  const receita = leads
    .filter((l) => isLeadClosed(l.estagio))
    .reduce((s, l) => s + Number(l.valor || 0), 0);

  return (
    <div className="realty-condo-perf">
      <div className="realty-metrics realty-condo-perf__kpis">
        <Kpi label="Conversão" value={conv} icon={<TrendingUp size={14} />} />
        <Kpi label="Fechados" value={fechados} icon={<CheckCircle2 size={14} />} />
        <Kpi label="Iniciativas" value={iniciativas.length} icon={<CalendarClock size={14} />} />
        <Kpi label="Contatos" value={contatos.length} icon={<Users size={14} />} />
      </div>
      <p className="realty-condo-muted">
        Receita estimada de fechados: <strong>{formatBRL(receita)}</strong>
      </p>
      <div className="realty-condo-perf__grid">
        <Breakdown title="Leads por origem" data={porOrigem} />
        <Breakdown title="Leads por estágio" data={porEstagio} />
        <Breakdown title="Iniciativas por canal" data={porCanal} />
      </div>
    </div>
  );
}

const CrmCondominios = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("leads");
  const [kpis, setKpis] = useState({
    totalCondos: 0,
    totalLeads: 0,
    proximos: 0,
    atrasados: 0,
    fechados: 0
  });
  const [condominios, setCondominios] = useState([]);

  const [showIniciativa, setShowIniciativa] = useState(false);
  const [showContato, setShowContato] = useState(false);
  const [formInic, setFormInic] = useState(emptyIniciativaForm());
  const [formContato, setFormContato] = useState(emptyContatoForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await realtyService.hubCondominios({ search });
      setKpis(
        data.kpis || {
          totalCondos: 0,
          totalLeads: 0,
          proximos: 0,
          atrasados: 0,
          fechados: 0
        }
      );
      const list = data.condominios || [];
      setCondominios(list);
      setSelected((prev) => {
        if (prev && list.some((c) => c.nome === prev)) return prev;
        return list[0]?.nome || null;
      });
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => {
    if (!condominios.length) return null;
    return condominios.find((c) => c.nome === selected) || condominios[0];
  }, [condominios, selected]);

  const openIniciativa = (prefillNome) => {
    setFormInic({
      ...emptyIniciativaForm(),
      condominioNome: prefillNome || active?.nome || ""
    });
    setShowIniciativa(true);
  };

  const openContato = (prefillNome) => {
    setFormContato({
      ...emptyContatoForm(),
      condominioNome: prefillNome || active?.nome || ""
    });
    setShowContato(true);
  };

  const saveIniciativa = async () => {
    const payload = iniciativaToApiPayload(formInic);
    if (!payload.condominioNome || !payload.titulo) {
      toast.error("Preencha condomínio e título");
      return;
    }
    setSaving(true);
    try {
      await realtyService.createCondominioIniciativa(payload);
      toast.success("Iniciativa registrada");
      setShowIniciativa(false);
      setFormInic(emptyIniciativaForm());
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const saveContato = async () => {
    const payload = contatoToApiPayload(formContato);
    if (!payload.condominioNome) {
      toast.error("Informe o condomínio");
      return;
    }
    setSaving(true);
    try {
      await realtyService.createCondominioContato(payload);
      toast.success("Contato cadastrado");
      setShowContato(false);
      setFormContato(emptyContatoForm());
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const mudarStatus = async (iniciativa, novoStatus) => {
    try {
      await realtyService.updateCondominioIniciativa(iniciativa.id, {
        ...iniciativa,
        status: novoStatus
      });
      toast.success("Status atualizado");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page realty-condo">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">
              <Building2 size={22} className="realty-condo-title-icon" /> CRM · Condomínios
            </h1>
            <p className="realty-page__subtitle">
              Leads, origens, performance e próximos passos por empreendimento, administradora e
              síndico.
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
              {loading ? <Loader2 size={16} className="realty-condo-spin" /> : <RefreshCw size={16} />}
              Atualizar
            </button>
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => openContato()}>
              <Plus size={16} /> Contato
            </button>
            <button type="button" className="realty-page__btn" onClick={() => openIniciativa()}>
              <Plus size={16} /> Iniciativa
            </button>
          </div>
        </div>

        <div className="realty-metrics realty-condo-kpis">
          <Kpi label="Condomínios" value={kpis.totalCondos} icon={<Building2 size={14} />} />
          <Kpi label="Leads vinculados" value={kpis.totalLeads} icon={<Users size={14} />} />
          <Kpi label="Fechados" value={kpis.fechados} icon={<CheckCircle2 size={14} />} />
          <Kpi label="Próximos passos" value={kpis.proximos} icon={<CalendarClock size={14} />} />
          <Kpi
            label="Atrasados"
            value={kpis.atrasados}
            icon={<AlertTriangle size={14} />}
            tone={kpis.atrasados > 0 ? "danger" : undefined}
          />
        </div>

        <div className="realty-condo-layout">
          <article className="realty-list-card realty-condo-list">
            <div className="realty-condo-list__search">
              <Search size={16} className="realty-condo-list__search-icon" />
              <input
                className="realty-page__search"
                placeholder="Buscar condomínio ou bairro"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="realty-condo-list__scroll">
              {loading && <p className="realty-condo-muted realty-condo-pad">Carregando…</p>}
              {!loading && condominios.length === 0 && (
                <p className="realty-condo-muted realty-condo-pad">
                  Nenhum condomínio com iniciativa ou contato ainda. Cadastre uma iniciativa ou
                  contato acima.
                </p>
              )}
              <ul className="realty-condo-list__ul">
                {condominios.map((c) => {
                  const isSel = active?.nome === c.nome;
                  const atrasadosCondo = (c.iniciativas || []).filter((i) =>
                    isIniciativaAtrasada(i)
                  ).length;
                  return (
                    <li key={c.nome}>
                      <button
                        type="button"
                        className={`realty-condo-list__item${isSel ? " is-selected" : ""}`}
                        onClick={() => setSelected(c.nome)}
                      >
                        <div className="realty-condo-list__item-main">
                          <div className="realty-condo-list__nome">{c.nome}</div>
                          <div className="realty-condo-muted">{c.bairro || "—"}</div>
                        </div>
                        <div className="realty-condo-list__item-meta">
                          <span className="realty-chip">{(c.leads || []).length} leads</span>
                          {atrasadosCondo > 0 && (
                            <span className="realty-condo-badge realty-condo-badge--rose">
                              {atrasadosCondo} atrasado
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </article>

          <article className="realty-list-card realty-condo-detail">
            <div className="realty-condo-detail__head">
              <div>
                <h2 className="realty-condo-detail__title">
                  <Building2 size={18} /> {active?.nome ?? "Selecione um condomínio"}
                </h2>
                {active?.bairro ? (
                  <p className="realty-condo-muted">{active.bairro}</p>
                ) : null}
              </div>
              {active ? (
                <div className="realty-condo-detail__actions">
                  <button
                    type="button"
                    className="realty-page__btn realty-page__btn--ghost"
                    onClick={() => openContato(active.nome)}
                  >
                    + Contato
                  </button>
                  <button
                    type="button"
                    className="realty-page__btn"
                    onClick={() => openIniciativa(active.nome)}
                  >
                    + Iniciativa
                  </button>
                </div>
              ) : null}
            </div>

            {active ? (
              <>
                <div className="realty-tabs">
                  {[
                    { id: "leads", label: `Leads (${(active.leads || []).length})` },
                    { id: "contatos", label: `Contatos (${(active.contatos || []).length})` },
                    { id: "proximos", label: "Próximos passos" },
                    { id: "performance", label: "Performance" }
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

                {tab === "leads" && (
                  <div className="realty-condo-tab">
                    {(active.leads || []).length === 0 && (
                      <p className="realty-condo-muted">
                        Nenhum lead vinculado por interesse/bairro.
                      </p>
                    )}
                    {(active.leads || []).map((l) => (
                      <div key={l.id} className="realty-condo-row">
                        <div className="realty-condo-row__main">
                          <div className="realty-condo-row__title">{l.nome}</div>
                          <div className="realty-condo-muted">{l.interesse || "—"}</div>
                          <div className="realty-condo-muted">
                            Origem: {l.canalOrigem || "—"} · {relative(l.createdAt)}
                          </div>
                        </div>
                        <div className="realty-condo-row__actions">
                          <span className="realty-chip">{l.estagio}</span>
                          {l.telefone ? (
                            <a
                              className="realty-page__btn realty-page__btn--ghost realty-condo-icon-btn"
                              href={`https://wa.me/${digitsOnly(l.telefone)}`}
                              target="_blank"
                              rel="noreferrer"
                              title="WhatsApp"
                            >
                              <Phone size={14} />
                            </a>
                          ) : null}
                          {l.email ? (
                            <a
                              className="realty-page__btn realty-page__btn--ghost realty-condo-icon-btn"
                              href={`mailto:${l.email}`}
                              title="E-mail"
                            >
                              <Mail size={14} />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "contatos" && (
                  <div className="realty-condo-tab">
                    {(active.contatos || []).length === 0 && (
                      <p className="realty-condo-muted">
                        Sem contatos de administradora/síndico. Cadastre um contato.
                      </p>
                    )}
                    {(active.contatos || []).map((c) => (
                      <div key={c.id} className="realty-condo-row">
                        <div className="realty-condo-row__main">
                          <div className="realty-condo-row__title">
                            {c.nome || "(sem nome)"}{" "}
                            <span className="realty-chip realty-condo-capitalize">{c.tipo}</span>
                          </div>
                          <div className="realty-condo-muted">
                            Status: {c.status || "pendente"} · Confiança: {c.confianca ?? 0}%
                          </div>
                          <div className="realty-condo-muted">
                            {c.telefone ? <span className="realty-condo-mr">{c.telefone}</span> : null}
                            {c.email ? <span>{c.email}</span> : null}
                          </div>
                        </div>
                        <div className="realty-condo-row__actions">
                          {c.telefone ? (
                            <a
                              className="realty-page__btn realty-page__btn--ghost realty-condo-icon-btn"
                              href={`tel:${c.telefone}`}
                            >
                              <Phone size={14} />
                            </a>
                          ) : null}
                          {c.email ? (
                            <a
                              className="realty-page__btn realty-page__btn--ghost realty-condo-icon-btn"
                              href={`mailto:${c.email}`}
                            >
                              <Mail size={14} />
                            </a>
                          ) : null}
                          {c.urlFonte && c.urlFonte !== "manual" ? (
                            <a
                              className="realty-page__btn realty-page__btn--ghost realty-condo-icon-btn"
                              href={c.urlFonte}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink size={14} />
                            </a>
                          ) : null}
                          <select
                            className="realty-page__search realty-page__select realty-condo-status-select"
                            value={c.status || "pendente"}
                            onChange={async (e) => {
                              try {
                                await realtyService.updateCondominioContato(c.id, {
                                  ...c,
                                  status: e.target.value
                                });
                                toast.success("Status do contato atualizado");
                                await load();
                              } catch (err) {
                                toastError(err);
                              }
                            }}
                          >
                            {CONDOMINIO_CONTATO_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "proximos" && (
                  <div className="realty-condo-tab">
                    {(active.iniciativas || []).filter((i) => !i.dataConclusao).length === 0 && (
                      <p className="realty-condo-muted">
                        Sem iniciativas abertas para este condomínio.
                      </p>
                    )}
                    {(active.iniciativas || [])
                      .filter((i) => !i.dataConclusao)
                      .sort((a, b) =>
                        String(a.dataAgendada || "").localeCompare(String(b.dataAgendada || ""))
                      )
                      .map((i) => {
                        const atrasado = isIniciativaAtrasada(i);
                        return (
                          <div
                            key={i.id}
                            className={`realty-condo-row${atrasado ? " realty-condo-row--late" : ""}`}
                          >
                            <div className="realty-condo-row__main">
                              <div className="realty-condo-row__title">{i.titulo}</div>
                              <div className="realty-condo-muted realty-condo-capitalize">
                                Canal: {String(i.canal || "").replace(/_/g, " ")} · Resp.:{" "}
                                {i.responsavel || "—"}
                              </div>
                              {i.dataAgendada ? (
                                <div
                                  className={
                                    atrasado
                                      ? "realty-condo-late-text"
                                      : "realty-condo-muted"
                                  }
                                >
                                  <CalendarClock size={12} className="realty-condo-inline-icon" />
                                  {atrasado ? "Atrasado " : "Agendado "}
                                  {relative(i.dataAgendada)}
                                </div>
                              ) : null}
                            </div>
                            <div className="realty-condo-row__actions">
                              <span className={STATUS_BADGE[i.status] || "realty-condo-badge"}>
                                {String(i.status || "").replace(/_/g, " ")}
                              </span>
                              <select
                                className="realty-page__search realty-page__select realty-condo-status-select"
                                value={i.status}
                                onChange={(e) => mudarStatus(i, e.target.value)}
                              >
                                {CONDOMINIO_INICIATIVA_STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {tab === "performance" && (
                  <div className="realty-condo-tab">
                    <PerformanceView
                      leads={active.leads || []}
                      iniciativas={active.iniciativas || []}
                      contatos={active.contatos || []}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="realty-condo-muted realty-condo-pad">Nenhum condomínio selecionado.</p>
            )}
          </article>
        </div>

        {showIniciativa && (
          <div className="realty-condo-modal-backdrop" role="dialog" aria-modal="true">
            <div className="realty-condo-modal">
              <h3>Nova iniciativa</h3>
              <p className="realty-condo-muted">
                Orquestração multicanal — mesmos campos do Lovable (canal, título, agendamento…).
              </p>
              <div className="realty-condo-form-grid">
                <label>
                  Condomínio *
                  <input
                    className="realty-page__search"
                    value={formInic.condominioNome}
                    onChange={(e) =>
                      setFormInic((f) => ({ ...f, condominioNome: e.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Bairro
                  <input
                    className="realty-page__search"
                    value={formInic.bairro}
                    onChange={(e) => setFormInic((f) => ({ ...f, bairro: e.target.value }))}
                  />
                </label>
                <label>
                  CEP
                  <input
                    className="realty-page__search"
                    value={formInic.cep}
                    onChange={(e) => setFormInic((f) => ({ ...f, cep: e.target.value }))}
                  />
                </label>
                <label>
                  Canal *
                  <select
                    className="realty-page__search realty-page__select"
                    value={formInic.canal}
                    onChange={(e) => setFormInic((f) => ({ ...f, canal: e.target.value }))}
                  >
                    {CONDOMINIO_CANAIS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="realty-condo-span2">
                  Título *
                  <input
                    className="realty-page__search"
                    placeholder="Ex.: Campanha WhatsApp - moradores Life Park"
                    value={formInic.titulo}
                    onChange={(e) => setFormInic((f) => ({ ...f, titulo: e.target.value }))}
                  />
                </label>
                <label className="realty-condo-span2">
                  Descrição
                  <textarea
                    className="realty-page__search realty-condo-textarea"
                    value={formInic.descricao}
                    onChange={(e) => setFormInic((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </label>
                <label>
                  Responsável
                  <input
                    className="realty-page__search"
                    placeholder="Ex.: Ana / equipe MKT"
                    value={formInic.responsavel}
                    onChange={(e) => setFormInic((f) => ({ ...f, responsavel: e.target.value }))}
                  />
                </label>
                <label>
                  Data agendada
                  <input
                    type="datetime-local"
                    className="realty-page__search"
                    value={toDatetimeLocal(formInic.dataAgendada) || formInic.dataAgendada}
                    onChange={(e) =>
                      setFormInic((f) => ({ ...f, dataAgendada: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="realty-condo-modal__actions">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => setShowIniciativa(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="realty-page__btn"
                  disabled={saving}
                  onClick={saveIniciativa}
                >
                  {saving ? "Salvando…" : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showContato && (
          <div className="realty-condo-modal-backdrop" role="dialog" aria-modal="true">
            <div className="realty-condo-modal">
              <h3>Novo contato</h3>
              <p className="realty-condo-muted">
                Contato de administradora, síndico, portaria — mesmos tipos/status do Lovable.
              </p>
              <div className="realty-condo-form-grid">
                <label>
                  Condomínio *
                  <input
                    className="realty-page__search"
                    value={formContato.condominioNome}
                    onChange={(e) =>
                      setFormContato((f) => ({ ...f, condominioNome: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Tipo *
                  <select
                    className="realty-page__search realty-page__select"
                    value={formContato.tipo}
                    onChange={(e) => setFormContato((f) => ({ ...f, tipo: e.target.value }))}
                  >
                    {CONDOMINIO_CONTATO_TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nome
                  <input
                    className="realty-page__search"
                    value={formContato.nome}
                    onChange={(e) => setFormContato((f) => ({ ...f, nome: e.target.value }))}
                  />
                </label>
                <label>
                  Cargo
                  <input
                    className="realty-page__search"
                    value={formContato.cargo}
                    onChange={(e) => setFormContato((f) => ({ ...f, cargo: e.target.value }))}
                  />
                </label>
                <label>
                  Telefone
                  <input
                    className="realty-page__search"
                    placeholder="(61) 90000-0000"
                    value={formContato.telefone}
                    onChange={(e) => setFormContato((f) => ({ ...f, telefone: e.target.value }))}
                  />
                </label>
                <label>
                  E-mail
                  <input
                    type="email"
                    className="realty-page__search"
                    value={formContato.email}
                    onChange={(e) => setFormContato((f) => ({ ...f, email: e.target.value }))}
                  />
                </label>
                <label>
                  URL fonte
                  <input
                    className="realty-page__search"
                    value={formContato.urlFonte}
                    onChange={(e) => setFormContato((f) => ({ ...f, urlFonte: e.target.value }))}
                  />
                </label>
                <label>
                  Confiança (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="realty-page__search"
                    value={formContato.confianca}
                    onChange={(e) =>
                      setFormContato((f) => ({ ...f, confianca: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Status
                  <select
                    className="realty-page__search realty-page__select"
                    value={formContato.status}
                    onChange={(e) => setFormContato((f) => ({ ...f, status: e.target.value }))}
                  >
                    {CONDOMINIO_CONTATO_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="realty-condo-modal__actions">
                <button
                  type="button"
                  className="realty-page__btn realty-page__btn--ghost"
                  onClick={() => setShowContato(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="realty-page__btn"
                  disabled={saving}
                  onClick={saveContato}
                >
                  {saving ? "Salvando…" : "Cadastrar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default CrmCondominios;
