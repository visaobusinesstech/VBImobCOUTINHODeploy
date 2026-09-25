/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * CRM Pipeline alinhado ao Radarimobtech: mesmos filtros (busca, estágio,
 * corretor, valor min/max) e inputs de lead (interesse, operação, canal, bairro).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import leadsSalesService from "../../services/leadsSalesService";
import leadPipelinesService from "../../services/leadPipelinesService";
import realtyService from "../../services/realtyService";
import api from "../../services/api";
import CreateLeadSaleModal from "../../components/CreateLeadSaleModal";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { formatBRL, groupLeadsByStage } from "../../helpers/realtyCrm";

const DEFAULT_STAGES = [
  { key: "novo", label: "Novos" },
  { key: "contato", label: "Contato" },
  { key: "visita", label: "Visita" },
  { key: "proposta", label: "Proposta" },
  { key: "fechado", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
];

const MOTIVOS_PERDA = [
  { id: "desistiu", label: "Desistiu da compra/aluguel" },
  { id: "concorrente", label: "Comprou com concorrente" },
  { id: "sem_resposta", label: "Sem resposta / Não retornou" },
  { id: "financeiro", label: "Problema financeiro" },
  { id: "outro", label: "Outro motivo" },
];

const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const RealtyPipeline = () => {
  const history = useHistory();
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [pipelines, setPipelines] = useState([]);
  const [pipelineId, setPipelineId] = useState("");
  const [users, setUsers] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstagio, setFilterEstagio] = useState("todos");
  const [filterCorretor, setFilterCorretor] = useState("todos");
  const [filterValorMin, setFilterValorMin] = useState("");
  const [filterValorMax, setFilterValorMax] = useState("");
  const [pendingPerdido, setPendingPerdido] = useState(null);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [motivoDetalhe, setMotivoDetalhe] = useState("");
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (pid = pipelineId) => {
    try {
      setLoading(true);
      const data = await leadsSalesService.list({
        pageSize: 300,
        pageNumber: 1,
        pipelineId: pid || undefined,
      });
      setLeads(data.leads || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    (async () => {
      try {
        const [pipeData, usersResp] = await Promise.all([
          leadPipelinesService.list(),
          api.get("/users", { params: { searchParam: "" } }),
        ]);
        const list = pipeData.pipelines || pipeData || [];
        const arr = Array.isArray(list) ? list : [];
        setPipelines(arr);
        const userList = usersResp?.data?.users || usersResp?.data || [];
        setUsers(Array.isArray(userList) ? userList : []);
        const first = arr[0];
        if (first) {
          setPipelineId(String(first.id));
          const st = (first.stages || []).map((s) => ({
            key: s.key || s.status,
            label: s.label || s.name || s.key,
          }));
          if (st.length) setStages(st);
        }
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  useEffect(() => {
    if (pipelineId) load(pipelineId);
  }, [pipelineId, load]);

  const hasActiveFilters =
    filterEstagio !== "todos" ||
    filterCorretor !== "todos" ||
    filterValorMin !== "" ||
    filterValorMax !== "" ||
    searchQuery !== "";

  const clearFilters = () => {
    setFilterEstagio("todos");
    setFilterCorretor("todos");
    setFilterValorMin("");
    setFilterValorMax("");
    setSearchQuery("");
  };

  const filteredLeads = useMemo(() => {
    let result = leads;
    const rawQuery = searchQuery.trim();
    if (rawQuery) {
      const q = normalizeSearchText(rawQuery);
      const qDigits = rawQuery.replace(/\D/g, "");
      result = result.filter((l) => {
        const nome = normalizeSearchText(l.name);
        const email = normalizeSearchText(l.email);
        const phone = String(l.phone || "").replace(/\D/g, "");
        const interesse = normalizeSearchText(
          [l.description, l.interestType, l.interestNeighborhood, l.interestCity, l.purpose]
            .filter(Boolean)
            .join(" ")
        );
        const canal = normalizeSearchText(l.origin);
        const company = normalizeSearchText(l.companyName);
        return (
          nome.includes(q) ||
          email.includes(q) ||
          company.includes(q) ||
          interesse.includes(q) ||
          canal.includes(q) ||
          (qDigits && phone.includes(qDigits))
        );
      });
    }
    if (filterEstagio !== "todos") {
      result = result.filter((l) => String(l.status || "") === filterEstagio);
    }
    if (filterCorretor !== "todos") {
      if (filterCorretor === "__none__") {
        result = result.filter((l) => !l.responsibleId);
      } else {
        result = result.filter((l) => String(l.responsibleId) === String(filterCorretor));
      }
    }
    const min = parseFloat(String(filterValorMin).replace(",", "."));
    const max = parseFloat(String(filterValorMax).replace(",", "."));
    if (!Number.isNaN(min)) result = result.filter((l) => Number(l.value || 0) >= min);
    if (!Number.isNaN(max)) result = result.filter((l) => Number(l.value || 0) <= max);
    return result;
  }, [leads, searchQuery, filterEstagio, filterCorretor, filterValorMin, filterValorMax]);

  const visibleStages =
    filterEstagio !== "todos"
      ? stages.filter((s) => s.key === filterEstagio)
      : stages;

  const grouped = useMemo(
    () => groupLeadsByStage(filteredLeads, visibleStages),
    [filteredLeads, visibleStages]
  );

  const moveLead = async (lead, status, extra = {}) => {
    try {
      await leadsSalesService.update(lead.id, { status, ...extra });
      toast.success("Lead movido");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const confirmPerdido = async () => {
    if (!pendingPerdido) return;
    const label = MOTIVOS_PERDA.find((m) => m.id === motivoPerda)?.label || motivoPerda;
    const reason = [label, motivoDetalhe].filter(Boolean).join(" — ");
    await moveLead(pendingPerdido, "perdido", { lostReason: reason || "Perdido" });
    setPendingPerdido(null);
    setMotivoPerda("");
    setMotivoDetalhe("");
  };

  const openMatches = async (lead) => {
    setSelectedLead(lead);
    try {
      const data = await realtyService.matchImoveis(lead.id);
      setMatches(data.matches || []);
    } catch (err) {
      toastError(err);
    }
  };

  const vincular = async (imovelId) => {
    if (!selectedLead) return;
    try {
      await leadsSalesService.update(selectedLead.id, { imovelId });
      toast.success("Imóvel vinculado ao lead");
      setSelectedLead(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const enviarWhatsApp = async () => {
    if (!selectedLead) return;
    try {
      const ids = matches.map((m) => m.imovelId);
      const data = await realtyService.sendMatchWhatsApp(selectedLead.id, ids);
      if (data.sent) toast.success("Opções enviadas no WhatsApp");
      else {
        toast.info(
          data.ticketId
            ? `Mensagem preparada (ticket #${data.ticketId}).`
            : "Vincule o lead a um ticket WhatsApp para disparo automático."
        );
      }
      if (data.ticketId) history.push(`/tickets/${data.ticketId}`);
      setSelectedLead(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const onDragStart = (e, lead) => {
    e.dataTransfer.setData("text/plain", String(lead.id));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = async (e, stageKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData("text/plain");
    const lead = leads.find((l) => String(l.id) === String(id));
    if (!lead || String(lead.status) === stageKey) return;
    if (stageKey === "perdido" || /perdido|lost/i.test(stageKey)) {
      setPendingPerdido(lead);
      setMotivoPerda("");
      setMotivoDetalhe("");
      return;
    }
    await moveLead(lead, stageKey);
  };

  const responsibleName = (lead) => {
    if (lead.responsible?.name) return lead.responsible.name;
    const u = users.find((x) => Number(x.id) === Number(lead.responsibleId));
    return u?.name || null;
  };

  return (
    <MainContainer>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">CRM Pipeline</h1>
            <p className="realty-page__subtitle">
              Funil alinhado ao Radarimobtech — mesmos filtros e dados de Leads e Vendas.
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={() => setShowFilters((v) => !v)}
            >
              {showFilters ? "Ocultar filtros" : "Filtros"}
            </button>
            <button type="button" className="realty-page__btn" onClick={() => setOpenCreate(true)}>
              Novo lead
            </button>
          </div>
        </div>

        <div className="realty-page__toolbar realty-pipeline-toolbar">
          <select
            className="realty-page__search realty-page__select"
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            aria-label="Pipeline"
          >
            {pipelines.length === 0 && <option value="">Pipeline padrão</option>}
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || `Pipeline ${p.id}`}
              </option>
            ))}
          </select>
          <input
            className="realty-page__search"
            type="search"
            placeholder="Buscar nome, telefone, e-mail, interesse, bairro, canal…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {hasActiveFilters && (
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={clearFilters}>
              Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="realty-filters-panel">
            <label className="realty-filter-field">
              <span>Estágio</span>
              <select value={filterEstagio} onChange={(e) => setFilterEstagio(e.target.value)}>
                <option value="todos">Todos</option>
                {stages.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="realty-filter-field">
              <span>Corretor / responsável</span>
              <select value={filterCorretor} onChange={(e) => setFilterCorretor(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="__none__">Sem responsável</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="realty-filter-field">
              <span>Valor mín. (R$)</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={filterValorMin}
                onChange={(e) => setFilterValorMin(e.target.value)}
              />
            </label>
            <label className="realty-filter-field">
              <span>Valor máx. (R$)</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="Sem limite"
                value={filterValorMax}
                onChange={(e) => setFilterValorMax(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="realty-pipeline-meta">
          {loading ? "Carregando…" : `${filteredLeads.length} lead(s)`}
          {hasActiveFilters ? " · filtros ativos" : ""}
        </div>

        <div className="realty-kanban">
          {visibleStages.map((stage) => (
            <section
              key={stage.key}
              className={`realty-col${dragOverColumn === stage.key ? " realty-col--drag" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumn(stage.key);
              }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => onDrop(e, stage.key)}
            >
              <h4>
                {stage.label} ({(grouped[stage.key] || []).length})
              </h4>
              <div className="realty-col__list">
                {(grouped[stage.key] || []).map((lead) => (
                  <article
                    key={lead.id}
                    className="realty-lead"
                    draggable
                    onDragStart={(e) => onDragStart(e, lead)}
                  >
                    <strong>{lead.name}</strong>
                    <span>
                      {formatBRL(lead.value)} · {lead.phone || "sem telefone"}
                    </span>
                    {(lead.interestType || lead.interestNeighborhood || lead.purpose) && (
                      <span className="realty-lead__interesse">
                        {[lead.purpose, lead.interestType, lead.interestNeighborhood]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    {lead.origin ? <span className="realty-chip">{lead.origin}</span> : null}
                    {responsibleName(lead) ? (
                      <span className="realty-chip">{responsibleName(lead)}</span>
                    ) : null}
                    {lead.imovelId ? <span className="realty-chip">imóvel #{lead.imovelId}</span> : null}
                    {lead.ticketId ? <span className="realty-chip">ticket #{lead.ticketId}</span> : null}
                    <label className="realty-lead__followup">
                      <span>Follow-up</span>
                      <input
                        type="datetime-local"
                        defaultValue={
                          lead.followUpAt
                            ? new Date(lead.followUpAt).toISOString().slice(0, 16)
                            : ""
                        }
                        onBlur={async (e) => {
                          try {
                            await leadsSalesService.update(lead.id, {
                              followUpAt: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            });
                          } catch (err) {
                            toastError(err);
                          }
                        }}
                      />
                    </label>
                    <div className="realty-card__actions">
                      <select
                        value={lead.status || stage.key}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === "perdido" || /perdido|lost/i.test(next)) {
                            setPendingPerdido(lead);
                            setMotivoPerda("");
                            setMotivoDetalhe("");
                            return;
                          }
                          moveLead(lead, next);
                        }}
                      >
                        {stages.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="realty-page__btn realty-page__btn--ghost"
                        onClick={() => openMatches(lead)}
                      >
                        Match
                      </button>
                      <button
                        type="button"
                        className="realty-page__btn realty-page__btn--ghost"
                        onClick={async () => {
                          try {
                            const data = await leadsSalesService.linkTicket(lead.id);
                            if (data.ticket?.uuid) history.push(`/tickets/${data.ticket.uuid}`);
                            else toast.info("Nenhum ticket WhatsApp para este telefone ainda.");
                          } catch (err) {
                            toastError(err);
                          }
                        }}
                      >
                        WhatsApp
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        {selectedLead && (
          <div className="realty-modal-backdrop" onClick={() => setSelectedLead(null)}>
            <div className="realty-card realty-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Imóveis para {selectedLead.name}</h3>
              {matches.length === 0 ? (
                <p>Nenhum match. Cadastre imóveis com cidade/tipo próximos ao interesse do lead.</p>
              ) : (
                <>
                  {matches.map((m) => (
                    <div key={m.imovelId} className="realty-lead" style={{ marginTop: 8 }}>
                      <strong>
                        {m.imovel.title} · score {m.score}
                      </strong>
                      <span>{(m.reasons || []).join(", ")}</span>
                      <button
                        type="button"
                        className="realty-page__btn"
                        style={{ marginTop: 8 }}
                        onClick={() => vincular(m.imovelId)}
                      >
                        Vincular
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="realty-page__btn"
                    style={{ marginTop: 16, width: "100%" }}
                    onClick={enviarWhatsApp}
                  >
                    Enviar opções no WhatsApp
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {pendingPerdido && (
          <div className="realty-modal-backdrop" onClick={() => setPendingPerdido(null)}>
            <div className="realty-card realty-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Motivo da perda — {pendingPerdido.name}</h3>
              <div className="realty-form">
                <select value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)}>
                  <option value="">Selecione o motivo</option>
                  {MOTIVOS_PERDA.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={3}
                  placeholder="Detalhe (opcional)"
                  value={motivoDetalhe}
                  onChange={(e) => setMotivoDetalhe(e.target.value)}
                />
                <div className="realty-card__actions">
                  <button
                    type="button"
                    className="realty-page__btn realty-page__btn--ghost"
                    onClick={() => setPendingPerdido(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="realty-page__btn"
                    disabled={!motivoPerda}
                    onClick={confirmPerdido}
                  >
                    Confirmar perdido
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {openCreate && (
          <CreateLeadSaleModal
            open={openCreate}
            onClose={() => setOpenCreate(false)}
            pipelineId={pipelineId ? Number(pipelineId) : undefined}
            columns={stages}
            onSave={() => {
              setOpenCreate(false);
              load();
            }}
          />
        )}
      </div>
    </MainContainer>
  );
};

export default RealtyPipeline;
