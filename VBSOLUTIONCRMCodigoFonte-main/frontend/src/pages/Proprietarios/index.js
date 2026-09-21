/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React from "react";
import RealtyCrudPage from "../../components/RealtyCrudPage";
import realtyService from "../../services/realtyService";

const Proprietarios = () => (
  <RealtyCrudPage
    title="Proprietários"
    subtitle="Base de proprietários vinculada aos imóveis."
    listKey="proprietarios"
    loader={realtyService.listProprietarios}
    creator={realtyService.createProprietario}
    updater={realtyService.updateProprietario}
    remover={realtyService.deleteProprietario}
    cardTitle={(item) => item.name}
    cardMeta={(item) => (
      <span>
        {item.phone || "sem telefone"} · {item.email || "sem e-mail"}
      </span>
    )}
    fields={[
      { name: "name", label: "Nome", required: true },
      { name: "phone", label: "Telefone" },
      { name: "email", label: "E-mail" },
      { name: "document", label: "Documento" },
      { name: "notes", label: "Observações", type: "textarea" },
    ]}
  />
);

export default Proprietarios;
