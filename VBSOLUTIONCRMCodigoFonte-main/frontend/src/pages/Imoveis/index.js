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
    subtitle="Portfólio comercial — matching, propostas e WhatsApp dependem deste cadastro."
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
          {item.code ? `${item.code} · ` : ""}
          {item.type || "Imóvel"} · {item.neighborhood || "—"} / {item.city || "—"} · {formatBRL(item.price)}
        </span>
      </>
    )}
    fields={[
      { name: "title", label: "Título", required: true },
      { name: "code", label: "Código do imóvel" },
      { name: "type", label: "Tipo", defaultValue: "apartamento" },
      {
        name: "purpose",
        label: "Finalidade",
        type: "select",
        defaultValue: "venda",
        options: [
          { value: "venda", label: "Venda" },
          { value: "aluguel", label: "Aluguel" },
          { value: "ambos", label: "Ambos" },
        ],
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        defaultValue: "disponivel",
        options: IMOVEL_STATUSES.map((s) => ({ value: s, label: s })),
      },
      { name: "price", label: "Preço", type: "number", cast: "number" },
      { name: "condoFee", label: "Condomínio", type: "number", cast: "number" },
      { name: "iptu", label: "IPTU", type: "number", cast: "number" },
      { name: "zipCode", label: "CEP" },
      { name: "address", label: "Endereço" },
      { name: "neighborhood", label: "Bairro" },
      { name: "city", label: "Cidade" },
      { name: "state", label: "UF" },
      { name: "bedrooms", label: "Quartos", type: "number", cast: "number" },
      { name: "suites", label: "Suítes", type: "number", cast: "number" },
      { name: "bathrooms", label: "Banheiros", type: "number", cast: "number" },
      { name: "parkingSpots", label: "Vagas", type: "number", cast: "number" },
      { name: "areaM2", label: "Área (m²)", type: "number", cast: "number" },
      { name: "proprietarioId", label: "ID Proprietário", type: "number", cast: "number" },
      { name: "videoUrl", label: "URL vídeo" },
      { name: "description", label: "Descrição", type: "textarea" },
    ]}
  />
);

export default Imoveis;
