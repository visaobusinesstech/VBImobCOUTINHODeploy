/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useEffect, useState } from "react";
import MainContainer from "../../components/MainContainer";
import leadsSalesService from "../../services/leadsSalesService";
import toastError from "../../errors/toastError";
import { formatBRL } from "../../helpers/realtyCrm";

const Propostas = () => {
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await leadsSalesService.list({ pageSize: 200, status: "proposta" });
        setLeads(data.leads || []);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Propostas</h1>
            <p className="realty-page__subtitle">Leads na etapa Proposta do funil de vendas.</p>
          </div>
        </div>
        {leads.length === 0 ? (
          <div className="realty-empty">Nenhuma proposta aberta. Mova um lead para Proposta no pipeline.</div>
        ) : (
          <div className="realty-page__grid">
            {leads.map((lead) => (
              <article key={lead.id} className="realty-card">
                <h3>{lead.name}</h3>
                <p>
                  {formatBRL(lead.value)} · {lead.phone || "sem telefone"}
                </p>
                {lead.imovelId ? <span className="realty-chip">imóvel #{lead.imovelId}</span> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Propostas;
