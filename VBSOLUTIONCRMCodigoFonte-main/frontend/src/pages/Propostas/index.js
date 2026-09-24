/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React from "react";
import RealtyCrudPage from "../../components/RealtyCrudPage";
import realtyService from "../../services/realtyService";
import { formatBRL } from "../../helpers/realtyCrm";

const Propostas = () => (
  <RealtyCrudPage
    title="Propostas"
    subtitle="Documentos comerciais vinculados a lead e imóvel — envie e acompanhe no funil."
    listKey="propostas"
    loader={realtyService.listPropostas}
    creator={realtyService.createProposta}
    updater={realtyService.updateProposta}
    remover={realtyService.deleteProposta}
    cardTitle={(item) => item.title || `Proposta #${item.id}`}
    cardMeta={(item) => (
      <>
        <span className="realty-chip">{item.status || "rascunho"}</span>
        <span>
          Lead #{item.leadSaleId}
          {item.imovelId ? ` · Imóvel #${item.imovelId}` : ""} · {formatBRL(item.value)}
        </span>
      </>
    )}
    fields={[
      { name: "title", label: "Título" },
      { name: "leadSaleId", label: "ID do Lead", type: "number", cast: "number", required: true },
      { name: "imovelId", label: "ID do Imóvel", type: "number", cast: "number" },
      { name: "value", label: "Valor", type: "number", cast: "number" },
      { name: "paymentMethod", label: "Forma de pagamento" },
      { name: "downPayment", label: "Entrada", type: "number", cast: "number" },
      {
        name: "financing",
        label: "Financiamento",
        type: "select",
        defaultValue: "false",
        options: [
          { value: "false", label: "Não" },
          { value: "true", label: "Sim" },
        ],
        cast: "boolean",
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "rascunho",
        options: [
          { value: "rascunho", label: "Rascunho" },
          { value: "enviada", label: "Enviada" },
          { value: "em_negociacao", label: "Em negociação" },
          { value: "aceita", label: "Aceita" },
          { value: "recusada", label: "Recusada" },
          { value: "expirada", label: "Expirada" },
        ],
      },
      { name: "validUntil", label: "Validade", type: "datetime-local" },
      { name: "ticketId", label: "Ticket WhatsApp", type: "ticket" },
      { name: "conditions", label: "Condições", type: "textarea" },
      { name: "notes", label: "Observações", type: "textarea" },
    ]}
  />
);

export default Propostas;
