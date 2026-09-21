/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React from "react";
import RealtyCrudPage from "../../components/RealtyCrudPage";
import realtyService from "../../services/realtyService";
import { formatBRL, IMOVEL_STATUSES } from "../../helpers/realtyCrm";

const Imoveis = () => (
  <RealtyCrudPage
    title="Imóveis"
    subtitle="Inventário imobiliário — captação, status e características."
    listKey="imoveis"
    loader={realtyService.listImoveis}
    creator={realtyService.createImovel}
    updater={realtyService.updateImovel}
    remover={realtyService.deleteImovel}
    cardTitle={(item) => item.title}
    cardMeta={(item) => (
      <>
        <span className="realty-chip">{item.status || "disponivel"}</span>
        <span>
          {item.type || "Imóvel"} · {item.neighborhood || "—"} / {item.city || "—"} · {formatBRL(item.price)}
        </span>
      </>
    )}
    fields={[
      { name: "title", label: "Título", required: true },
      { name: "type", label: "Tipo", defaultValue: "apartamento" },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "disponivel",
        options: IMOVEL_STATUSES.map((s) => ({ value: s, label: s })),
      },
      { name: "price", label: "Preço", type: "number", cast: "number" },
      { name: "city", label: "Cidade" },
      { name: "neighborhood", label: "Bairro" },
      { name: "address", label: "Endereço" },
      { name: "bedrooms", label: "Quartos", type: "number", cast: "number" },
      { name: "bathrooms", label: "Banheiros", type: "number", cast: "number" },
      { name: "areaM2", label: "Área (m²)", type: "number", cast: "number" },
      { name: "description", label: "Descrição", type: "textarea" },
    ]}
  />
);

export default Imoveis;
