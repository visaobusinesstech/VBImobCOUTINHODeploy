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
    subtitle="Fila estratégica de retornos (Radar/Coutinho) — ligada ao lead, corretor e WhatsApp do atendimento."
    listKey="followups"
    loader={realtyService.listFollowups}
    creator={realtyService.createFollowup}
    updater={realtyService.updateFollowup}
    remover={realtyService.deleteFollowup}
    emptyHint="Nenhum follow-up. Crie um retorno ou use «Carregar dados estratégicos» no Dashboard."
    cardTitle={(item) => `Lead #${item.leadSaleId} · ${item.type || "whatsapp"}`}
    cardMeta={(item) => (
      <>
        <span className="realty-chip">{item.status || "pendente"}</span>
        <span>
          {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("pt-BR") : "sem data"}
          {item.result ? ` · ${item.result}` : ""}
          {item.ticketId ? ` · ticket #${item.ticketId}` : ""}
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
          { value: "reuniao", label: "Reunião" },
          { value: "outro", label: "Outro" },
        ],
      },
      { name: "scheduledAt", label: "Agendado para", type: "datetime-local", required: true },
      { name: "completedAt", label: "Concluído em", type: "datetime-local" },
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
      { name: "userId", label: "Corretor (ID user)", type: "number", cast: "number" },
      { name: "result", label: "Resultado / observações do retorno" },
      { name: "ticketId", label: "Ticket WhatsApp", type: "ticket" },
      { name: "notes", label: "Descrição / briefing", type: "textarea" },
    ]}
  />
);

export default Followups;
