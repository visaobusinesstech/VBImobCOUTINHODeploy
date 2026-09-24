/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React from "react";
import RealtyCrudPage from "../../components/RealtyCrudPage";
import realtyService from "../../services/realtyService";

const Followups = () => (
  <RealtyCrudPage
    title="Follow-up"
    subtitle="Fila de retornos com histórico — vinculada ao lead e ao WhatsApp."
    listKey="followups"
    loader={realtyService.listFollowups}
    creator={realtyService.createFollowup}
    updater={realtyService.updateFollowup}
    remover={realtyService.deleteFollowup}
    cardTitle={(item) => `Lead #${item.leadSaleId} · ${item.type || "whatsapp"}`}
    cardMeta={(item) => (
      <>
        <span className="realty-chip">{item.status || "pendente"}</span>
        <span>
          {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("pt-BR") : "sem data"}
          {item.result ? ` · ${item.result}` : ""}
        </span>
      </>
    )}
    fields={[
      { name: "leadSaleId", label: "ID do Lead", type: "number", cast: "number", required: true },
      {
        name: "type",
        label: "Tipo",
        type: "select",
        defaultValue: "whatsapp",
        options: [
          { value: "whatsapp", label: "WhatsApp" },
          { value: "ligacao", label: "Ligação" },
          { value: "email", label: "E-mail" },
          { value: "visita", label: "Visita" },
        ],
      },
      { name: "scheduledAt", label: "Agendado para", type: "datetime-local", required: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "pendente",
        options: [
          { value: "pendente", label: "Pendente" },
          { value: "concluido", label: "Concluído" },
          { value: "cancelado", label: "Cancelado" },
        ],
      },
      { name: "result", label: "Resultado" },
      { name: "ticketId", label: "Ticket WhatsApp", type: "number", cast: "number" },
      { name: "notes", label: "Observações", type: "textarea" },
    ]}
  />
);

export default Followups;
