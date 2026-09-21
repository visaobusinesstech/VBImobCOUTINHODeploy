/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useState } from "react";
import MainContainer from "../../components/MainContainer";
import leadsSalesService from "../../services/leadsSalesService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { formatBRL } from "../../helpers/realtyCrm";

const Followups = () => {
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState("all");

  const load = async (due = filter) => {
    try {
      const data = await leadsSalesService.list({
        pageSize: 200,
        followUpDue: due,
      });
      setLeads(data.leads || []);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const saveDate = async (lead, followUpAt) => {
    try {
      await leadsSalesService.update(lead.id, { followUpAt: followUpAt || null });
      toast.success("Follow-up atualizado");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Follow-up</h1>
            <p className="realty-page__subtitle">Lembretes de retorno nos leads de vendas.</p>
          </div>
        </div>
        <div className="realty-page__toolbar">
          <select className="realty-page__search" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos com data</option>
            <option value="overdue">Atrasados</option>
          </select>
        </div>
        {leads.length === 0 ? (
          <div className="realty-empty">Nenhum follow-up. Defina a data no pipeline ou aqui nos leads.</div>
        ) : (
          <div className="realty-page__grid">
            {leads.map((lead) => (
              <article key={lead.id} className="realty-card">
                <h3>{lead.name}</h3>
                <p>
                  {formatBRL(lead.value)} · {lead.status || "novo"}
                </p>
                <label>
                  <span style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Retornar em</span>
                  <input
                    type="datetime-local"
                    defaultValue={
                      lead.followUpAt
                        ? new Date(lead.followUpAt).toISOString().slice(0, 16)
                        : ""
                    }
                    onBlur={(e) => saveDate(lead, e.target.value ? new Date(e.target.value).toISOString() : "")}
                  />
                </label>
              </article>
            ))}
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Followups;
