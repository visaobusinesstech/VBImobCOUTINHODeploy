/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React from "react";
import RealtyCrudPage from "../../components/RealtyCrudPage";
import realtyService from "../../services/realtyService";
import { CONTRATO_STATUSES, formatBRL } from "../../helpers/realtyCrm";

const Contratos = () => (
  <RealtyCrudPage
    title="Contratos"
    subtitle="Rascunhos, assinaturas e contratos ativos de locação ou venda."
    listKey="contratos"
    loader={realtyService.listContratos}
    creator={realtyService.createContrato}
    updater={realtyService.updateContrato}
    remover={realtyService.deleteContrato}
    cardTitle={(item) => item.title}
    cardMeta={(item) => (
      <>
        <span className="realty-chip">{item.status || "rascunho"}</span>
        <span>{formatBRL(item.value)}</span>
      </>
    )}
    fields={[
      { name: "title", label: "Título", required: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "rascunho",
        options: CONTRATO_STATUSES.map((s) => ({ value: s, label: s })),
      },
      { name: "value", label: "Valor", type: "number", cast: "number" },
      { name: "startDate", label: "Início", type: "date" },
      { name: "endDate", label: "Fim", type: "date" },
      { name: "imovelId", label: "ID do imóvel", type: "number", cast: "number" },
      { name: "proprietarioId", label: "ID do proprietário", type: "number", cast: "number" },
      { name: "leadSaleId", label: "ID do lead", type: "number", cast: "number" },
      { name: "notes", label: "Observações", type: "textarea" },
    ]}
  />
);

export default Contratos;
