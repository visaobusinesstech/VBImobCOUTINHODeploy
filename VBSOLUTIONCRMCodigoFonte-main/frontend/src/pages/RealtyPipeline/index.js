/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import leadsSalesService from "../../services/leadsSalesService";
import leadPipelinesService from "../../services/leadPipelinesService";
import realtyService from "../../services/realtyService";
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

const RealtyPipeline = () => {
  const history = useHistory();
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [pipelines, setPipelines] = useState([]);
  const [pipelineId, setPipelineId] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);

  const load = async (pid = pipelineId) => {
    try {
      const data = await leadsSalesService.list({
        pageSize: 200,
        pageNumber: 1,
        pipelineId: pid || undefined,
      });
      setLeads(data.leads || []);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await leadPipelinesService.list();
        const list = data.pipelines || data || [];
        const arr = Array.isArray(list) ? list : [];
        setPipelines(arr);
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
    load(pipelineId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId]);

  const grouped = useMemo(() => groupLeadsByStage(leads, stages), [leads, stages]);

  const moveLead = async (lead, status) => {
    try {
      await leadsSalesService.update(lead.id, { status });
      toast.success("Lead movido");
      await load();
    } catch (err) {
      toastError(err);
    }
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

  return (
    <MainContainer>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">CRM Pipeline</h1>
            <p className="realty-page__subtitle">
              Funil de leads e vendas com matching de imóveis. Os dados são os mesmos de Leads e Vendas.
            </p>
          </div>
          <button type="button" className="realty-page__btn" onClick={() => setOpenCreate(true)}>
            Novo lead
          </button>
        </div>
        <div className="realty-page__toolbar">
          <select
            className="realty-page__search"
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
          >
            {pipelines.length === 0 && <option value="">Pipeline padrão</option>}
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || `Pipeline ${p.id}`}
              </option>
            ))}
          </select>
        </div>
        <div className="realty-kanban">
          {stages.map((stage) => (
            <section key={stage.key} className="realty-col">
              <h4>
                {stage.label} ({(grouped[stage.key] || []).length})
              </h4>
              <div className="realty-col__list">
                {(grouped[stage.key] || []).map((lead) => (
                  <article key={lead.id} className="realty-lead">
                    <strong>{lead.name}</strong>
                    <span>
                      {formatBRL(lead.value)} · {lead.phone || "sem telefone"}
                    </span>
                    {lead.imovelId ? (
                      <div>
                        <span className="realty-chip">imóvel #{lead.imovelId}</span>
                      </div>
                    ) : null}
                    {lead.ticketId ? (
                      <span className="realty-chip">ticket #{lead.ticketId}</span>
                    ) : null}
                    <label style={{ display: "block", marginTop: 8 }}>
                      <span style={{ fontSize: 11 }}>Follow-up</span>
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
                        onChange={(e) => moveLead(lead, e.target.value)}
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
                            if (data.ticket?.uuid) {
                              history.push(`/tickets/${data.ticket.uuid}`);
                            } else {
                              toast.info("Nenhum ticket WhatsApp para este telefone ainda.");
                            }
                          } catch (err) {
                            toastError(err);
                          }
                        }}
                      >
                        Ticket
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
        {selectedLead && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.35)",
              zIndex: 1300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setSelectedLead(null)}
          >
            <div className="realty-card" style={{ width: 480, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
              <h3>Imóveis para {selectedLead.name}</h3>
              {matches.length === 0 ? (
                <p>Nenhum match. Cadastre imóveis com cidade/tipo próximos ao interesse do lead.</p>
              ) : (
                matches.map((m) => (
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
                ))
              )}
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
